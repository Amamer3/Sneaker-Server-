import { Router } from 'express';
import { authorizeRoles } from '../middleware/auth';
import * as systemController from '../controllers/systemController';

const router = Router();

// Apply admin authorization to all system routes
router.use(authorizeRoles('admin'));

// Metrics endpoints
router.get('/metrics', systemController.getCurrentMetrics);
router.get('/metrics/historical', systemController.getHistoricalMetrics);

// Logs endpoint
router.get('/logs', systemController.getLogs);

// Alerts endpoints
router.get('/alerts/thresholds', systemController.getAlertThresholds);
router.post('/alerts/thresholds', systemController.updateAlertThresholds);

export default router;
