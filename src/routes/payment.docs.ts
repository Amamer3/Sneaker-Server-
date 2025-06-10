/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentInitializeRequest:
 *       type: object
 *       required:
 *         - amount
 *         - email
 *         - orderId
 *       properties:
 *         amount:
 *           type: number
 *           description: Amount in Ghana Cedis (GHS)
 *         email:
 *           type: string
 *           format: email
 *         orderId:
 *           type: string
 *         customerId:
 *           type: string
 *         metadata:
 *           type: object
 *
 *     PaymentResponse:
 *       type: object
 *       properties:
 *         authorizationUrl:
 *           type: string
 *         reference:
 *           type: string
 *         accessCode:
 *           type: string
 *
 * /payment/initialize:
 *   post:
 *     summary: Initialize a payment
 *     tags: [Payment]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentInitializeRequest'
 *     responses:
 *       200:
 *         description: Payment initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *
 * /payment/verify/{reference}:
 *   get:
 *     summary: Verify a payment
 *     tags: [Payment]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference to verify
 *     responses:
 *       200:
 *         description: Payment verification successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 reference:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 orderId:
 *                   type: string
 *       404:
 *         description: Payment reference not found
 *
 * /payment/webhook:
 *   post:
 *     summary: Handle Paystack webhook
 *     tags: [Payment]
 *     description: Endpoint for receiving Paystack webhook events
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 */
