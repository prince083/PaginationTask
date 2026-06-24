import { initDb, pool, query } from '../db/postgres.js';

const CATEGORIES = ['Electronics', 'Books', 'Fashion', 'Home', 'Sports', 'Toys'];
const ADJECTIVES = ['Wireless', 'Ultra', 'Smart', 'Premium', 'Eco', 'Classic', 'Portable', 'Digital', 'Pro', 'Ergonomic', 'Advanced', 'Deluxe', 'Organic', 'Modern', 'Compact'];
const NOUNS = ['Gadget', 'Device', 'Book', 'Jacket', 'Shoes', 'Organizer', 'Planner', 'Mat', 'Bottle', 'Lamp', 'Chair', 'Backpack', 'Headphones', 'Watch', 'Speaker'];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateProductName(category: string): string {
  const adj = getRandomElement(ADJECTIVES);
  const noun = getRandomElement(NOUNS);
  return `${adj} ${category} ${noun}`;
}

async function seed() {
  const startTime = Date.now();
  console.log('Starting high-performance seeding script...');

  // Ensure database schema exists
  await initDb();

  console.log('Truncating existing products...');
  await query('TRUNCATE TABLE products');

  const totalProducts = 200000;
  const batchSize = 5000;
  const totalBatches = totalProducts / batchSize;
  
  // Stagger timestamps over the past 30 days
  // 30 days = 2,592,000 seconds. 
  // Stagger = 2,592,000 / 200,000 = ~13 seconds per product
  const secondsPerProduct = 13;
  const baseTime = Date.now();

  console.log(`Generating and inserting ${totalProducts} products in ${totalBatches} batches...`);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (let i = 0; i < batchSize; i++) {
      const globalIndex = batchNum * batchSize + i;
      const category = getRandomElement(CATEGORIES);
      const name = `${generateProductName(category)} #${globalIndex + 1}`;
      const price = parseFloat((Math.random() * 990 + 10).toFixed(2)); // $10 to $1000
      
      // Calculate a unique staggered timestamp
      const productAgeSeconds = globalIndex * secondsPerProduct;
      const timestamp = new Date(baseTime - productAgeSeconds * 1000);

      params.push(name, category, price, timestamp, timestamp);
      valuePlaceholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
      paramIndex += 5;
    }

    const insertQuery = `
      INSERT INTO products (name, category, price, created_at, updated_at)
      VALUES ${valuePlaceholders.join(', ')}
    `;

    await query(insertQuery, params);

    if ((batchNum + 1) % 10 === 0 || batchNum + 1 === totalBatches) {
      const percentage = (((batchNum + 1) / totalBatches) * 100).toFixed(0);
      console.log(`Seeding progress: ${percentage}% (${(batchNum + 1) * batchSize}/${totalProducts} products inserted)`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Seeding completed successfully in ${duration} seconds.`);
  
  // Verify row count
  const countRes = await query('SELECT COUNT(*) FROM products');
  console.log(`Verified total products in database: ${countRes.rows[0].count}`);
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err);
  })
  .finally(() => {
    pool.end();
  });
