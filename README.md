# Sneakers Backend

## API Endpoints

### Authentication Routes

#### Customer Authentication
- **POST** `/api/auth/register`: Register a new user.
- **POST** `/api/auth/login`: Log in a user.
- **POST** `/api/auth/logout`: Log out a user.
- **GET** `/api/auth/profile`: Get the profile of the logged-in user.

#### Admin Authentication & Management
- **POST** `/api/auth/admin/login`: Admin login (Admin only).
- **POST** `/api/auth/admin/register`: Create a new admin user (Admin only).
- **GET** `/api/users`: Get all users with pagination and search (Admin only).
- **DELETE** `/api/users/:id`: Delete a user (Admin only).

### Product Routes
- **GET** `/api/products`: Get all products.
- **GET** `/api/products/:id`: Get a product by ID.
- **POST** `/api/products`: Create a new product (Admin only).
- **PUT** `/api/products/:id`: Update a product by ID (Admin only).
- **DELETE** `/api/products/:id`: Delete a product by ID (Admin only).

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
   - **POST** `/api/products/:id/reviews` - Add product review
   - **PUT** `/api/products/:id/reviews/:reviewId` - Update review
   - **DELETE** `/api/products/:id/reviews/:reviewId` - Delete review

3. **Product Wishlist**:
   - **GET** `/api/wishlist` - Get user's wishlist
   - **POST** `/api/wishlist/:productId` - Add to wishlist
   - **DELETE** `/api/wishlist/:productId` - Remove from wishlist

4. **Product Cart**:
   - **GET** `/api/cart` - Get user's cart
   - **POST** `/api/cart` - Add item to cart
   - **PUT** `/api/cart/:itemId` - Update cart item
   - **DELETE** `/api/cart/:itemId` - Remove from cart
   - **POST** `/api/cart/checkout` - Process checkout

### Order Routes
- **GET** `/api/orders`: Get all orders.
- **GET** `/api/orders/:id`: Get an order by ID.
- **POST** `/api/orders`: Create a new order.
- **PUT** `/api/orders/:id/status`: Update the status of an order (Admin only).

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
