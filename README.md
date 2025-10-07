# Sneakers Backend

## API Endpoints

### Authentication Routes

#### Customer Authentication
- **POST** `/api/auth/register`: Register a new user.
- **POST** `/api/auth/login`: Log in a user.
- **POST** `/api/auth/logout`: Log out a user.
- **GET** `/api/auth/profile`: Get the profile of the logged-in user.

#### Admin Authentication & Management
- **POST** `/api/auth/admin/login`: Admin login (Admin only)
- **POST** `/api/auth/admin/register`: Create a new admin user (Admin only)
- **GET** `/api/users`: Get all users with pagination and search (Admin only)
- **DELETE** `/api/users/:id`: Delete a user (Admin only)

### Product Routes
- **GET** `/api/products`: Get all products
- **GET** `/api/products/:id`: Get a product by ID.
- **POST** `/api/products`: Create a new product (Admin only)
- **PUT** `/api/products/:id`: Update a product by ID (Admin only)
- **DELETE** `/api/products/:id`: Delete a product by ID (Admin only)

## Product Management APIs

### Admin Side (Admin Only)
1. **Product CRUD Operations**:
   - **POST** `/api/products` - Create new product (Admin only)
   - **GET** `/api/products` - List all products with pagination and filters
   - **GET** `/api/products/:id` - Get single product details
   - **PUT** `/api/products/:id` - Update product (Admin only)
   - **DELETE** `/api/products/:id` - Delete product (Admin only)
   - **PATCH** `/api/products/:id/stock` - Update stock status (Admin only)
   - **PATCH** `/api/products/:id/featured` - Toggle featured status (Admin only)

2. **Product Image Management**:
   - **POST** `/api/products/:id/images` - Upload product images (Admin only)
   - **DELETE** `/api/products/:id/images/:imageId` - Remove product image (Admin only)
   - **PUT** `/api/products/:id/images/reorder` - Reorder product images (Admin only)

### Customer Side
1. **Product Browsing**:
   - **GET** `/api/products` - List all products with filters and pagination
   - **GET** `/api/products/:id` - Get product details

2. **Product Reviews**:
   - **GET** `/api/products/:id/reviews` - Get product reviews
   - **POST** `/api/products/:id/reviews` - Add product review (Auth required)

3. **Product Utilities**:
   - **POST** `/api/products/bulk-stock-check` - Check stock for multiple products
   - **GET** `/api/products/public/products/filters` - Get product filters for search
   - **GET** `/api/products/featured` - Get featured products

4. **Product Wishlist**:
   - **GET** `/api/users/wishlist` - Get user's wishlist
   - **POST** `/api/users/wishlist` - Add to wishlist (send productId in body)
   - **DELETE** `/api/users/wishlist/:productId` - Remove from wishlist

5. **Product Cart**:
   - **GET** `/api/cart` - Get user's cart
   - **POST** `/api/cart` - Add item to cart
   - **PUT** `/api/cart/:itemId` - Update cart item quantity
   - **DELETE** `/api/cart/:itemId` - Remove item from cart
   - **DELETE** `/api/cart` - Clear entire cart
   - **POST** `/api/cart/sync` - Sync guest cart with user cart (Auth required)
   - **POST** `/api/cart/checkout` - Process checkout (Auth required)
   - **POST** `/api/cart/apply-coupon` - Apply coupon to cart (Auth required)
   - **POST** `/api/cart/remove-coupon` - Remove coupon from cart (Auth required)

### Order Routes
- **GET** `/api/orders`: Get all orders.
- **GET** `/api/orders/:id`: Get an order by ID.
- **POST** `/api/orders`: Create a new order.
- **PUT** `/api/orders/:id/status`: Update the status of an order (Admin only).

### Payment Routes

#### Public Payment Routes
- **POST** `/api/payment/webhook`: Handle payment webhook (Stripe/Paystack)
- **GET** `/api/payment/verify/:reference`: Verify payment status
- **POST** `/api/payment/verify/:reference`: Verify payment status (alternative method)

#### Protected Payment Routes (Auth Required)
- **POST** `/api/payment/initialize`: Initialize payment transaction

### Delivery Routes

#### Public Delivery Routes
- **GET** `/api/delivery/delivery-options`: Get available delivery options

#### Protected Delivery Routes (Auth Required)
- **POST** `/api/delivery/validate-delivery-address`: Validate delivery address

### User Management Routes

#### Profile Management
- **GET** `/api/users/me`: Get current user's profile
- **PUT** `/api/users/me`: Update current user's profile

#### Address Management
- **GET** `/api/users/me/addresses`: Get user's addresses
- **POST** `/api/users/me/addresses`: Add new address
- **PUT** `/api/users/me/addresses/:addressId`: Update address
- **DELETE** `/api/users/me/addresses/:addressId`: Delete address

#### Wishlist Management
- **GET** `/api/users/wishlist`: Get user's wishlist
- **POST** `/api/users/wishlist`: Add product to wishlist (send productId in body)
- **DELETE** `/api/users/wishlist/:productId`: Remove product from wishlist

#### Admin User Management (Admin Only)
- **GET** `/api/users`: Get all users with pagination and search
  - Query params: page (default: 1), limit (default: 10), search (optional)
- **GET** `/api/users/:id`: Get user details
- **PUT** `/api/users/:id`: Update user details
- **DELETE** `/api/users/:id`: Delete user account

### Notification Routes (All require JWT authentication)

**Note**: The notification system currently supports **in-app notifications only**. Email and SMS functionality has been removed to focus on order updates, promotions, and general information delivery through the web application.

#### User Notifications
- **GET** `/api/notifications`: Get user notifications (with pagination: ?page=1&limit=20&unreadOnly=false)
- **GET** `/api/notifications/unread-count`: Get unread notification count
- **GET** `/api/notifications/stats`: Get notification statistics
- **PUT** `/api/notifications/:id/read`: Mark notification as read
- **PUT** `/api/notifications/mark-all-read`: Mark all notifications as read
- **DELETE** `/api/notifications/:id`: Delete notification
- **GET** `/api/notifications/stream`: Real-time notification stream (Server-Sent Events)
- **GET** `/api/notifications/connection-status`: Get real-time connection status

#### Notification Preferences
- **GET** `/api/notifications/preferences`: Get user notification preferences
- **PUT** `/api/notifications/preferences`: Update user notification preferences
- **POST** `/api/notifications/preferences/reset`: Reset preferences to default

### Admin Routes (Admin Only)

All admin endpoints require admin authentication.

#### Admin Dashboard
- **GET** `/api/admin/dashboard/stats`: Get admin dashboard statistics
- **GET** `/api/admin/dashboard/recent-orders`: Get recent orders for admin dashboard

#### Admin User Management
- **GET** `/api/admin/users`: Get all users (admin view)
- **DELETE** `/api/admin/users/:userId`: Delete user account
- **GET** `/api/admin/profile/activity`: Get admin profile activity

#### Admin Coupon Management
- **GET** `/api/admin/coupons`: Get all coupons
- **GET** `/api/admin/coupons/stats`: Get coupon usage statistics
- **POST** `/api/admin/coupons`: Create new coupon
- **PUT** `/api/admin/coupons/:id`: Update coupon
- **DELETE** `/api/admin/coupons/:id`: Delete coupon

#### Admin Notification Management
- **GET** `/api/admin/notifications/templates`: Get notification templates
- **POST** `/api/admin/notifications/templates`: Create notification template
- **PUT** `/api/admin/notifications/templates/:id`: Update notification template
- **DELETE** `/api/admin/notifications/templates/:id`: Delete notification template
- **POST** `/api/admin/notifications/bulk-send`: Send bulk notifications

#### Admin Notification Testing
- **POST** `/api/admin/test-notifications/create`: Test in-app notification creation
- **POST** `/api/admin/test-notifications/real-time`: Test real-time notification
- **POST** `/api/admin/test-notifications/broadcast`: Test broadcast notification
- **GET** `/api/admin/test-notifications/real-time-stats`: Get real-time service statistics
- **POST** `/api/admin/test-notifications/preferences`: Test in-app notification preferences
- **POST** `/api/admin/test-notifications/delivery`: Test in-app notification delivery

### Analytics Routes (Admin Only)

All analytics endpoints are protected with admin authentication and rate limiting (100 requests per 15 minutes).

#### Overview Analytics
- **GET** `/api/analytics/overview`: Get overall store statistics
  - Returns total revenue, orders, customers, and today's metrics with percentage changes

#### Revenue Analytics
- **GET** `/api/analytics/revenue`: Get revenue statistics and trends
  - Query params:
    - `timeframe`: (hourly|daily|weekly|monthly|quarterly|yearly, default: monthly)
    - `granularity`: (hour|day|week|month) - must be finer than timeframe
    - `startDate`: (YYYY-MM-DD) - optional custom start date
    - `endDate`: (YYYY-MM-DD) - optional custom end date
    - `includeTotal`: (true|false) - include period totals
    - `compareWithPrevious`: (true|false) - include comparison with previous period
  - Returns revenue data points and comparison with previous period
  - Cache TTL: 30 minutes with 5 minutes stale-while-revalidate

#### Order Analytics
- **GET** `/api/analytics/orders`: Get order statistics
  - Returns status distribution, average order value, and order trends

#### Product Analytics
- **GET** `/api/analytics/products`: Get comprehensive product statistics
  - Query params: limit (default: 10, max: 100)
  - Returns top products, low stock items, and category distribution
- **GET** `/api/analytics/products/top-selling`: Get top-selling products
  - Query params: limit (default: 10, max: 100)
- **GET** `/api/analytics/products/low-stock`: Get products with low stock
  - Query params: limit (default: 10, max: 100)
- **GET** `/api/analytics/products/by-category`: Get product distribution by category

#### Customer Analytics
- **GET** `/api/analytics/customers`: Get customer statistics and insights
  - Query params: limit (default: 10, max: 100)
  - Returns new vs returning ratio, growth trends, and top customers

### System Routes

#### Health Check
- **GET** `/api/health`: Get system health status
  - Returns:
    - Overall system status (healthy|degraded|unhealthy)
    - Service status (Redis, Firestore)
    - Memory usage
    - Uptime
    - No authentication required
    - Response Time: < 500ms
    - No rate limiting applied

#### Metrics (Admin Only)
- **GET** `/api/metrics`: Get current system metrics
  - Returns:
    - CPU usage
    - Memory usage
    - Request rates
    - Response times
    - Error rates
    - Admin authentication required
    - Cache TTL: 60 seconds

- **GET** `/api/metrics/historical`: Get historical metrics
  - Query params:
    - `startTime`: ISO timestamp
    - `endTime`: ISO timestamp
    - `interval`: (hour|day|week)
  - Returns: Array of metrics for the specified time range
  - Admin authentication required

#### Logs (Admin Only)
- **GET** `/api/logs`: Get system logs
  - Query params:
    - `limit`: Number of logs to return (default: 100)
    - `offset`: Pagination offset (default: 0)
  - Returns: Array of log entries with timestamp, level, and message
  - Admin authentication required

#### Alerts (Admin Only)
- **GET** `/api/alerts/thresholds`: Get alert thresholds
  - Returns current threshold settings for:
    - CPU usage
    - Memory usage
    - Requests per minute
    - Error rate
    - Response time
  - Admin authentication required

- **POST** `/api/alerts/thresholds`: Update alert thresholds
  - Body: Partial threshold settings to update
  - Returns: Updated threshold settings
  - Admin authentication required

### Dashboard Routes (Admin Only)

All dashboard endpoints require admin authentication and include rate limiting and caching.

- **GET** `/api/dashboard/stats`: Get dashboard statistics
  - Returns: Overview statistics for admin dashboard
  - Cache TTL: 5 minutes with 1 minute stale-while-revalidate
  - Admin authentication required

- **GET** `/api/dashboard/recent-orders`: Get recent orders for dashboard
  - Returns: List of recent orders with summary information
  - Cache TTL: 5 minutes with 1 minute stale-while-revalidate
  - Admin authentication required

### Monitoring Routes (Admin Only)

All monitoring endpoints require admin authentication and are rate-limited.

- **GET** `/api/monitoring/metrics/historical`: Get historical system metrics
  - Query params: startTime, endTime, interval
  - Returns: Historical metrics data
  - Admin authentication required

- **GET** `/api/monitoring/alerts/thresholds`: Get monitoring alert thresholds
  - Returns: Current alert threshold settings
  - Admin authentication required

- **GET** `/api/monitoring/logs`: Get system logs
  - Query params: limit, offset
  - Returns: System log entries
  - Admin authentication required

### System Routes (Admin Only)

All system endpoints require admin authentication.

- **GET** `/api/system/metrics`: Get current system metrics
  - Returns: Real-time system performance metrics
  - Admin authentication required

- **GET** `/api/system/metrics/historical`: Get historical system metrics
  - Query params: startTime, endTime, interval
  - Returns: Historical system performance data
  - Admin authentication required

- **GET** `/api/system/logs`: Get system logs
  - Query params: limit, offset
  - Returns: System log entries
  - Admin authentication required

- **GET** `/api/system/alerts/thresholds`: Get system alert thresholds
  - Returns: Current alert threshold configuration
  - Admin authentication required

- **POST** `/api/system/alerts/thresholds`: Update system alert thresholds
  - Body: Threshold settings to update
  - Returns: Updated threshold configuration
  - Admin authentication required

## Setup Instructions
1. Clone the repository.
2. Install dependencies using `npm install`.
3. Create a `.env` file with the required environment variables.
4. Start the server using `npm start` or `npm run dev` for development.

## Technologies Used
- Node.js
- Express
- TypeScript
- Firebase
- Cloudinary
- JWT for authentication

## License
This project is licensed under the ISC License.
