import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { apiReference } from '@scalar/express-api-reference';
import { swaggerSpec } from './config/swagger';

// Load environment variables
dotenv.config();

// Import routes
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payment';
import couponRoutes from './routes/coupons';

// Initialize Firebase and Cloudinary configs
import './config/firebase';
import './config/cloudinary';

// Initialize Redis client
// import redis from './config/redis';
import Logger from './utils/logger';
import { FirestoreService } from './utils/firestore';

const app = express();

// Simple test endpoint before any middleware
app.get('/simple-test', (req, res) => {
  res.json({ message: 'Simple test working', timestamp: new Date().toISOString() });
});

// Trust proxy - required when behind a reverse proxy like Render
app.set('trust proxy', 1);

// Health checking is now handled by the healthController

// Middleware
const allowedOrigins = [
  // Production origins
  'https://www.kicksintel.com',
  'https://kicksintel.com',
  // Development origins
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

// For development, allow all origins (remove in production)
const isDevelopment = process.env.NODE_ENV !== 'production';

// Handle preflight requests
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (isDevelopment || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-content-type-options', 'x-csrf-token', 'x-xss-protection', 'x-frame-options']
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (isDevelopment || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-content-type-options', 'x-csrf-token', 'x-xss-protection', 'x-frame-options'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('combined', {
  stream: {
    write: (message) => Logger.http(message.trim())
  }
}));

// Use JSON middleware for all routes except webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    next();
  } else {
    express.json({ limit: '50mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global request logging
app.use((req, res, next) => {
  console.log(`🌐 Global: ${req.method} ${req.url} - Original URL: ${req.originalUrl}`);
  next();
});

// API Documentation
if (process.env.NODE_ENV !== 'production') {
  // Serve the OpenAPI spec as JSON
  app.get('/openapi.json', (req, res) => {
    res.json(swaggerSpec);
  });
  
  // Serve Scalar API reference
  app.use('/api-docs', apiReference({
    url: '/openapi.json',
    theme: 'purple'
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

// Health check endpoint is now handled by the health routes

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Sneakers Store API' });
});

// Test notification service endpoint (no auth required) - temporarily disabled
// app.get('/test-notification-service', async (req, res) => {
//   res.json({ message: 'Test endpoint temporarily disabled' });
// });

// Test simple endpoint (no auth required)
app.get('/test-simple', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
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
import healthRoutes from './routes/health';
import notificationRoutes from './routes/notifications';
import notificationPreferencesRoutes from './routes/notificationPreferences';
import categoriesRoutes from './routes/categories';

import monitoringRoutes from './routes/monitoring';
import systemRoutes from './routes/system';


// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/products', reviewRoutes); 
app.use('/api/users/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes); 
app.use('/api/delivery', deliveryRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/categories', categoriesRoutes); 
console.log('🔧 Mounting notification preferences routes at /api/notifications/preferences');
app.use('/api/notifications/preferences', notificationPreferencesRoutes);
console.log('🔧 Mounting notification routes at /api/notifications');
app.use('/api/notifications', notificationRoutes);
console.log('🔧 All notification routes mounted successfully');

app.use('/api/monitoring', monitoringRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/coupons', couponRoutes);
// Admin dashboard routes
app.use('/api/dashboard', dashboardRoutes);

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
