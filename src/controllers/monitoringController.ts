import { Request, Response } from 'express';
import Logger from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export const getHistoricalMetrics = async (req: Request, res: Response) => {
  try {
    // Get metrics from the last 30 days by default
    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // In a real implementation, you would fetch this from a time series database
    // For now, we'll return some sample data
    const metrics = {
      timeframe: `${days} days`,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      metrics: {
        cpu: {
          average: 45.5,
          peak: 78.2,
          timestamps: []
        },
        memory: {
          average: 62.3,
          peak: 85.1,
          timestamps: []
        },
        requests: {
          total: 15234,
          successful: 14891,
          failed: 343,
          averageResponseTime: 182
        }
      }
    };

    res.json(metrics);
  } catch (error) {
    Logger.error('Error fetching historical metrics:', error);
    res.status(500).json({ error: 'Failed to fetch historical metrics' });
  }
};

export const getAlertThresholds = async (req: Request, res: Response) => {
  try {
    // In a real implementation, these would be stored in a database and be configurable
    const thresholds = {
      cpu: {
        warning: 70,
        critical: 90
      },
      memory: {
        warning: 80,
        critical: 95
      },
      disk: {
        warning: 85,
        critical: 95
      },
      responseTime: {
        warning: 1000, // ms
        critical: 3000 // ms
      },
      errorRate: {
        warning: 5, // percentage
        critical: 10 // percentage
      }
    };

    res.json(thresholds);
  } catch (error) {
    Logger.error('Error fetching alert thresholds:', error);
    res.status(500).json({ error: 'Failed to fetch alert thresholds' });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  try {
    const level = req.query.level as string || 'all';
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const limit = parseInt(req.query.limit as string) || 100;

    const logsDir = path.join(process.cwd(), 'logs');
    const logFileName = level === 'error' ? `error-${date}.log` : `all-${date}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    try {
      const logContent = await fs.readFile(logFilePath, 'utf-8');
      const logs = logContent
        .split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        })
        .slice(-limit);

      res.json({
        date,
        level,
        count: logs.length,
        logs
      });
    } catch (error) {
      // If the log file doesn't exist or can't be read
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({ error: `No logs found for date: ${date}` });
      } else {
        throw error;
      }
    }
  } catch (error) {
    Logger.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};
