import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase and Cloudinary configs
import './config/firebase';
import './config/cloudinary';

// Initialize Redis client
import redis from './config/redis';
import Logger from './utils/logger';
import { HealthCheck } from './utils/healthCheck';
import { FirestoreService } from './utils/firestore';

const app = express();

// Initialize health checker
const healthChecker = new HealthCheck(redis, FirestoreService);

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined', {
  stream: {
    write: (message) => Logger.http(message.trim())
  }
}));
app.use(express.json());

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

// Test Redis connection
redis.set('test_key', 'test_value');

// Health check endpoint
app.get('/api/health', healthChecker.middleware);

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
import deliveryRoutes from './routes/delivery';
import currencyRoutes from './routes/currency';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/products', reviewRoutes); // Mount reviews under products
app.use('/api/users/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api', deliveryRoutes);
app.use('/api/exchange-rates', currencyRoutes);

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
