import { Router } from 'express';
import * as productController from '../controllers/productController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Public Routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin Routes
router.post('/', authenticateJWT, authorizeRoles('admin'), upload.array('images', 5), productController.createProduct);
router.put('/:id', authenticateJWT, authorizeRoles('admin'), upload.array('images', 5), productController.updateProduct);
router.delete('/:id', authenticateJWT, authorizeRoles('admin'), productController.deleteProduct);
router.patch('/:id/stock', authenticateJWT, authorizeRoles('admin'), productController.updateStock);
router.patch('/:id/featured', authenticateJWT, authorizeRoles('admin'), productController.toggleFeatured);

// Product Image Management
router.post('/:id/images', authenticateJWT, authorizeRoles('admin'), upload.array('images', 5), productController.uploadImages);
router.delete('/:id/images/:imageId', authenticateJWT, authorizeRoles('admin'), productController.deleteImage);
router.put('/:id/images/reorder', authenticateJWT, authorizeRoles('admin'), productController.reorderImages);

export default router;
