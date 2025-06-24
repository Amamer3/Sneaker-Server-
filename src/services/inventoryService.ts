import { ProductInventory, StockMovement, StockAlert, StockReservation, InventoryLocation } from '../models/Inventory';
import { COLLECTIONS } from '../constants/collections';
import { admin } from '../config/firebase';
import { FirestoreService } from '../utils/firestore';

const inventoryCollection = FirestoreService.collection(COLLECTIONS.INVENTORY);
const stockMovementsCollection = FirestoreService.collection(COLLECTIONS.STOCK_MOVEMENTS);
const stockAlertsCollection = FirestoreService.collection(COLLECTIONS.STOCK_ALERTS);
const reservationsCollection = FirestoreService.collection(COLLECTIONS.STOCK_RESERVATIONS);
const productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);

export class InventoryService {
  // Get current inventory for a product
  async getProductInventory(productId: string, locationId: string = 'main'): Promise<ProductInventory | null> {
    try {
      const snapshot = await inventoryCollection
        .where('productId', '==', productId)
        .where('locationId', '==', locationId)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { ...doc.data(), id: doc.id } as ProductInventory;
    } catch (error) {
      console.error('Error getting product inventory:', error);
      throw new Error('Failed to get product inventory');
    }
  }

  // Update stock levels
  async updateStock(
    productId: string, 
    quantity: number, 
    type: StockMovement['type'],
    performedBy: string,
    locationId: string = 'main',
    reason?: string,
    reference?: string
  ): Promise<ProductInventory> {
    try {
      const batch = FirestoreService.batch();
      
      // Get current inventory
      let inventory = await this.getProductInventory(productId, locationId);
      
      if (!inventory) {
        // Create new inventory record
        const newInventoryData: Omit<ProductInventory, 'id'> = {
          productId,
          locationId,
          quantity: Math.max(0, quantity),
          reservedQuantity: 0,
          availableQuantity: Math.max(0, quantity),
          reorderPoint: 10,
          maxStock: 1000,
          minStock: 5,
          averageDailySales: 0,
          leadTime: 7,
          updatedAt: new Date()
        };
        
        const docRef = await inventoryCollection.add(newInventoryData);
        inventory = { ...newInventoryData, id: docRef.id };
      } else {
        const previousStock = inventory.quantity;
        inventory.quantity = Math.max(0, inventory.quantity + quantity);
        inventory.availableQuantity = inventory.quantity - inventory.reservedQuantity;
        inventory.updatedAt = new Date();

        // Record stock movement
        const movement: Omit<StockMovement, 'id'> = {
          productId,
          type,
          quantity,
          previousStock,
          newStock: inventory.quantity,
          reason,
          reference,
          location: locationId,
          performedBy,
          timestamp: new Date()
        };

        const movementRef = stockMovementsCollection.doc();
        batch.set(movementRef, movement);
      }

      // Update inventory
      const inventoryRef = inventoryCollection.doc(`${productId}_${locationId}`);
      batch.set(inventoryRef, inventory, { merge: true });

      // Update product stock in products collection
      const productRef = productsCollection.doc(productId);
      batch.update(productRef, {
        stock: inventory.quantity,
        inStock: inventory.quantity > 0,
        updatedAt: admin.firestore.Timestamp.now()
      });

      // Check for stock alerts
      await this.checkStockAlerts(productId, locationId, inventory.quantity);

      await batch.commit();
      return inventory;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw new Error('Failed to update stock');
    }
  }

  // Reserve stock for orders
  async reserveStock(
    productId: string, 
    quantity: number, 
    orderId: string,
    expiresAt: Date,
    locationId: string = 'main'
  ): Promise<StockReservation> {
    try {
      const inventory = await this.getProductInventory(productId, locationId);
      
      if (!inventory || inventory.availableQuantity < quantity) {
        throw new Error('Insufficient stock available for reservation');
      }

      const reservation: Omit<StockReservation, 'id'> = {
        productId,
        locationId,
        quantity,
        orderId,
        type: 'order',
        expiresAt,
        isActive: true,
        createdAt: new Date(),
        reason: '',
        reservedBy: ''
      };

      const reservationRef = await reservationsCollection.add(reservation);
      
      // Update inventory reserved quantity
      const inventoryRef = inventoryCollection.doc(`${productId}_${locationId}`);
      await inventoryRef.update({
        reservedQuantity: inventory.reservedQuantity + quantity,
        availableQuantity: inventory.availableQuantity - quantity,
        updatedAt: new Date()
      });

      return { ...reservation, id: reservationRef.id };
    } catch (error) {
      console.error('Error reserving stock:', error);
      throw new Error('Failed to reserve stock');
    }
  }

  // Release stock reservation
  async releaseReservation(reservationId: string): Promise<void> {
    try {
      const reservationDoc = await reservationsCollection.doc(reservationId).get();
      
      if (!reservationDoc.exists) {
        throw new Error('Reservation not found');
      }

      const reservation = reservationDoc.data() as StockReservation;
      
      if (!reservation.isActive) {
        return; // Already released
      }

      const batch = FirestoreService.batch();

      // Update reservation
      batch.update(reservationsCollection.doc(reservationId), {
        isActive: false
      });

      // Update inventory
      const inventory = await this.getProductInventory(reservation.productId, reservation.locationId);
      if (inventory) {
        const inventoryRef = inventoryCollection.doc(`${reservation.productId}_${reservation.locationId}`);
        batch.update(inventoryRef, {
          reservedQuantity: Math.max(0, inventory.reservedQuantity - reservation.quantity),
          availableQuantity: inventory.availableQuantity + reservation.quantity,
          updatedAt: new Date()
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error releasing reservation:', error);
      throw new Error('Failed to release reservation');
    }
  }

  // Check and create stock alerts
  private async checkStockAlerts(productId: string, locationId: string, currentStock: number): Promise<void> {
    try {
      const inventory = await this.getProductInventory(productId, locationId);
      if (!inventory) return;

      const alerts: Omit<StockAlert, 'id'>[] = [];

      // Low stock alert
      if (currentStock <= inventory.reorderPoint && currentStock > 0) {
        alerts.push({
          productId,
          location: locationId,
          type: 'low_stock',
          threshold: inventory.reorderPoint,
          currentStock,
          isActive: true,
          createdAt: new Date()
        });
      }

      // Out of stock alert
      if (currentStock === 0) {
        alerts.push({
          productId,
          location: locationId,
          type: 'out_of_stock',
          threshold: 0,
          currentStock,
          isActive: true,
          createdAt: new Date()
        });
      }

      // Reorder point alert (using low_stock type as reorder_point is not defined)
      if (currentStock <= inventory.reorderPoint) {
        alerts.push({
          productId,
          location: locationId,
          type: 'low_stock',
          threshold: inventory.reorderPoint,
          currentStock,
          isActive: true,
          createdAt: new Date()
        });
      }

      // Create alerts
      for (const alert of alerts) {
        await stockAlertsCollection.add(alert);
      }
    } catch (error) {
      console.error('Error checking stock alerts:', error);
    }
  }

  // Get low stock products
  async getLowStockProducts(locationId: string = 'main'): Promise<ProductInventory[]> {
    try {
      const snapshot = await inventoryCollection
        .where('locationId', '==', locationId)
        .get();

      const lowStockProducts: ProductInventory[] = [];

      snapshot.docs.forEach(doc => {
        const inventory = doc.data() as ProductInventory;
        if (inventory.quantity <= inventory.reorderPoint) {
          lowStockProducts.push(inventory);
        }
      });

      return lowStockProducts;
    } catch (error) {
      console.error('Error getting low stock products:', error);
      throw new Error('Failed to get low stock products');
    }
  }

  // Get stock movements for a product
  async getStockMovements(productId: string, limit: number = 50): Promise<StockMovement[]> {
    try {
      const snapshot = await stockMovementsCollection
        .where('productId', '==', productId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockMovement[];
    } catch (error) {
      console.error('Error getting stock movements:', error);
      throw new Error('Failed to get stock movements');
    }
  }

  // Get all stock movements for admin view
  async getAllStockMovements(limit: number = 50, locationId: string = 'main'): Promise<StockMovement[]> {
    try {
      const snapshot = await stockMovementsCollection
        .where('locationId', '==', locationId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockMovement[];
    } catch (error) {
      console.error('Error getting all stock movements:', error);
      throw new Error('Failed to get all stock movements');
    }
  }

  // Bulk update inventory
  async bulkUpdateInventory(updates: {
    productId: string;
    quantity: number;
    type: StockMovement['type'];
    reason?: string;
  }[], performedBy: string, locationId: string = 'main'): Promise<void> {
    try {
      const batch = FirestoreService.batch();
      
      for (const update of updates) {
        await this.updateStock(
          update.productId,
          update.quantity,
          update.type,
          performedBy,
          locationId,
          update.reason
        );
      }
    } catch (error) {
      console.error('Error bulk updating inventory:', error);
      throw new Error('Failed to bulk update inventory');
    }
  }

  // Get inventory summary
  async getInventorySummary(locationId: string = 'main'): Promise<{
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalValue: number;
    recentMovements: StockMovement[];
  }> {
    try {
      const snapshot = await inventoryCollection
        .where('locationId', '==', locationId)
        .get();

      let totalProducts = 0;
      let lowStockProducts = 0;
      let outOfStockProducts = 0;
      let totalValue = 0;

      snapshot.docs.forEach(doc => {
        const inventory = doc.data() as ProductInventory;
        totalProducts++;
        
        if (inventory.quantity === 0) {
          outOfStockProducts++;
        } else if (inventory.quantity <= inventory.reorderPoint) {
          lowStockProducts++;
        }
        
        // Calculate total value using supplier cost if available
        const unitCost = inventory.supplierInfo?.cost || 0;
        totalValue += inventory.quantity * unitCost;
      });

      // Get recent movements (last 10)
      const movementsSnapshot = await stockMovementsCollection
        .where('locationId', '==', locationId)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      const recentMovements = movementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockMovement[];

      return {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        totalValue,
        recentMovements
      };
    } catch (error) {
      console.error('Error getting inventory summary:', error);
      throw new Error('Failed to get inventory summary');
    }
  }
}

export const inventoryService = new InventoryService();