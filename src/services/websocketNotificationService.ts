import { Server } from 'socket.io';
import Logger from '../utils/logger';
import { Notification } from '../models/Notification';

// We'll get the io instance from the server module
let io: Server;

// Function to set the io instance (called from server.ts)
export const setSocketIO = (socketIO: Server) => {
  io = socketIO;
};

class WebSocketNotificationService {
  /**
   * Send notification to a specific user via WebSocket
   */
  async sendToUser(userId: string, notification: Notification): Promise<void> {
    try {
      const room = `user_${userId}`;
      
      // Emit notification to user's room
      io.to(room).emit('notification', {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        data: notification.data,
        createdAt: notification.createdAt,
        timestamp: new Date().toISOString()
      });
      
      Logger.info(`WebSocket notification sent to user ${userId}: ${notification.title}`);
    } catch (error) {
      Logger.error('Error sending WebSocket notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(userIds: string[], notification: Notification): Promise<void> {
    try {
      const promises = userIds.map(userId => this.sendToUser(userId, notification));
      await Promise.all(promises);
      
      Logger.info(`WebSocket notification sent to ${userIds.length} users: ${notification.title}`);
    } catch (error) {
      Logger.error('Error sending WebSocket notifications to multiple users:', error);
      throw error;
    }
  }

  /**
   * Broadcast notification to all connected users
   */
  async broadcast(notification: Notification): Promise<void> {
    try {
      io.emit('notification', {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        data: notification.data,
        createdAt: notification.createdAt,
        timestamp: new Date().toISOString()
      });
      
      Logger.info(`WebSocket notification broadcasted: ${notification.title}`);
    } catch (error) {
      Logger.error('Error broadcasting WebSocket notification:', error);
      throw error;
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return io.sockets.sockets.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    const room = `user_${userId}`;
    const roomSockets = io.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size > 0 : false;
  }

  /**
   * Get user connection count
   */
  getUserConnectionCount(userId: string): number {
    const room = `user_${userId}`;
    const roomSockets = io.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size : 0;
  }

  /**
   * Send system message to user
   */
  async sendSystemMessage(userId: string, message: string, type: string = 'system'): Promise<void> {
    try {
      const room = `user_${userId}`;
      
      io.to(room).emit('system_message', {
        message,
        type,
        timestamp: new Date().toISOString()
      });
      
      Logger.info(`WebSocket system message sent to user ${userId}: ${message}`);
    } catch (error) {
      Logger.error('Error sending WebSocket system message:', error);
      throw error;
    }
  }
}

export const webSocketNotificationService = new WebSocketNotificationService();
export default webSocketNotificationService;