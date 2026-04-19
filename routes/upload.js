// routes/upload.js - File Upload & Processing

const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/auth");
const { parsePickupReport, parseSettlementReport } = require("../utils/fileParser");
const { processReport } = require("../utils/matcher");

// Memory storage - no files saved to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    // Also allow by extension
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ["csv", "xlsx", "xls"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

router.use(authMiddleware);

// ─── POST /api/upload/pickup ──────────────────────────────────────────────────
router.post("/pickup", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    // Parse the file
    const records = parsePickupReport(req.file.buffer);

    // Process and upsert into DB
    const result = await processReport(req.userId, "pickup", records);

    res.json({
      success: true,
      message: `Pickup report processed: ${result.created} new, ${result.updated} updated`,
      data: {
        totalRecords: records.length,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      },
    });
  } catch (err) {
    console.error("Pickup upload error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── POST /api/upload/settlement ──────────────────────────────────────────────
router.post("/settlement", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    // Parse the settlement Excel file (reads Orders sheet)
    const records = parseSettlementReport(req.file.buffer);

    // Process and upsert into DB
    const result = await processReport(req.userId, "settlement", records);

    res.json({
      success: true,
      message: `Settlement report processed: ${result.created} new, ${result.updated} updated`,
      data: {
        totalRecords: records.length,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      },
    });
  } catch (err) {
    console.error("Settlement upload error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
