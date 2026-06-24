import { Request, Response } from 'express';
import { 
  getProducts as getProductsService, 
  createProduct as createProductService, 
  simulateConcurrentWrites 
} from '../services/product.service.js';
import { PaginationParams } from '../types/product.js';

/**
 * GET /api/products
 * Fetch paginated products with optional category, cursor, and snapshot filtering.
 */
export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string || undefined;
    const cursor = req.query.cursor as string || undefined;
    const snapshot = req.query.snapshot as string || undefined;

    const params: PaginationParams = {
      limit,
      category,
      cursor,
      snapshot,
    };

    const result = await getProductsService(params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

/**
 * POST /api/products
 * Create a new product.
 */
export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, price } = req.body;

    if (!name || !category || price === undefined) {
      res.status(400).json({ error: 'Missing required fields: name, category, price' });
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({ error: 'Price must be a positive number' });
      return;
    }

    const product = await createProductService(name, category, parsedPrice);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

/**
 * POST /api/products/simulate
 * Simulates N new insertions and M random updates (default 25 each, total 50 writes).
 */
export async function simulateWrites(req: Request, res: Response): Promise<void> {
  try {
    const newCount = parseInt(req.body.newCount) ?? 25;
    const updateCount = parseInt(req.body.updateCount) ?? 25;

    if (isNaN(newCount) || isNaN(updateCount) || newCount < 0 || updateCount < 0) {
      res.status(400).json({ error: 'Counts must be non-negative integers' });
      return;
    }

    const result = await simulateConcurrentWrites(newCount, updateCount);
    res.json({
      message: `Successfully simulated ${result.insertedCount} insertions and ${result.updatedCount} updates.`,
      details: result,
    });
  } catch (error) {
    console.error('Error simulating writes:', error);
    res.status(500).json({ error: 'Failed to simulate concurrent writes' });
  }
}
