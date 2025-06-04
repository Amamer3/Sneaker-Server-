import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import logger from '../utils/logger';

interface SystemMetrics {
  cpu: number;
  memory: number;
  requestsPerMinute: number;
  errorRate: number;
  responseTime: number;
}

interface AlertThresholds {
  cpu: number;
  memory: number;
  requestsPerMinute: number;
  errorRate: number;
  responseTime: number;
}

const metricsCollection = FirestoreService.collection(COLLECTIONS.METRICS);
const logsCollection = FirestoreService.collection(COLLECTIONS.LOGS);
const alertsCollection = FirestoreService.collection(COLLECTIONS.ALERTS);

export async function getCurrentMetrics(): Promise<SystemMetrics> {
  try {
    // Get latest metrics from Firestore
    const metricsSnap = await metricsCollection
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (metricsSnap.empty) {
      return {
        cpu: 0,
        memory: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        responseTime: 0,
      };
    }

    return metricsSnap.docs[0].data() as SystemMetrics;
  } catch (error) {
    logger.error('Error fetching current metrics:', error);
    throw error;
  }
}

export async function getHistoricalMetrics(
  startTime: string,
  endTime: string,
  interval: string
): Promise<SystemMetrics[]> {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const metricsSnap = await metricsCollection
      .where('timestamp', '>=', start)
      .where('timestamp', '<=', end)
      .orderBy('timestamp', 'asc')
      .get();

    return metricsSnap.docs.map(doc => doc.data() as SystemMetrics);
  } catch (error) {
    logger.error('Error fetching historical metrics:', error);
    throw error;
  }
}

export async function getLogs(
  limit: number,
  offset: number
): Promise<any[]> {
  try {
    const logsSnap = await logsCollection
      .orderBy('timestamp', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    return logsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    logger.error('Error fetching logs:', error);
    throw error;
  }
}

export async function getAlertThresholds(): Promise<AlertThresholds> {
  try {
    const alertsDoc = await alertsCollection.doc('thresholds').get();
    
    if (!alertsDoc.exists) {
      // Return default thresholds if none set
      return {
        cpu: 80,
        memory: 80,
        requestsPerMinute: 1000,
        errorRate: 5,
        responseTime: 1000,
      };
    }

    return alertsDoc.data() as AlertThresholds;
  } catch (error) {
    logger.error('Error fetching alert thresholds:', error);
    throw error;
  }
}

export async function updateAlertThresholds(
  thresholds: Partial<AlertThresholds>
): Promise<AlertThresholds> {
  try {
    const alertsRef = alertsCollection.doc('thresholds');
    const currentThresholds = await getAlertThresholds();
    
    const updatedThresholds = {
      ...currentThresholds,
      ...thresholds,
    };

    await alertsRef.set(updatedThresholds);
    return updatedThresholds;
  } catch (error) {
    logger.error('Error updating alert thresholds:', error);
    throw error;
  }
}
