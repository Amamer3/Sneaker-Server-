import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import * as monitoringController from '../controllers/monitoringController';

const router = Router();

// Protect all monitoring routes - admin only
router.use(authenticateJWT);
router.use(authorizeRoles('admin'));

// Monitoring routes
router.get('/historical', monitoringController.getHistoricalMetrics);
router.get('/logs', monitoringController.getLogs);

export default router;
