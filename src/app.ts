import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Load environment variables
dotenv.config();

// Import routes
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payment';

// Initialize Firebase and Cloudinary configs
import './config/firebase';
import './config/cloudinary';

// Initialize Redis client
// import redis from './config/redis';
import Logger from './utils/logger';

const app = express();

// Trust proxy - required when behind a reverse proxy like Render
app.set('trust proxy', 1);

// Initialize health checker (without Redis for now)
// const healthChecker = new HealthCheck(redis, FirestoreService);

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined', {
  stream: {
    write: (message) => Logger.http(message.trim())
  }
}));

// Use JSON middleware for all routes except Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// API Documentation
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Sneakers Store API Documentation'
  }));
}

// Handle double 'api' in URLs
app.use((req, res, next) => {
  if (req.url.includes('/api/api/')) {
    req.url = req.url.replace('/api/api/', '/api/');
  }
  next();
});

// Handle both singular and plural product routes
app.use((req, res, next) => {
  if (req.url.startsWith('/api/product/') || req.url.startsWith('/api/product?')) {
    req.url = req.url.replace('/api/product', '/api/products');
  }
  next();
});

// Handle payment routes standardization
app.use((req, res, next) => {
  if (req.url.startsWith('/api/payments/')) {
    req.url = req.url.replace('/api/payments/', '/api/payment/');
  }
  next();
});

// Test Redis connection (optional) - temporarily disabled
// try {
//   redis.set('test_key', 'test_value');
//   console.log('✅ Redis connected successfully');
// } catch (error) {
//   console.warn('⚠️ Redis connection failed (continuing without Redis):', error);
//   // Continue without Redis - it's optional for basic functionality
// }

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Sneakers Store API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Sneakers Store API' });
});

// Routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import reviewRoutes from './routes/reviews';
import wishlistRoutes from './routes/wishlist';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import userRoutes from './routes/users';
import analyticsRoutes from './routes/analytics';
import dashboardRoutes from './routes/dashboard';
import deliveryRoutes from './routes/delivery';

import monitoringRoutes from './routes/monitoring';
import systemRoutes from './routes/system';
import inventoryRoutes from './routes/inventory';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/products', reviewRoutes); // Mount reviews under products
app.use('/api/users/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes); // Mount payment routes
app.use('/api/delivery', deliveryRoutes);

app.use('/api/monitoring', monitoringRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/inventory', inventoryRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Sneaker Store API is running.' });
});

// Global error handler
import { CustomError } from './utils/helpers';
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  if (err instanceof CustomError) {
    res.status(err.statusCode).json({ message: err.message });
  } else {
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
});

export default app;
