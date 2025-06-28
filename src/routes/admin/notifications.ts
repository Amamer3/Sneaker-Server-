import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import * as adminNotificationController from '../../controllers/admin/notificationController';

const router = Router();

// Apply authentication and admin middleware to all routes
router.use(authenticateJWT);
router.use(requireAdmin);

// Get notification templates
router.get('/templates', adminNotificationController.getNotificationTemplates);

// Create notification template
router.post('/templates', adminNotificationController.createNotificationTemplate);

// Update notification template
router.put('/templates/:id', adminNotificationController.updateNotificationTemplate);

// Delete notification template
router.delete('/templates/:id', adminNotificationController.deleteNotificationTemplate);

// Send bulk notifications
router.post('/bulk-send', adminNotificationController.sendBulkNotifications);

export default router;