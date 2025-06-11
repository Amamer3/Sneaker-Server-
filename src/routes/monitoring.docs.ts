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
 * 
 * /monitoring/metrics/historical:
 *   get:
 *     summary: Get historical system metrics
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 30
 *         description: Number of days to fetch metrics for
 *     responses:
 *       200:
 *         description: Historical metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timeframe:
 *                   type: string
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     cpu:
 *                       type: object
 *                       properties:
 *                         average:
 *                           type: number
 *                         peak:
 *                           type: number
 *                         timestamps:
 *                           type: array
 *                           items:
 *                             type: string
 *                     memory:
 *                       type: object
 *                       properties:
 *                         average:
 *                           type: number
 *                         peak:
 *                           type: number
 *                         timestamps:
 *                           type: array
 *                           items:
 *                             type: string
 *                     requests:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         successful:
 *                           type: number
 *                         failed:
 *                           type: number
 *                         averageResponseTime:
 *                           type: number
 *       500:
 *         description: Server error while fetching metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 * 
 * /monitoring/alerts/thresholds:
 *   get:
 *     summary: Get system alert thresholds
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Alert thresholds retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cpu:
 *                   type: object
 *                   properties:
 *                     warning:
 *                       type: number
 *                     critical:
 *                       type: number
 *                 memory:
 *                   type: object
 *                   properties:
 *                     warning:
 *                       type: number
 *                     critical:
 *                       type: number
 *                 disk:
 *                   type: object
 *                   properties:
 *                     warning:
 *                       type: number
 *                     critical:
 *                       type: number
 *                 responseTime:
 *                   type: object
 *                   properties:
 *                     warning:
 *                       type: number
 *                     critical:
 *                       type: number
 *                 errorRate:
 *                   type: object
 *                   properties:
 *                     warning:
 *                       type: number
 *                     critical:
 *                       type: number
 *       500:
 *         description: Server error while fetching thresholds
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 * 
 * /monitoring/logs:
 *   get:
 *     summary: Get application logs
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [all, error]
 *           default: all
 *         description: Log level to filter by
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to fetch logs for (YYYY-MM-DD)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 100
 *         description: Maximum number of logs to return
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                 level:
 *                   type: string
 *                 count:
 *                   type: number
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                       level:
 *                         type: string
 *                       message:
 *                         type: string
 *                       raw:
 *                         type: string
 *       404:
 *         description: No logs found for the specified date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Server error while fetching logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
