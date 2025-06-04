import { Request, Response } from 'express';
import Redis from 'ioredis';
import { FirestoreService } from './firestore';
import { COLLECTIONS } from '../constants/collections';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  services: {
    redis: 'connected' | 'disconnected' | 'error';
    firestore: 'connected' | 'disconnected' | 'error';
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  timestamp: string;
}

export class HealthCheck {
  private startTime: number;

  constructor(
    private redisClient: Redis,
    private firestoreService: typeof FirestoreService
  ) {
    this.startTime = Date.now();
  }

  async getStatus(): Promise<HealthStatus> {
    const [redisStatus, firestoreStatus] = await Promise.all([
      this.checkRedis(),
      this.checkFirestore()
    ]);

    const memoryUsage = process.memoryUsage();
    
    const status: HealthStatus = {
      status: 'healthy',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        redis: redisStatus,
        firestore: firestoreStatus
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };

    // Determine overall status
    if (redisStatus === 'error' || firestoreStatus === 'error') {
      status.status = 'unhealthy';
    } else if (redisStatus === 'disconnected' || firestoreStatus === 'disconnected') {
      status.status = 'degraded';
    }

    return status;
  }

  private async checkRedis(): Promise<'connected' | 'disconnected' | 'error'> {
    try {
      const pong = await this.redisClient.ping();
      return pong === 'PONG' ? 'connected' : 'disconnected';
    } catch (error) {
      return 'error';
    }
  }
  private async checkFirestore(): Promise<'connected' | 'disconnected' | 'error'> {
    try {
      // Use products collection for health check as it should always exist
      await this.firestoreService.collection(COLLECTIONS.PRODUCTS).limit(1).get();
      return 'connected';
    } catch (error) {
      return 'error';
    }
  }

  middleware = async (req: Request, res: Response) => {
    const status = await this.getStatus();
    const statusCode = status.status === 'healthy' ? 200 : 
                      status.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(status);
  };
}
