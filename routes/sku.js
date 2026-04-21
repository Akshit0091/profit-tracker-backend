// routes/sku.js - SKU CRUD + Bulk Upload + Missing SKUs

const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth");

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });
router.use(authMiddleware);

// ─── GET /api/sku - Get all SKUs ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const skus = await prisma.sKU.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: skus });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch SKUs" });
  }
});

// ─── GET /api/sku/missing - SKUs in orders but no price set ───────────────────
router.get("/missing", async (req, res) => {
  try {
    // Get all distinct SKU IDs from orders
    const orders = await prisma.order.findMany({
      where: { userId: req.userId, skuId: { not: null } },
      select: { skuId: true },
      distinct: ["skuId"],
    });

    // Get all SKU IDs that already have prices
    const existing = await prisma.sKU.findMany({
      where: { userId: req.userId },
      select: { skuId: true },
    });
    const existingIds = new Set(existing.map((s) => s.skuId.toLowerCase()));

    // Find missing ones
    const missing = orders
      .map((o) => o.skuId)
      .filter((id) => id && !existingIds.has(id.toLowerCase()));

    res.json({ success: true, data: missing });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch missing SKUs" });
  }
});

// ─── POST /api/sku - Add / update single SKU ──────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { skuId, purchasePrice } = req.body;
    if (!skuId || purchasePrice === undefined)
      return res.status(400).json({ success: false, message: "skuId and purchasePrice are required" });

    const price = parseFloat(purchasePrice);
    if (isNaN(price) || price < 0)
      return res.status(400).json({ success: false, message: "Invalid purchase price" });

    const sku = await prisma.sKU.upsert({
      where: { skuId_userId: { skuId: skuId.trim(), userId: req.userId } },
      update: { purchasePrice: price },
      create: { skuId: skuId.trim(), purchasePrice: price, userId: req.userId },
    });

    res.status(201).json({ success: true, message: "SKU saved", data: sku });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to save SKU" });
  }
});

// ─── PUT /api/sku/:id - Update SKU ────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { purchasePrice } = req.body;
    const id = parseInt(req.params.id);
    const price = parseFloat(purchasePrice);
    if (isNaN(price) || price < 0)
      return res.status(400).json({ success: false, message: "Invalid price" });

    const existing = await prisma.sKU.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ success: false, message: "SKU not found" });

    const sku = await prisma.sKU.update({ where: { id }, data: { purchasePrice: price } });
    res.json({ success: true, message: "SKU updated", data: sku });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update" });
  }
});

// ─── DELETE /api/sku/:id ──────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.sKU.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ success: false, message: "SKU not found" });
    await prisma.sKU.delete({ where: { id } });
    res.json({ success: true, message: "SKU deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

// ─── POST /api/sku/bulk - Bulk upload ─────────────────────────────────────────
router.post("/bulk", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) return res.status(400).json({ success: false, message: "File is empty" });

    const first = rows[0];
    if (!first.hasOwnProperty("SKU_ID") || !first.hasOwnProperty("Purchase_Price"))
      return res.status(400).json({ success: false, message: "CSV must have columns: SKU_ID, Purchase_Price" });

    let saved = 0, errors = [];
    for (const row of rows) {
      const skuId = String(row.SKU_ID || "").trim();
      const price = parseFloat(row.Purchase_Price);
      if (!skuId || isNaN(price)) { errors.push(`Skipped: SKU_ID="${row.SKU_ID}"`); continue; }
      await prisma.sKU.upsert({
        where: { skuId_userId: { skuId, userId: req.userId } },
        update: { purchasePrice: price },
        create: { skuId, purchasePrice: price, userId: req.userId },
      });
      saved++;
    }

    res.json({ success: true, message: `${saved} SKUs saved`, errors: errors.length ? errors : undefined });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to process file" });
  }
});

module.exports = router;
