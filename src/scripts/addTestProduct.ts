import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';

async function addTestProduct() {
  const productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);
  
  const testProduct = {
    name: "Nike Air Max 2025",
    brand: "Nike",
    description: "The latest Air Max model with revolutionary cushioning.",
    price: 199.99,
    category: "Running",
    sizes: ["40", "41", "42", "43", "44"],
    images: [{
      id: "1",
      url: "https://example.com/nike-air-max-2025.jpg",
      order: 1
    }],
    inStock: true,
    stock: 50,
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    const docRef = await productsCollection.add(testProduct);
    console.log('Added test product with ID:', docRef.id);
  } catch (error) {
    console.error('Error adding test product:', error);
  }
}

addTestProduct().then(() => process.exit());
