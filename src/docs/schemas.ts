export const ProductSchema = {
  type: 'object',
  required: ['name', 'price', 'category'],
  properties: {
    id: { type: 'string', format: 'uuid', readOnly: true },
    name: { type: 'string', minLength: 1, maxLength: 100 },
    price: { type: 'number', minimum: 0, multipleOf: 0.01 },
    category: { $ref: '#/components/schemas/Category' }
  },
  example: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Air Jordan 1',
    price: 129.99,
    category: 'sneakers'
  }
};