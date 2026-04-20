require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

console.log("DATABASE_URL starts with:", (process.env.DATABASE_URL || "NOT SET").substring(0, 40));

// Run prisma db push on startup
async function setupDatabase() {
  try {
    const { execSync } = require("child_process");
    console.log("Running prisma db push...");
    execSync("node ./node_modules/prisma/build/index.js db push --accept-data-loss", { 
      stdio: "inherit",
      env: process.env 
    });
    console.log("✅ Database tables ready");
  } catch (err) {
    console.error("DB push error:", err.message);
  }
}

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authRoutes      = require("./routes/auth");
const skuRoutes       = require("./routes/sku");
const uploadRoutes    = require("./routes/upload");
const ordersRoutes    = require("./routes/orders");
const dashboardRoutes = require("./routes/dashboard");
const resetRoutes     = require("./routes/reset");

app.use("/api/auth",      authRoutes);
app.use("/api/sku",       skuRoutes);
app.use("/api/upload",    uploadRoutes);
app.use("/api/orders",    ordersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reset",     resetRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({ success: false, message: err.message });
});

// Start server AFTER database setup
setupDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
});
