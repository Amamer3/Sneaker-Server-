import { Request, Response } from 'express';
import * as systemService from '../services/systemService';

export const getCurrentMetrics = async (_req: Request, res: Response) => {
  try {
    const metrics = await systemService.getCurrentMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current metrics' });
  }
};

export const getHistoricalMetrics = async (req: Request, res: Response) => {
  try {
    const { startTime, endTime, interval } = req.query;
    const metrics = await systemService.getHistoricalMetrics(
      startTime as string,
      endTime as string,
      interval as string
    );
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching historical metrics' });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  try {
    const { limit = '100', offset = '0' } = req.query;
    const logs = await systemService.getLogs(
      parseInt(limit as string),
      parseInt(offset as string)
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching logs' });
  }
};

export const getAlertThresholds = async (_req: Request, res: Response) => {
  try {
    const thresholds = await systemService.getAlertThresholds();
    res.json(thresholds);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alert thresholds' });
  }
};

export const updateAlertThresholds = async (req: Request, res: Response) => {
  try {
    const thresholds = await systemService.updateAlertThresholds(req.body);
    res.json(thresholds);
  } catch (error) {
    res.status(500).json({ message: 'Error updating alert thresholds' });
  }
};
