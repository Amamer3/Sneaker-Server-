/**
 * @swagger
 * /delivery/calculate:
 *   post:
 *     summary: Calculate delivery cost
 *     tags: [Delivery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               orderTotal:
 *                 type: number
 *             required:
 *               - address
 *               - city
 *               - country
 *               - orderTotal
 *     responses:
 *       200:
 *         description: Delivery cost calculation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deliveryCost:
 *                   type: number
 *                 estimatedDays:
 *                   type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 * /delivery/zones:
 *   get:
 *     summary: Get delivery zones and rates
 *     tags: [Delivery]
 *     responses:
 *       200:
 *         description: List of delivery zones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   zone:
 *                     type: string
 *                   countries:
 *                     type: array
 *                     items:
 *                       type: string
 *                   baseRate:
 *                     type: number
 *                   estimatedDays:
 *                     type: number
 */
