// fix-all.js
// Run this from backend folder: node fix-all.js
// This will: 1) Delete all orders 2) Confirm deletion

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('  ProfitTracker - Fix Script');
  console.log('========================================\n');

  // Step 1: Delete all orders
  console.log('Step 1: Deleting all orders...');
  const orders = await prisma.order.deleteMany({});
  console.log(`✅ Deleted ${orders.count} orders\n`);

  // Step 2: Delete all SKUs (fresh start)
  console.log('Step 2: Deleting all SKUs...');
  const skus = await prisma.sKU.deleteMany({});
  console.log(`✅ Deleted ${skus.count} SKUs\n`);

  // Step 3: Verify DB is empty
  const orderCount = await prisma.order.count();
  const skuCount = await prisma.sKU.count();
  console.log('Step 3: Verification...');
  console.log(`   Orders remaining: ${orderCount}`);
  console.log(`   SKUs remaining:   ${skuCount}`);

  if (orderCount === 0 && skuCount === 0) {
    console.log('\n✅ Database is completely clean!');
    console.log('\n========================================');
    console.log('  NEXT STEPS:');
    console.log('  1. Go to localhost:3000/sku');
    console.log('     Add: SKU001=300, SKU002=200,');
    console.log('           SKU003=500, SKU004=800, SKU005=400');
    console.log('  2. Go to localhost:3000/upload');
    console.log('     Upload: TEST_Pickup_Report.csv');
    console.log('     Upload: TEST_Settlement_Report.xlsx');
    console.log('  3. Go to localhost:3000/orders');
    console.log('     All 10 orders should show MATCHED!');
    console.log('========================================\n');
  } else {
    console.log('\n❌ Something went wrong - records still exist');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
