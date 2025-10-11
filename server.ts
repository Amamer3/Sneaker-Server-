import app from './src/app';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Logger from './src/utils/logger';
import { setSocketIO } from './src/services/websocketNotificationService';
import { validateEnvironment } from './src/utils/envValidator';

// Validate environment variables before starting
validateEnvironment();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.FRONTEND_URL || "https://www.kicksintel.com")
      : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  path: '/socket.io/'
});

// Set the io instance in the WebSocket service
setSocketIO(io);

// Export io instance for other modules
export { io };

// Socket.IO authentication middleware with rate limiting
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();

io.use(async (socket, next) => {
  const clientIP = socket.handshake.address || 'unknown';
  const now = Date.now();
  
  // Rate limiting for WebSocket connections
  const attempts = connectionAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
  
  if (now - attempts.lastAttempt > 60000) { // Reset after 1 minute
    attempts.count = 0;
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  connectionAttempts.set(clientIP, attempts);
  
  if (attempts.count > 10) { // Max 10 connection attempts per minute
    Logger.warn(`WebSocket connection rate limit exceeded for IP: ${clientIP}`);
    return next(new Error('Connection rate limit exceeded'));
  }
  
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    // Check if token is blacklisted
    const { TokenBlacklistService } = await import('./src/services/tokenBlacklistService');
    const isBlacklisted = await TokenBlacklistService.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      return next(new Error('Authentication error: Token has been revoked'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    socket.userId = decoded.id;
    Logger.info(`WebSocket authenticated for user: ${decoded.id}`);
    next();
  } catch (err) {
    Logger.error('WebSocket authentication failed:', err);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  Logger.info(`WebSocket connected: ${socket.id} for user: ${socket.userId}`);
  
  // Join user-specific room
  socket.join(`user_${socket.userId}`);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    Logger.info(`WebSocket disconnected: ${socket.id} for user: ${socket.userId}`);
  });
  
  // Send connection confirmation
  socket.emit('connected', {
    message: 'Connected to notification service',
    userId: socket.userId,
    timestamp: new Date().toISOString()
  });
});

// io is already exported above

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/socket.io/`);
}); // CORS configuration updated

// Extend Socket interface to include userId
declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}