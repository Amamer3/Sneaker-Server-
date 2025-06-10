import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Sneakers Store API',
    version: '1.0.0',
    description: 'API documentation for the Sneakers Store backend',
    contact: {
      name: 'API Support',
      url: 'https://github.com/Amamer3/Sneaker-Server-'
    }
  },
  servers: [
    {
      url: 'https://sneaker-server-7gec.onrender.com/api',
      description: 'Production server'
    },
    {
      url: 'http://localhost:5000/api',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      CartItem: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number' },
          price: { type: 'number' },
          size: { type: 'string' },
          name: { type: 'string' },
          image: { type: 'string' }
        },
        required: ['productId', 'quantity', 'price']
      },
      Cart: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/CartItem' }
          },
          total: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          images: {
            type: 'array',
            items: { type: 'string' }
          },
          sizes: {
            type: 'array',
            items: { type: 'string' }
          },
          category: { type: 'string' },
          stock: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/CartItem' }
          },
          totalAmount: { type: 'number' },
          shipping: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              postalCode: { type: 'string' }
            }
          },
          paymentMethod: { type: 'string' },
          paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed'] },
          orderStatus: { type: 'string', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
          phone: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] },
          phone: { type: 'string' },
          addresses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                city: { type: 'string' },
                country: { type: 'string' },
                postalCode: { type: 'string' }
              }
            }
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          productId: { type: 'string' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Wishlist: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          products: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' }
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Analytics: {
        type: 'object',
        properties: {
          sales: {
            type: 'object',
            properties: {
              daily: { type: 'number' },
              weekly: { type: 'number' },
              monthly: { type: 'number' }
            }
          },
          orders: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              pending: { type: 'number' },
              completed: { type: 'number' }
            }
          },
          products: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              lowStock: { type: 'number' }
            }
          },
          users: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              new: { type: 'number' }
            }
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          error: { type: 'string' }
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Access token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      ValidationError: {
        description: 'Invalid input data',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    }
  },
  tags: [
    { name: 'Cart', description: 'Shopping cart operations' },
    { name: 'Products', description: 'Product catalog operations' },
    { name: 'Categories', description: 'Product categories' },
    { name: 'Orders', description: 'Order management' },
    { name: 'Auth', description: 'Authentication and authorization' },
    { name: 'Users', description: 'User management' },
    { name: 'Reviews', description: 'Product reviews' },
    { name: 'Wishlist', description: 'User wishlists' },
    { name: 'Analytics', description: 'Business analytics and metrics' },
    { name: 'Payment', description: 'Payment processing' },
    { name: 'Delivery', description: 'Delivery management' },
    { name: 'System', description: 'System operations and monitoring' }
  ]
};

const options = {
  swaggerDefinition,
  apis: [
    './src/routes/*.docs.ts',
    './src/routes/analytics.ts',
    './src/routes/auth.ts',
    './src/routes/cart.ts',
    './src/routes/categories.ts',
    './src/routes/delivery.ts',
    './src/routes/orders.ts',
    './src/routes/payment.ts',
    './src/routes/products.ts',
    './src/routes/reviews.ts',
    './src/routes/system.ts',
    './src/routes/users.ts',
    './src/routes/wishlist.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(options);
