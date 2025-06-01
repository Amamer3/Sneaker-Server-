# Sneakers Backend

## API Endpoints

### Authentication Routes
- **POST** `/api/auth/register`: Register a new user.
- **POST** `/api/auth/login`: Log in a user.
- **POST** `/api/auth/logout`: Log out a user.
- **GET** `/api/auth/profile`: Get the profile of the logged-in user.
- **POST** `/api/auth/admin/login` : Admin login (Admin only)

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

### User Routes
- **GET** `/api/users`: Get all users (Admin only).
- **GET** `/api/users/:id`: Get a user by ID.
- **PUT** `/api/users/:id`: Update a user by ID.
- **DELETE** `/api/users/:id`: Delete a user by ID (Admin only).

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
