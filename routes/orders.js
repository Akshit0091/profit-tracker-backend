// routes/orders.js - Orders Table: list, search, filter, sort, export

const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth");

const prisma = new PrismaClient();
router.use(authMiddleware);

// ─── GET /api/orders ──────────────────────────────────────────────────────────
// Query params: search, status (matched|pending), sortBy, sortDir, page, limit, dateFrom, dateTo
router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      status = "all",       // all | matched | pending
      sortBy = "createdAt", // createdAt | profit | paymentDate | dispatchDate | bankSettlement
      sortDir = "desc",     // asc | desc
      page = "1",
      limit = "50",
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = { userId: req.userId };

    if (search) {
      where.OR = [
        { orderItemId: { contains: search, mode: "insensitive" } },
        { orderId: { contains: search, mode: "insensitive" } },
        { skuId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status === "matched") where.isMatched = true;
    if (status === "pending") where.isMatched = false;

    if (dateFrom || dateTo) {
      where.paymentDate = {};
      if (dateFrom) where.paymentDate.gte = new Date(dateFrom);
      if (dateTo) where.paymentDate.lte = new Date(dateTo);
    }

    // Valid sort fields
    const validSort = ["createdAt", "profit", "paymentDate", "dispatchDate", "bankSettlement"];
    const orderField = validSort.includes(sortBy) ? sortBy : "createdAt";
    const orderDir = sortDir === "asc" ? "asc" : "desc";

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { [orderField]: orderDir },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// ─── DELETE /api/orders/all - Delete all orders for this user ─────────────────
router.delete("/all", async (req, res) => {
  try {
    const result = await prisma.order.deleteMany({ where: { userId: req.userId } });
    res.json({ success: true, message: `Deleted ${result.count} orders` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/orders/export ───────────────────────────────────────────────────
// Export all matched orders as CSV
router.get("/export", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId, isMatched: true },
      orderBy: { paymentDate: "desc" },
    });

    // Build CSV-ready data
    const rows = orders.map((o) => ({
      "Order Item ID": o.orderItemId,
      "Order ID": o.orderId || "",
      "SKU ID": o.skuId || "",
      "Dispatch Date": o.dispatchDate ? o.dispatchDate.toISOString().split("T")[0] : "",
      "Payment Date": o.paymentDate ? o.paymentDate.toISOString().split("T")[0] : "",
      "Bank Settlement (Rs.)": o.bankSettlement ?? "",
      "Purchase Price (Rs.)": o.purchasePrice ?? "",
      "Profit (Rs.)": o.profit ?? "",
      Status: o.profit !== null ? (o.profit >= 0 ? "Profit" : "Loss") : "Unknown",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Profit Report");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="profit-report-${Date.now()}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ success: false, message: "Failed to export" });
  }
});

module.exports = router;
