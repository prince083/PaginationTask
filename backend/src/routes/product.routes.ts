import { Router } from 'express';
import { getProducts, createProduct, simulateWrites } from '../controllers/product.controller.js';

const router = Router();

// GET /api/products - paginated retrieval
router.get('/', getProducts);

// POST /api/products - create a product
router.post('/', createProduct);

// POST /api/products/simulate - trigger concurrent writes (inserts/updates)
router.post('/simulate', simulateWrites);

export default router;
