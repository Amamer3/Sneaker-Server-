/**
 * @openapi
 * components:
 *   schemas:
 *     OverviewStats:
 *       type: object
 *       properties:
 *         totalRevenue:
 *           type: number
 *           description: Total revenue across all time
 *         totalOrders:
 *           type: number
 *           description: Total number of orders
 *         totalCustomers:
 *           type: number
 *           description: Total number of customers
 *         todayRevenue:
 *           type: number
 *           description: Revenue for today
 *         todayOrders:
 *           type: number
 *           description: Number of orders today
 *         todayNewCustomers:
 *           type: number
 *           description: Number of new customers today
 *         percentageChanges:
 *           type: object
 *           properties:
 *             revenue:
 *               type: number
 *               description: Percentage change in revenue compared to previous period
 *             orders:
 *               type: number
 *               description: Percentage change in orders compared to previous period
 *             customers:
 *               type: number
 *               description: Percentage change in new customers compared to previous period
 * 
 * paths:
 *   /api/analytics/overview:
 *     get:
 *       summary: Get overview analytics
 *       description: Returns overview statistics including revenue, orders, and customers
 *       security:
 *         - bearerAuth: []
 *       tags:
 *         - Analytics
 *       responses:
 *         200:
 *           description: Overview statistics retrieved successfully
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/OverviewStats'
 *         401:
 *           description: Unauthorized - Invalid or missing token
 *         403:
 *           description: Forbidden - User is not an admin
 *         429:
 *           description: Too Many Requests - Rate limit exceeded
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
