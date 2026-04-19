// server.js - Main Express Server

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { execSync } = require("child_process");

// ─── Auto-run Prisma on startup (for Railway deployment) ──────────────────────
try {
  console.log("Running Prisma generate...");
  execSync("node ./node_modules/prisma/build/index.js generate", { stdio: "inherit" });
  console.log("Running Prisma db push...");
  execSync("node ./node_modules/prisma/build/index.js db push --accept-data-loss", { stdio: "inherit" });
  console.log("✅ Database ready");
} catch (err) {
  console.error("Prisma setup error:", err.message);
}

// Route imports
const authRoutes = require("./routes/auth");
const skuRoutes = require("./routes/sku");
const uploadRoutes = require("./routes/upload");
const ordersRoutes = require("./routes/orders");
const dashboardRoutes = require("./routes/dashboard");
const resetRoutes = require("./routes/reset");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/sku", skuRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reset", resetRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
