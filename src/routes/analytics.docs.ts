/**
 * @swagger
 * /analytics/overview:
 *   get:
 *     summary: Get overview analytics (admin only)
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Overview analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 revenue:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     today:
 *                       type: number
 *                     growth:
 *                       type: number
 *                 orders:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     today:
 *                       type: number
 *                     growth:
 *                       type: number
 *                 customers:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     new:
 *                       type: number
 *                     growth:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 * 
 *   /api/analytics/revenue:
 *     get:
 *       summary: Get revenue analytics
 *       description: Returns revenue statistics and trends
 *       security:
 *         - bearerAuth: []
 *       tags:
 *         - Analytics
 *       parameters:
 *         - in: query
 *           name: timeframe
 *           schema:
 *             type: string
 *             enum: [daily, weekly, monthly, yearly]
 *             default: monthly
 *           description: Time period for revenue analysis
 *       responses:
 *         200:
 *           description: Revenue statistics retrieved successfully
 *         401:
 *           description: Unauthorized
 *         403:
 *           description: Forbidden
 *         429:
 *           description: Too Many Requests
 * 
 *   /api/analytics/products:
 *     get:
 *       summary: Get product analytics
 *       description: Returns product performance statistics
 *       security:
 *         - bearerAuth: []
 *       tags:
 *         - Analytics
 *       parameters:
 *         - in: query
 *           name: limit
 *           schema:
 *             type: integer
 *             minimum: 1
 *             maximum: 100
 *             default: 10
 *           description: Maximum number of products to return
 *       responses:
 *         200:
 *           description: Product statistics retrieved successfully
 *         401:
 *           description: Unauthorized
 *         403:
 *           description: Forbidden
 *         429:
 *           description: Too Many Requests
 */
