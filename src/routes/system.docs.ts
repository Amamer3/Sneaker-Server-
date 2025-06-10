/**
 * @swagger
 * /system/health:
 *   get:
 *     summary: Get system health status
 *     tags: [System]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 uptime:
 *                   type: number
 *                 memory:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     used:
 *                       type: number
 *                     free:
 *                       type: number
 *                 services:
 *                   type: object
 *                   properties:
 *                     firebase:
 *                       type: string
 *                       enum: [up, down]
 *                     redis:
 *                       type: string
 *                       enum: [up, down]
 *                     cloudinary:
 *                       type: string
 *                       enum: [up, down]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 * 
 * /system/metrics:
 *   get:
 *     summary: Get system metrics (admin only)
 *     tags: [System]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requestRate:
 *                   type: number
 *                 errorRate:
 *                   type: number
 *                 responseTime:
 *                   type: number
 *                 activeUsers:
 *                   type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
