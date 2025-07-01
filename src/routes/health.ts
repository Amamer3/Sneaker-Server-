import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/healthController';

const router = Router();

// Comprehensive health check endpoint
// Returns detailed system status including database connectivity, memory usage, etc.
router.get('/', getHealth);

// Kubernetes/Docker liveness probe endpoint
// Simple endpoint to check if the application is running
router.get('/live', getLiveness);

// Kubernetes/Docker readiness probe endpoint
// Checks if the application is ready to serve traffic
router.get('/ready', getReadiness);

export default router;