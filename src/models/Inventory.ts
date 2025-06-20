export interface Inventory {
  id: string;
  productId: string;
  location: string;
  availableStock: number;
  reservedStock: number;
  totalStock: number;
  reorderLevel: number;
  maxStock: number;
  lastUpdated: Date;
  lastRestocked?: Date;
}

export interface StockAlert {
  id: string;
  productId: string;
  location: string;
  type: 'low_stock' | 'out_of_stock' | 'overstock';
  threshold: number;
  currentStock: number;
  isActive: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface StockReservation {
  id: string;
  productId: string;
  quantity: number;
  reservedBy: string;
  reason: string;
  expiresAt: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'restock' | 'sale' | 'return' | 'adjustment' | 'damage' | 'transfer';
  quantity: number; // Positive for additions, negative for reductions
  previousStock: number;
  newStock: number;
  reason?: string;
  reference?: string; // Order ID, transfer ID, etc.
  location?: string;
  performedBy: string;
  timestamp: Date;
}

export interface InventoryLocation {
  id: string;
  name: string;
  type: 'warehouse' | 'store' | 'supplier' | 'transit';
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  isActive: boolean;
  capacity?: number;
  currentUtilization?: number;
  manager?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInventory {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number; // Stock reserved for pending orders
  availableQuantity: number; // quantity - reservedQuantity
  reorderPoint: number;
  maxStock: number;
  minStock: number;
  lastRestockDate?: Date;
  lastSaleDate?: Date;
  averageDailySales: number;
  leadTime: number; // Days to restock
  supplierInfo?: {
    supplierId: string;
    supplierName: string;
    cost: number;
    minimumOrderQuantity: number;
  };
  updatedAt: Date;
}

// Properties moved to the StockAlert interface defined above

export interface InventoryTransfer {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  items: {
    productId: string;
    quantity: number;
    unitCost?: number;
  }[];
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  requestedBy: string;
  approvedBy?: string;
  shippedAt?: Date;
  receivedAt?: Date;
  trackingNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAudit {
  id: string;
  locationId: string;
  auditDate: Date;
  auditedBy: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  items: {
    productId: string;
    expectedQuantity: number;
    actualQuantity: number;
    variance: number;
    notes?: string;
  }[];
  totalVariance: number;
  discrepancyValue: number;
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
}

export interface InventoryForecast {
  productId: string;
  locationId: string;
  forecastDate: Date;
  predictedDemand: number;
  recommendedStock: number;
  confidence: number; // 0-1, where 1 is highest confidence
  seasonalFactor: number;
  trendFactor: number;
  promotionalImpact: number;
  algorithm: string;
  createdAt: Date;
}

export interface StockReservation {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  orderId?: string;
  userId?: string;
  type: 'order' | 'hold' | 'transfer' | 'promotion';
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}