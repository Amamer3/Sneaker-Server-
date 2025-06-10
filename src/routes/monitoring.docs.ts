/**
 * @swagger
 * /monitoring/metrics:
 *   get:
 *     summary: Get system performance metrics (admin only)
 *     tags: [Monitoring]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cpu:
 *                   type: object
 *                   properties:
 *                     usage:
 *                       type: number
 *                     load:
 *                       type: number
 *                 memory:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     used:
 *                       type: number
 *                     free:
 *                       type: number
 *                 requests:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     rate:
 *                       type: number
 *                     errors:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 * 
 * /monitoring/errors:
 *   get:
 *     summary: Get recent error logs (admin only)
 *     tags: [Monitoring]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of errors to return
 *     responses:
 *       200:
 *         description: Recent error logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   level:
 *                     type: string
 *                   message:
 *                     type: string
 *                   stack:
 *                     type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 * 
 * /monitoring/performance:
 *   get:
 *     summary: Get API performance stats (admin only)
 *     tags: [Monitoring]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: API performance statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 endpoints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       path:
 *                         type: string
 *                       method:
 *                         type: string
 *                       avgResponseTime:
 *                         type: number
 *                       requestCount:
 *                         type: number
 *                       errorRate:
 *                         type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
