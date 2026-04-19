// routes/sku.js - SKU CRUD + Bulk Upload

const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth");

const prisma = new PrismaClient();

// Multer for SKU bulk upload (memory storage, no disk write)
const upload = multer({ storage: multer.memoryStorage() });

// All routes protected
router.use(authMiddleware);

// ─── GET /api/sku - Get all SKUs for user ─────────────────────────────────────
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

// ─── POST /api/sku - Add single SKU ──────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { skuId, purchasePrice } = req.body;

    if (!skuId || purchasePrice === undefined)
      return res.status(400).json({ success: false, message: "skuId and purchasePrice are required" });

    const price = parseFloat(purchasePrice);
    if (isNaN(price) || price < 0)
      return res.status(400).json({ success: false, message: "Invalid purchase price" });

    // Upsert: update if exists, create if not
    const sku = await prisma.sKU.upsert({
      where: { skuId_userId: { skuId: skuId.trim(), userId: req.userId } },
      update: { purchasePrice: price },
      create: { skuId: skuId.trim(), purchasePrice: price, userId: req.userId },
    });

    res.status(201).json({ success: true, message: "SKU saved", data: sku });
  } catch (err) {
    console.error("Add SKU error:", err);
    res.status(500).json({ success: false, message: "Failed to save SKU" });
  }
});

// ─── PUT /api/sku/:id - Update SKU ───────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { purchasePrice } = req.body;
    const id = parseInt(req.params.id);

    const price = parseFloat(purchasePrice);
    if (isNaN(price) || price < 0)
      return res.status(400).json({ success: false, message: "Invalid purchase price" });

    // Ensure SKU belongs to user
    const existing = await prisma.sKU.findFirst({ where: { id, userId: req.userId } });
    if (!existing)
      return res.status(404).json({ success: false, message: "SKU not found" });

    const sku = await prisma.sKU.update({
      where: { id },
      data: { purchasePrice: price },
    });

    res.json({ success: true, message: "SKU updated", data: sku });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update SKU" });
  }
});

// ─── DELETE /api/sku/:id - Delete SKU ────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.sKU.findFirst({ where: { id, userId: req.userId } });
    if (!existing)
      return res.status(404).json({ success: false, message: "SKU not found" });

    await prisma.sKU.delete({ where: { id } });
    res.json({ success: true, message: "SKU deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete SKU" });
  }
});

// ─── POST /api/sku/bulk - Bulk upload SKUs from CSV/Excel ────────────────────
router.post("/bulk", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    // Parse file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length)
      return res.status(400).json({ success: false, message: "File is empty" });

    // Validate columns
    const first = rows[0];
    if (!first.hasOwnProperty("SKU_ID") || !first.hasOwnProperty("Purchase_Price"))
      return res.status(400).json({
        success: false,
        message: "CSV must have columns: SKU_ID, Purchase_Price",
      });

    let saved = 0, errors = [];

    for (const row of rows) {
      const skuId = String(row.SKU_ID || "").trim();
      const price = parseFloat(row.Purchase_Price);

      if (!skuId || isNaN(price)) {
        errors.push(`Skipped row: SKU_ID="${row.SKU_ID}", Price="${row.Purchase_Price}"`);
        continue;
      }

      await prisma.sKU.upsert({
        where: { skuId_userId: { skuId, userId: req.userId } },
        update: { purchasePrice: price },
        create: { skuId, purchasePrice: price, userId: req.userId },
      });
      saved++;
    }

    res.json({
      success: true,
      message: `${saved} SKUs saved successfully`,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error("Bulk SKU error:", err);
    res.status(500).json({ success: false, message: "Failed to process file" });
  }
});

module.exports = router;
