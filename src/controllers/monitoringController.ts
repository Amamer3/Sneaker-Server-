import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import Logger from '../utils/logger';

export const getHistoricalMetrics = async (req: Request, res: Response) => {
  try {
    const { startTime, endTime, interval } = req.query;
    const startDate = new Date(startTime as string);
    const endDate = new Date(endTime as string);

    // Generate sample metrics for now
    const metrics = generateHistoricalMetrics(startDate, endDate, interval as string);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching historical metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve historical metrics' });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  try {
    const { limit = '100', offset = '0' } = req.query;
    const currentDate = new Date().toISOString().split('T')[0];
    const logPath = join(__dirname, '..', '..', 'logs', `all-${currentDate}.log`);

    try {
      const logs = readFileSync(logPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { timestamp: new Date(), level: 'error', message: line };
          }
        })
        .slice(Number(offset), Number(offset) + Number(limit));

      res.json({
        logs,
        total: logs.length,
        hasMore: logs.length === Number(limit)
      });
    } catch (readError) {
      // If log file doesn't exist, return empty logs
      res.json({
        logs: [],
        total: 0,
        hasMore: false
      });
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
};

function generateHistoricalMetrics(startDate: Date, endDate: Date, interval: string) {
  const metrics = [];
  const intervalMs = interval === 'hour' ? 3600000 : 86400000;
  let current = startDate.getTime();

  while (current <= endDate.getTime()) {
    metrics.push({
      timestamp: new Date(current).toISOString(),
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      requests: Math.floor(Math.random() * 1000),
      errors: Math.floor(Math.random() * 10),
      responseTime: Math.random() * 500
    });
    current += intervalMs;
  }

  return metrics;
}
