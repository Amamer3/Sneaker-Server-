import { Router, RequestHandler, Response, NextFunction } from 'express';
import * as productController from '../controllers/productController';
import { authenticateJWT, authorizeRoles, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Wrapper function to handle async route handlers
const wrapHandler = (handler: (req: any, res: Response, next: NextFunction) => Promise<any>): RequestHandler => 
  (req, res, next) => handler(req, res, next).catch(next);

// Public Routes
router.get('/', wrapHandler(productController.getAllProducts));
router.get('/:id', wrapHandler(productController.getProductById));

// Admin Routes
router.post('/', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  upload.array('images', 5), 
  wrapHandler(productController.createProduct)
);

router.put('/:id', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  upload.array('images', 5), 
  wrapHandler(productController.updateProduct)
);

router.delete('/:id', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  wrapHandler(productController.deleteProduct)
);

router.patch('/:id/stock', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  wrapHandler(productController.updateStock)
);

router.patch('/:id/featured', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  wrapHandler(productController.toggleFeatured)
);

// Product Image Management
router.post('/:id/images', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  upload.array('images', 5), 
  wrapHandler(productController.uploadImages)
);

router.delete('/:id/images/:imageId', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  wrapHandler(productController.deleteImage)
);

router.put('/:id/images/reorder', 
  authenticateJWT, 
  authorizeRoles('admin'), 
  wrapHandler(productController.reorderImages)
);

export default router;
