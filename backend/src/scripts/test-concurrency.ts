import { pool, query } from '../db/postgres.js';
import { getProducts, simulateConcurrentWrites } from '../services/product.service.js';
import { Product } from '../types/product.js';

async function runConcurrencyTest() {
  console.log('===================================================');
  console.log('🧪 RUNNING CONCURRENCY & PAGINATION CONSISTENCY TEST');
  console.log('===================================================');

  // 1. Fetch Page 1 (This will establish the snapshot timestamp)
  console.log('Step 1: Requesting Page 1...');
  const page1 = await getProducts({ limit: 20 });
  const snapshot = page1.pagination.snapshot;
  
  console.log(`%c✅ Page 1 Loaded: Received ${page1.data.length} products.`, 'color: #10b981');
  console.log(`🔒 Snapshot isolation established at: ${snapshot}`);
  console.log(`🎫 Next Cursor: ${page1.pagination.nextCursor?.slice(0, 15)}...`);

  // Record the IDs we have seen so far
  const seenIds = new Set<string>(page1.data.map(p => p.id));
  const page1Products = [...page1.data];

  // 2. Simulate concurrent writes: Insert/Update 50 products in the background
  console.log('\nStep 2: Simulating 50 concurrent writes (25 inserts, 25 updates)...');
  const simulationResult = await simulateConcurrentWrites(25, 25);
  console.log(`⚡ Background writes completed in DB.`);
  console.log(`   - New items inserted: ${simulationResult.insertedItems.length}`);
  console.log(`   - Existing items updated: ${simulationResult.updatedItems.length}`);

  // Create sets of inserted and updated IDs for validation
  const insertedIds = new Set(simulationResult.insertedItems.map(p => p.id));

  // 3. Paginate through the remaining products (fetching up to 10 more pages)
  console.log('\nStep 3: Paginating through subsequent pages using the locked snapshot...');
  let currentCursor = page1.pagination.nextCursor;
  let pageNum = 2;
  const allLoadedProducts: Product[] = [...page1Products];
  let duplicatesFound = 0;
  let snapshotViolations = 0;

  while (currentCursor && pageNum <= 10) {
    const response = await getProducts({
      limit: 20,
      cursor: currentCursor,
      snapshot: snapshot || undefined, // Enforce the same snapshot
    });

    console.log(`   - Page ${pageNum} loaded: ${response.data.length} products (Cursor: ${currentCursor.slice(0, 10)}...)`);

    for (const product of response.data) {
      // Check for duplicates
      if (seenIds.has(product.id)) {
        console.error(`❌ DUPLICATE DETECTED: Product ID ${product.id} ("${product.name}") seen twice!`);
        duplicatesFound++;
      }
      
      // Check for snapshot violation (should not see newly inserted products)
      if (insertedIds.has(product.id)) {
        console.error(`❌ SNAPSHOT VIOLATION: Newly inserted product ${product.id} ("${product.name}") appeared in snapshot feed!`);
        snapshotViolations++;
      }
      
      seenIds.add(product.id);
      allLoadedProducts.push(product);
    }

    currentCursor = response.pagination.nextCursor;
    pageNum++;
  }

  console.log('\n===================================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('===================================================');
  console.log(`Total products loaded: ${allLoadedProducts.length}`);
  console.log(`Duplicates detected:   ${duplicatesFound}`);
  console.log(`Snapshot violations:   ${snapshotViolations}`);

  let testPassed = true;

  if (duplicatesFound > 0) {
    console.log('❌ TEST FAILED: Duplicates were found in the pagination stream.');
    testPassed = false;
  } else {
    console.log('✅ PASS: Zero duplicates detected across all paginated pages.');
  }

  if (snapshotViolations > 0) {
    console.log('❌ TEST FAILED: Newly inserted products bled into the locked snapshot.');
    testPassed = false;
  } else {
    console.log('✅ PASS: Zero snapshot violations. Newer background inserts were successfully isolated.');
  }

  // Double check that keyset order is correct (newest first: updated_at DESC, id DESC)
  let orderErrors = 0;
  for (let i = 0; i < allLoadedProducts.length - 1; i++) {
    const curr = allLoadedProducts[i];
    const next = allLoadedProducts[i + 1];
    
    const currTime = curr.updated_at.getTime();
    const nextTime = next.updated_at.getTime();

    if (currTime < nextTime || (currTime === nextTime && curr.id < next.id)) {
      console.error(`❌ ORDER ERROR at index ${i}: Product ${curr.id} is older than ${next.id} but appeared first.`);
      orderErrors++;
    }
  }

  if (orderErrors > 0) {
    console.log(`❌ TEST FAILED: ${orderErrors} sorting order discrepancies detected.`);
    testPassed = false;
  } else {
    console.log('✅ PASS: Keyset sort order (updated_at DESC, id DESC) is perfectly consistent.');
  }

  if (testPassed) {
    console.log('\n🎉 ALL CONCURRENCY AND PAGINATION TESTS PASSED SUCCESFULLY!');
  } else {
    console.log('\n🔴 SOME TESTS FAILED. Please check the logs above.');
  }
  console.log('===================================================');
}

runConcurrencyTest()
  .catch(err => {
    console.error('Test runner failed:', err);
  })
  .finally(() => {
    pool.end();
  });
