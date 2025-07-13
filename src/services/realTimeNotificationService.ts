import { EventEmitter } from 'events';
import { Response } from 'express';
import { Notification } from '../models/Notification';
import Logger from '../utils/logger';

interface SSEConnection {
  userId: string;
  response: Response;
  lastHeartbeat: Date;
}

class RealTimeNotificationService extends EventEmitter {
  private connections: Map<string, SSEConnection[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    // Start heartbeat to clean up dead connections
    this.heartbeatInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Add a new SSE connection for a user
   */
  addConnection(userId: string, response: Response): void {
    const connection: SSEConnection = {
      userId,
      response,
      lastHeartbeat: new Date()
    };

    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }

    this.connections.get(userId)!.push(connection);
    
    Logger.info(`SSE connection added for user: ${userId}. Total connections: ${this.getTotalConnections()}`);

    // Handle connection close
    response.on('close', () => {
      this.removeConnection(userId, response);
    });

    // Send initial connection confirmation
    this.sendToConnection(connection, {
      type: 'connected',
      message: 'Real-time notifications connected',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Remove a connection for a user
   */
  private removeConnection(userId: string, response: Response): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      const index = userConnections.findIndex(conn => conn.response === response);
      if (index !== -1) {
        userConnections.splice(index, 1);
        
        if (userConnections.length === 0) {
          this.connections.delete(userId);
        }
        
        Logger.info(`SSE connection removed for user: ${userId}. Total connections: ${this.getTotalConnections()}`);
      }
    }
  }

  /**
   * Send notification to a specific user
   */
  sendNotificationToUser(userId: string, notification: Notification): void {
    const userConnections = this.connections.get(userId);
    if (userConnections && userConnections.length > 0) {
      const notificationData = {
        type: 'notification',
        data: notification,
        timestamp: new Date().toISOString()
      };

      userConnections.forEach(connection => {
        this.sendToConnection(connection, notificationData);
      });

      Logger.info(`Real-time notification sent to user: ${userId}`);
    }
  }

  /**
   * Send notification count update to a user
   */
  sendUnreadCountUpdate(userId: string, unreadCount: number): void {
    const userConnections = this.connections.get(userId);
    if (userConnections && userConnections.length > 0) {
      const countData = {
        type: 'unread_count_update',
        data: { unreadCount },
        timestamp: new Date().toISOString()
      };

      userConnections.forEach(connection => {
        this.sendToConnection(connection, countData);
      });
    }
  }

  /**
   * Send heartbeat to all connections
   */
  sendHeartbeat(): void {
    const heartbeatData = {
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    };

    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach(connection => {
        this.sendToConnection(connection, heartbeatData);
        connection.lastHeartbeat = new Date();
      });
    });
  }

  /**
   * Send data to a specific connection
   */
  private sendToConnection(connection: SSEConnection, data: any): void {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      connection.response.write(message);
    } catch (error) {
      Logger.error(`Error sending SSE message to user ${connection.userId}:`, error);
      // Remove the dead connection
      this.removeConnection(connection.userId, connection.response);
    }
  }

  /**
   * Clean up dead connections
   */
  private cleanupDeadConnections(): void {
    const now = new Date();
    const timeout = 60000; // 1 minute timeout

    this.connections.forEach((userConnections, userId) => {
      const activeConnections = userConnections.filter(connection => {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        return timeSinceHeartbeat < timeout;
      });

      if (activeConnections.length !== userConnections.length) {
        if (activeConnections.length === 0) {
          this.connections.delete(userId);
        } else {
          this.connections.set(userId, activeConnections);
        }
        
        Logger.info(`Cleaned up dead connections for user: ${userId}`);
      }
    });
  }

  /**
   * Get total number of active connections
   */
  getTotalConnections(): number {
    let total = 0;
    this.connections.forEach(userConnections => {
      total += userConnections.length;
    });
    return total;
  }

  /**
   * Get number of connections for a specific user
   */
  getUserConnectionCount(userId: string): number {
    const userConnections = this.connections.get(userId);
    return userConnections ? userConnections.length : 0;
  }

  /**
   * Get all connected user IDs
   */
  getConnectedUsers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Broadcast to all connected users
   */
  broadcastToAll(data: any): void {
    const broadcastData = {
      type: 'broadcast',
      data,
      timestamp: new Date().toISOString()
    };

    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach(connection => {
        this.sendToConnection(connection, broadcastData);
      });
    });

    Logger.info(`Broadcast sent to ${this.getTotalConnections()} connections`);
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach(connection => {
        try {
          connection.response.end();
        } catch (error) {
          // Ignore errors when closing connections
        }
      });
    });

    this.connections.clear();
    Logger.info('Real-time notification service destroyed');
  }
}

export const realTimeNotificationService = new RealTimeNotificationService();

// Start periodic heartbeat
setInterval(() => {
  realTimeNotificationService.sendHeartbeat();
}, 30000); // Send heartbeat every 30 seconds