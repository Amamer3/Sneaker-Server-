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

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Test Redis connection
redis.set('test_key', 'test_value');

// Routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

import orderRoutes from './routes/orders';
app.use('/api/orders', orderRoutes);

import userRoutes from './routes/users';
app.use('/api/users', userRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Sneaker Store API is running.' });
});

// Global error handler
import { CustomError } from './utils/helpers';
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof CustomError) {
    res.status(err.statusCode).json({ message: err.message });
  } else {
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
});

export default app;
