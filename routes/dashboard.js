// routes/dashboard.js - Summary analytics for dashboard

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(authMiddleware);

// ─── GET /api/dashboard/summary ───────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const userId = req.userId;

    // All orders counts
    const [totalOrders, matchedOrders, pendingOrders] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.order.count({ where: { userId, isMatched: true } }),
      prisma.order.count({ where: { userId, isMatched: false } }),
    ]);

    // Aggregates on matched orders
    const agg = await prisma.order.aggregate({
      where: { userId, isMatched: true },
      _sum: { bankSettlement: true, purchasePrice: true, profit: true },
      _avg: { profit: true },
      _count: { profit: true },
    });

    // Loss making orders (profit < 0)
    const lossOrders = await prisma.order.count({
      where: { userId, isMatched: true, profit: { lt: 0 } },
    });

    // High profit orders (profit > avg)
    const avgProfit = agg._avg.profit || 0;
    const highProfitOrders = await prisma.order.count({
      where: { userId, isMatched: true, profit: { gt: avgProfit } },
    });

    res.json({
      success: true,
      data: {
        totalOrders,
        matchedOrders,
        pendingOrders,
        totalRevenue: agg._sum.bankSettlement || 0,
        totalCost: agg._sum.purchasePrice || 0,
        totalProfit: agg._sum.profit || 0,
        avgProfit: agg._avg.profit || 0,
        lossOrders,
        highProfitOrders,
      },
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ success: false, message: "Failed to load summary" });
  }
});

// ─── GET /api/dashboard/chart/profit ──────────────────────────────────────────
// Profit grouped by payment date (last 30 days)
router.get("/chart/profit", async (req, res) => {
  try {
    const userId = req.userId;
    const days = parseInt(req.query.days || "30");

    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await prisma.order.findMany({
      where: {
        userId,
        isMatched: true,
        paymentDate: { gte: since },
        profit: { not: null },
      },
      select: { paymentDate: true, profit: true, bankSettlement: true },
      orderBy: { paymentDate: "asc" },
    });

    // Group by date string
    const grouped = {};
    for (const o of orders) {
      const date = o.paymentDate?.toISOString().split("T")[0];
      if (!date) continue;
      if (!grouped[date]) grouped[date] = { date, profit: 0, revenue: 0, orders: 0 };
      grouped[date].profit += o.profit || 0;
      grouped[date].revenue += o.bankSettlement || 0;
      grouped[date].orders += 1;
    }

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load chart data" });
  }
});

// ─── GET /api/dashboard/chart/orders ──────────────────────────────────────────
// Orders per day (last 30 days)
router.get("/chart/orders", async (req, res) => {
  try {
    const userId = req.userId;
    const days = parseInt(req.query.days || "30");

    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await prisma.order.findMany({
      where: { userId, dispatchDate: { gte: since } },
      select: { dispatchDate: true, isMatched: true },
      orderBy: { dispatchDate: "asc" },
    });

    const grouped = {};
    for (const o of orders) {
      const date = o.dispatchDate?.toISOString().split("T")[0];
      if (!date) continue;
      if (!grouped[date]) grouped[date] = { date, total: 0, matched: 0 };
      grouped[date].total += 1;
      if (o.isMatched) grouped[date].matched += 1;
    }

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load chart data" });
  }
});

module.exports = router;
