/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Get dashboard overview (admin only)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 salesOverview:
 *                   type: object
 *                   properties:
 *                     daily:
 *                       type: number
 *                     weekly:
 *                       type: number
 *                     monthly:
 *                       type: number
 *                     yearly:
 *                       type: number
 *                 orderStats:
 *                   type: object
 *                   properties:
 *                     pending:
 *                       type: number
 *                     processing:
 *                       type: number
 *                     shipped:
 *                       type: number
 *                     delivered:
 *                       type: number
 *                     cancelled:
 *                       type: number
 *                 topProducts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       sales:
 *                         type: number
 *                       revenue:
 *                         type: number
 *                 recentOrders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 * 
 * /dashboard/sales:
 *   get:
 *     summary: Get detailed sales data (admin only)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         description: Time period for sales data
 *     responses:
 *       200:
 *         description: Detailed sales data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       sales:
 *                         type: number
 *                       orders:
 *                         type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
