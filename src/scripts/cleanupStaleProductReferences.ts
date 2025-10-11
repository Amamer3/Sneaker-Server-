import { FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { getAllProducts } from '../services/productService';

/**
 * Script to clean up stale product references in carts and wishlists
 * This should be run periodically to maintain data integrity
 */
export async function cleanupStaleProductReferences(): Promise<void> {
  console.log('🧹 Starting cleanup of stale product references...');
  
  try { 
    // Get all products to create a lookup set
    const productsResponse = await getAllProducts();
    const validProductIds = new Set(productsResponse.items.map((p: any) => p.id));
    
    console.log(`Found ${validProductIds.size} valid products`);
    
    // Clean up cart references
    const cartsCollection = FirestoreService.collection(COLLECTIONS.CARTS);
    const cartsSnapshot = await cartsCollection.get();
    
    let cartsUpdated = 0;
    let cartItemsRemoved = 0;
    
    for (const cartDoc of cartsSnapshot.docs) {
      const cartData = cartDoc.data();
      if (cartData.items && Array.isArray(cartData.items)) {
        const originalItemCount = cartData.items.length;
        const validItems = cartData.items.filter((item: any) => 
          validProductIds.has(item.productId)
        );
        
        if (validItems.length !== originalItemCount) {
          await cartDoc.ref.update({
            items: validItems,
            updatedAt: new Date()
          });
          
          cartsUpdated++;
          cartItemsRemoved += (originalItemCount - validItems.length);
          
          console.log(`Updated cart ${cartDoc.id}: removed ${originalItemCount - validItems.length} invalid items`);
        }
      }
    }
    
    // Clean up wishlist references
    const wishlistsCollection = FirestoreService.collection(COLLECTIONS.WISHLISTS);
    const wishlistsSnapshot = await wishlistsCollection.get();
    
    let wishlistsUpdated = 0;
    let wishlistItemsRemoved = 0;
    
    for (const wishlistDoc of wishlistsSnapshot.docs) {
      const wishlistData = wishlistDoc.data();
      if (wishlistData.items && Array.isArray(wishlistData.items)) {
        const originalItemCount = wishlistData.items.length;
        const validItems = wishlistData.items.filter((item: any) => 
          validProductIds.has(item.productId)
        );
        
        if (validItems.length !== originalItemCount) {
          await wishlistDoc.ref.update({
            items: validItems,
            updatedAt: new Date()
          });
          
          wishlistsUpdated++;
          wishlistItemsRemoved += (originalItemCount - validItems.length);
          
          console.log(`Updated wishlist ${wishlistDoc.id}: removed ${originalItemCount - validItems.length} invalid items`);
        }
      }
    }
    
    console.log('\n🎉 Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`  - Carts updated: ${cartsUpdated}`);
    console.log(`  - Cart items removed: ${cartItemsRemoved}`);
    console.log(`  - Wishlists updated: ${wishlistsUpdated}`);
    console.log(`  - Wishlist items removed: ${wishlistItemsRemoved}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanupStaleProductReferences()
    .then(() => {
      console.log('✅ Cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}
