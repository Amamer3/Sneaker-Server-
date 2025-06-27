import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { inventoryService } from '../services/inventoryService';
import { ProductInventory, StockMovement } from '../models/Inventory';
import Logger from '../utils/logger';

export class InventoryController {
  // Bulk check stock availability
  async bulkCheckStock(req: Request, res: Response): Promise<void> {
    try {
      const { items } = req.body;
      
      if (!items || !Array.isArray(items)) {
        res.status(400).json({
          success: false,
          message: 'Items array is required'
        });
        return;
      }

      const stockResults = [];
      
      for (const item of items) {
        const { productId, quantity, locationId = 'main' } = item;
        
        if (!productId || !quantity) {
          stockResults.push({
            productId,
            available: false,
            requestedQuantity: quantity,
            availableQuantity: 0,
            error: 'Missing productId or quantity'
          });
          continue;
        }

        try {
          const inventory = await inventoryService.getProductInventory(productId, locationId);
          
          if (!inventory) {
            stockResults.push({
              productId,
              available: false,
              requestedQuantity: quantity,
              availableQuantity: 0,
              error: 'Product not found in inventory'
            });
            continue;
          }

          const isAvailable = inventory.availableQuantity >= quantity;
          
          stockResults.push({
            productId,
            available: isAvailable,
            requestedQuantity: quantity,
            availableQuantity: inventory.availableQuantity,
            totalQuantity: inventory.quantity,
            reservedQuantity: inventory.reservedQuantity
          });
        } catch (error) {
          Logger.error(`Error checking stock for product ${productId}:`, error);
          stockResults.push({
            productId,
            available: false,
            requestedQuantity: quantity,
            availableQuantity: 0,
            error: 'Failed to check stock'
          });
        }
      }

      const allAvailable = stockResults.every(result => result.available);
      
      res.json({
        success: true,
        allAvailable,
        results: stockResults
      });
    } catch (error) {
      Logger.error('Error in bulk stock check:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check stock availability'
      });
    }
  }

  // Get product inventory
  async getProductInventory(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { locationId = 'main' } = req.query;
      
      const inventory = await inventoryService.getProductInventory(productId, locationId as string);
      
      if (!inventory) {
        res.status(404).json({
          success: false,
          message: 'Product inventory not found'
        });
        return;
      }

      res.json({
        success: true,
        data: inventory
      });
    } catch (error) {
      Logger.error('Error getting product inventory:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get product inventory'
      });
    }
  }

  // Update stock
  async updateStock(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { productId } = req.params;
      const { quantity, type, reason, reference, locationId = 'main' } = req.body;
      const performedBy = authReq.user?.id || 'system';
      
      if (!quantity || !type) {
        res.status(400).json({
          success: false,
          message: 'Quantity and type are required'
        });
        return;
      }

      const inventory = await inventoryService.updateStock(
        productId,
        quantity,
        type,
        performedBy,
        locationId,
        reason,
        reference
      );

      res.json({
        success: true,
        data: inventory
      });
    } catch (error) {
      Logger.error('Error updating stock:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update stock'
      });
    }
  }

  // Get low stock products
  async getLowStockProducts(req: Request, res: Response): Promise<void> {
    try {
      const { locationId = 'main' } = req.query;
      
      const lowStockProducts = await inventoryService.getLowStockProducts(locationId as string);
      
      res.json({
        success: true,
        data: lowStockProducts
      });
    } catch (error) {
      Logger.error('Error getting low stock products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get low stock products'
      });
    }
  }

  // Get stock movements
  async getStockMovements(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { limit = 50 } = req.query;
      
      const movements = await inventoryService.getStockMovements(productId, Number(limit));
      
      res.json({
        success: true,
        data: movements
      });
    } catch (error) {
      Logger.error('Error getting stock movements:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get stock movements'
      });
    }
  }

  // Get inventory summary
  async getInventorySummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = await inventoryService.getInventorySummary();
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      Logger.error('Error getting inventory summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get inventory summary'
      });
    }
  }
}

export const inventoryController = new InventoryController();