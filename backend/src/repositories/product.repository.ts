import { query } from '../db/postgres.js';
import { Product } from '../types/product.js';

/**
 * Find products using keyset (cursor) pagination and snapshot isolation.
 * Fetches limit + 1 items to determine if there is a next page.
 */
export async function findProducts(params: {
  category?: string;
  snapshot: string;
  cursorUpdatedAt?: Date;
  cursorId?: string;
  limit: number;
}): Promise<Product[]> {
  const { category, snapshot, cursorUpdatedAt, cursorId, limit } = params;
  
  const conditions: string[] = [];
  const sqlParams: any[] = [];
  let paramIndex = 1;

  // 1. Apply snapshot isolation
  conditions.push(`updated_at <= $${paramIndex++}`);
  sqlParams.push(snapshot);

  // 2. Apply optional category filter
  if (category) {
    conditions.push(`category = $${paramIndex++}`);
    sqlParams.push(category);
  }

  // 3. Apply keyset pagination cursor
  if (cursorUpdatedAt && cursorId) {
    conditions.push(`(
      updated_at < $${paramIndex}
      OR (updated_at = $${paramIndex} AND id < $${paramIndex + 1})
    )`);
    sqlParams.push(cursorUpdatedAt, cursorId);
    paramIndex += 2;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const sqlQuery = `
    SELECT id, name, category, price, created_at, updated_at
    FROM products
    ${whereClause}
    ORDER BY updated_at DESC, id DESC
    LIMIT $${paramIndex}
  `;
  sqlParams.push(limit + 1);

  const result = await query(sqlQuery, sqlParams);
  
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: parseFloat(row.price),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * Insert a new product into the database.
 */
export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const sqlQuery = `
    INSERT INTO products (name, category, price)
    VALUES ($1, $2, $3)
    RETURNING id, name, category, price, created_at, updated_at
  `;
  const result = await query(sqlQuery, [product.name, product.category, product.price]);
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: parseFloat(row.price),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Update the updated_at timestamp of N random products.
 */
export async function updateRandomProducts(count: number): Promise<Product[]> {
  const selectQuery = `
    SELECT id FROM products
    ORDER BY random()
    LIMIT $1
  `;
  const selectResult = await query(selectQuery, [count]);
  const ids = selectResult.rows.map(row => row.id);

  if (ids.length === 0) return [];

  const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');
  const updateQuery = `
    UPDATE products
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
    RETURNING id, name, category, price, created_at, updated_at
  `;
  const updateResult = await query(updateQuery, ids);
  
  return updateResult.rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: parseFloat(row.price),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}
