import express from 'express';
import { inventoryController } from '../controllers/inventoryController';
import { authenticateJWT } from '../middleware/auth';
import { validateRequest } from '../middleware/zodValidation';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const bulkCheckSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.string().min(1, 'Product ID is required'),
      quantity: z.number().positive('Quantity must be positive'),
      locationId: z.string().optional().default('main')
    })).min(1, 'At least one item is required')
  })
});

const updateStockSchema = z.object({
  body: z.object({
    quantity: z.number(),
    type: z.enum(['adjustment', 'sale', 'purchase', 'return', 'damage', 'transfer']),
    reason: z.string().optional(),
    reference: z.string().optional(),
    locationId: z.string().optional().default('main')
  }),
  params: z.object({
    productId: z.string().min(1, 'Product ID is required')
  })
});

// Public routes (for checking stock during checkout)
/**
 * @swagger
 * /api/inventory/bulk-check:
 *   post:
 *     summary: Bulk check stock availability
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     locationId:
 *                       type: string
 *                       default: main
 *     responses:
 *       200:
 *         description: Stock check results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 allAvailable:
 *                   type: boolean
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                       available:
 *                         type: boolean
 *                       requestedQuantity:
 *                         type: number
 *                       availableQuantity:
 *                         type: number
 *                       totalQuantity:
 *                         type: number
 *                       reservedQuantity:
 *                         type: number
 */
router.post('/bulk-check', validateRequest(bulkCheckSchema), inventoryController.bulkCheckStock);

// Protected routes (require authentication)
/**
 * @swagger
 * /api/inventory/{productId}:
 *   get:
 *     summary: Get product inventory
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: string
 *           default: main
 *     responses:
 *       200:
 *         description: Product inventory details
 *       404:
 *         description: Product inventory not found
 */
router.get('/:productId', authenticateJWT, inventoryController.getProductInventory);

/**
 * @swagger
 * /api/inventory/{productId}/update:
 *   put:
 *     summary: Update product stock
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [adjustment, sale, purchase, return, damage, transfer]
 *               reason:
 *                 type: string
 *               reference:
 *                 type: string
 *               locationId:
 *                 type: string
 *                 default: main
 *     responses:
 *       200:
 *         description: Stock updated successfully
 *       400:
 *         description: Invalid request data
 */
router.put('/:productId/update', authenticateJWT, validateRequest(updateStockSchema), inventoryController.updateStock);

/**
 * @swagger
 * /api/inventory/low-stock:
 *   get:
 *     summary: Get low stock products
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: string
 *           default: main
 *     responses:
 *       200:
 *         description: List of low stock products
 */
router.get('/low-stock', authenticateJWT, inventoryController.getLowStockProducts);

/**
 * @swagger
 * /api/inventory/{productId}/movements:
 *   get:
 *     summary: Get stock movements for a product
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *     responses:
 *       200:
 *         description: Stock movement history
 */
router.get('/:productId/movements', authenticateJWT, inventoryController.getStockMovements);

export default router;