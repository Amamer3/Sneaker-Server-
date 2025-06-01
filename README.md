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
