import { Request, Response } from 'express';
import { FirestoreService } from '../utils/firestore';
import Logger from '../utils/logger';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
    redis?: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  system: {
    platform: string;
    nodeVersion: string;
    pid: number;
  };
}

export const getHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    
    // Check database connection
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let dbResponseTime: number | undefined;
    
    try {
      const dbStartTime = Date.now();
      // Test Firestore connection by attempting to read from a collection
      await FirestoreService.collection('users').limit(1).get();
      dbResponseTime = Date.now() - dbStartTime;
      dbStatus = 'connected';
    } catch (error) {
      Logger.error('Database health check failed:', error);
      dbStatus = 'disconnected';
    }

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);

    // Determine overall health status
    const isHealthy = dbStatus === 'connected';
    
    const healthStatus: HealthStatus = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: dbStatus,
          responseTime: dbResponseTime
        }
      },
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: memoryPercentage
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    };

    // Set appropriate HTTP status code
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
    
    // Log health check
    Logger.info('Health check completed', {
      status: healthStatus.status,
      responseTime: Date.now() - startTime,
      dbStatus,
      dbResponseTime
    });
    
  } catch (error) {
    Logger.error('Health check endpoint error:', error);
    
    const errorHealthStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: 'disconnected'
        }
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    };
    
    res.status(503).json(errorHealthStatus);
  }
};

// Simple liveness probe
export const getLiveness = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
};

// Simple readiness probe
export const getReadiness = async (req: Request, res: Response): Promise<void> => {
  try {
    // Quick database connectivity check
    await FirestoreService.collection('users').limit(1).get();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected'
      }
    });
  } catch (error) {
    Logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected'
      },
      error: 'Database connection failed'
    });
  }
};