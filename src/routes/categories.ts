import { Router } from 'express';
import * as categoryController from '../controllers/categoryController';

const router = Router();

// Category Management
router.get('/', categoryController.getAllCategories);
router.post('/', categoryController.createCategory);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

export default router;
