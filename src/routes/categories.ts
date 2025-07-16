import { Router } from 'express';
import {
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
} from '../controllers/categoryController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Get all categories (with optional parent filter)
router.get('/', getAllCategories);

// Get category by ID
router.get('/:id', getCategoryById);

// Get category by slug
router.get('/slug/:slug', getCategoryBySlug);

// Get subcategories of a category
router.get('/:id/subcategories', getSubcategories);

// Create new category (admin only)
router.post('/', authenticateJWT, createCategory);

// Update category (admin only)
router.put('/:id', authenticateJWT, updateCategory);

// Delete category (admin only)
router.delete('/:id', authenticateJWT, deleteCategory);

export default router;
