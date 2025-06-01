import { Router, Request, Response, NextFunction } from 'express';
import * as productController from '../controllers/productController';
import { authenticateJWT, authorizeRoles, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router(); 

// Public
router.get('/', productController.getAllProducts);
router.get('/:id', (req, res, next) => { void productController.getProductById(req, res, next); });

// Admin only
router.post('/', authenticateJWT, authorizeRoles('admin'), upload.array('images', 5), (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  productController.createProduct(authReq, res, next);
});

router.put('/:id', authenticateJWT, authorizeRoles('admin'), upload.array('images', 5), (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  productController.updateProduct(authReq, res, next);
});

router.delete('/:id', authenticateJWT, authorizeRoles('admin'), (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  productController.deleteProduct(authReq, res, next);
});

export default router;
