// utils/fileParser.js
// Parses Pickup Report (CSV) and Settlement Report (Excel) into normalized objects

const XLSX = require("xlsx");

// ─── Normalize Order Item ID ──────────────────────────────────────────────────
// Strips leading apostrophe ('), spaces, and any non-numeric prefix
// Your Flipkart CSV exports IDs with a leading ' e.g. '437327983469739100
function normalizeId(val) {
  if (!val) return "";
  return String(val)
    .trim()
    .replace(/^'+/, "")   // strip leading apostrophes
    .trim();
}

// ─── Parse Pickup Report (CSV or Excel) ──────────────────────────────────────
// Required columns: ORDER ITEM ID, Order Id, SKU, Dispatch by date
function parsePickupReport(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) throw new Error("Pickup report is empty");

  // Validate required columns
  const required = ["ORDER ITEM ID", "Order Id", "SKU", "Dispatch by date"];
  const missing = required.filter((col) => !rows[0].hasOwnProperty(col));
  if (missing.length)
    throw new Error(`Pickup report missing columns: ${missing.join(", ")}`);

  const records = [];

  for (const row of rows) {
    // Strip leading apostrophe that Flipkart CSV adds to prevent Excel from
    // treating the numeric ID as a number e.g. '437327983469739100 → 437327983469739100
    const orderItemId = normalizeId(row["ORDER ITEM ID"]);
    if (!orderItemId) continue; // skip empty rows

    records.push({
      orderItemId,
      orderId: normalizeId(row["Order Id"]),
      skuId: String(row["SKU"] || "").trim(),
      dispatchDate: parseDate(row["Dispatch by date"]),
    });
  }

  if (!records.length) throw new Error("No valid records found in Pickup report");
  return records;
}

// ─── Parse Settlement Report (Excel, multi-sheet) ────────────────────────────
// Reads the "Orders" sheet only
// Headers are at row index 0 (first row of sheet), actual data starts at row index 2
// Required columns: Order item ID (col7), Order ID (col6), Bank Settlement Value (col2), Payment Date (col1)
function parseSettlementReport(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  // Must have an "Orders" sheet
  if (!workbook.SheetNames.includes("Orders"))
    throw new Error('Settlement report must contain an "Orders" sheet');

  const sheet = workbook.Sheets["Orders"];

  // Read raw with no header parsing - we handle headers manually
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (raw.length < 3) throw new Error("Settlement report Orders sheet has no data");

  // Row 0 = actual column headers (Payment Details, Unnamed:1... but row[0] values are real names)
  const headerRow = raw[0]; // ["Payment Details", "Unnamed:1", ...]
  // Row 1 = sub-headers (skip)
  // Row 2+ = data

  // Map by known column positions (verified from your actual file):
  // Col 0 = NEFT ID, Col 1 = Payment Date, Col 2 = Bank Settlement Value
  // Col 6 = Order ID, Col 7 = Order item ID

  const COLS = {
    paymentDate: 1,
    bankSettlement: 2,
    orderId: 6,
    orderItemId: 7,
  };

  const records = [];

  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];

    const orderItemId = normalizeId(row[COLS.orderItemId]);
    if (!orderItemId || orderItemId === "undefined") continue;

    const bankSettlement = parseFloat(row[COLS.bankSettlement]);

    records.push({
      orderItemId,
      orderId: normalizeId(row[COLS.orderId]),
      bankSettlement: isNaN(bankSettlement) ? 0 : bankSettlement,
      paymentDate: parseDate(row[COLS.paymentDate]),
    });
  }

  if (!records.length) throw new Error("No valid records found in Settlement report");
  return records;
}

// ─── Helper: normalize various date formats ───────────────────────────────────
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

module.exports = { parsePickupReport, parseSettlementReport };
