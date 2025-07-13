import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import * as testNotificationController from '../../controllers/admin/testNotificationController';

const router = Router();

// Apply authentication and admin middleware to all routes
router.use(authenticateJWT);
router.use(requireAdmin);

// Test notification creation
router.post('/create', testNotificationController.testCreateNotification);

// Test real-time notification
router.post('/real-time', testNotificationController.testRealTimeNotification);

// Test broadcast notification
router.post('/broadcast', testNotificationController.testBroadcastNotification);

// Get real-time service statistics
router.get('/real-time-stats', testNotificationController.getRealTimeStats);

// Test notification preferences
router.post('/preferences', testNotificationController.testNotificationPreferences);

// Test notification delivery across channels
router.post('/delivery', testNotificationController.testNotificationDelivery);

export default router;