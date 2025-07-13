import { Router } from 'express';
import * as notificationPreferencesController from '../controllers/notificationPreferencesController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all preference routes
router.use(authenticateJWT);

// Get user notification preferences
router.get('/', notificationPreferencesController.getUserPreferences);

// Update user notification preferences
router.put('/', notificationPreferencesController.updateUserPreferences);

// Reset preferences to default
router.post('/reset', notificationPreferencesController.resetPreferences);

export default router;