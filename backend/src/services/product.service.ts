import { 
  findProducts as findProductsDb, 
  createProduct as createProductDb, 
  updateRandomProducts 
} from '../repositories/product.repository.js';
import { Cursor, PaginatedResponse, PaginationParams, Product } from '../types/product.js';

/**
 * Fetch a paginated list of products.
 * Handles cursor decoding, snapshot assignment, and next-cursor generation.
 */
export async function getProducts(params: PaginationParams): Promise<PaginatedResponse> {
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);
  
  const snapshot = params.snapshot || new Date().toISOString();
  
  let cursorUpdatedAt: Date | undefined;
  let cursorId: string | undefined;

  if (params.cursor) {
    try {
      const decodedString = Buffer.from(params.cursor, 'base64').toString('utf8');
      const cursorDataObj: Cursor = JSON.parse(decodedString);
      if (cursorDataObj.updatedAt && cursorDataObj.id) {
        cursorUpdatedAt = new Date(cursorDataObj.updatedAt);
        cursorId = cursorDataObj.id;
      }
    } catch (err) {
      console.warn('Invalid cursor format provided. Ignoring cursor.', err);
    }
  }

  // Query the repository functions directly
  const products = await findProductsDb({
    category: params.category,
    snapshot,
    cursorUpdatedAt,
    cursorId,
    limit,
  });

  const hasMore = products.length > limit;
  const paginatedData = hasMore ? products.slice(0, limit) : products;

  let nextCursor: string | null = null;
  if (hasMore && paginatedData.length > 0) {
    const lastItem = paginatedData[paginatedData.length - 1];
    const cursorObj: Cursor = {
      updatedAt: lastItem.updated_at.toISOString(),
      id: lastItem.id,
    };
    const jsonStr = JSON.stringify(cursorObj);
    nextCursor = Buffer.from(jsonStr, 'utf8').toString('base64');
  }

  return {
    data: paginatedData,
    pagination: {
      nextCursor,
      snapshot,
      hasMore,
    },
  };
}

/**
 * Helper to create a single product.
 */
export async function createProduct(name: string, category: string, price: number): Promise<Product> {
  return createProductDb({ name, category, price });
}

/**
 * Simulates concurrent writes by inserting N new products and updating M existing products.
 */
export async function simulateConcurrentWrites(newCount: number, updateCount: number) {
  const categories = ['Electronics', 'Books', 'Fashion', 'Home', 'Sports', 'Toys'];
  const inserted: Product[] = [];
  
  const timestampLabel = new Date().toLocaleTimeString();
  for (let i = 0; i < newCount; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const product = await createProductDb({
      name: `Concurrent Product (New) - ${timestampLabel} #${i + 1}`,
      category,
      price: parseFloat((Math.random() * 200 + 5).toFixed(2)),
    });
    inserted.push(product);
  }

  const updated = await updateRandomProducts(updateCount);

  return {
    insertedCount: inserted.length,
    updatedCount: updated.length,
    insertedItems: inserted,
    updatedItems: updated,
  };
}
