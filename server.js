require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Log DATABASE_URL on startup (masked)
const dbUrl = process.env.DATABASE_URL || "NOT SET";
console.log("DATABASE_URL starts with:", dbUrl.substring(0, 30));
console.log("NODE_ENV:", process.env.NODE_ENV);

app.use(cors({
  origin: "*", // Allow all origins temporarily for debugging
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authRoutes = require("./routes/auth");
const skuRoutes = require("./routes/sku");
const uploadRoutes = require("./routes/upload");
const ordersRoutes = require("./routes/orders");
const dashboardRoutes = require("./routes/dashboard");
const resetRoutes = require("./routes/reset");

app.use("/api/auth", authRoutes);
app.use("/api/sku", skuRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reset", resetRoutes);

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    db: process.env.DATABASE_URL ? "set" : "NOT SET"
  });
});

app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({ success: false, message: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
