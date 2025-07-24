import { CloudinaryService } from '../config/cloudinary';
import { FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { Product, ProductImage } from '../models/Product';

const productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);

export async function cleanupInvalidImages(): Promise<void> {
  console.log('🧹 Starting cleanup of invalid image URLs...');
  
  try {
    const snapshot = await productsCollection.get();
    let totalProducts = 0;
    let productsUpdated = 0;
    let imagesRemoved = 0;
    
    for (const doc of snapshot.docs) {
      totalProducts++;
      const product = doc.data() as Product;
      
      if (!product.images || product.images.length === 0) {
        continue;
      }
      
      console.log(`Checking product: ${product.name} (${product.images.length} images)`);
      
      const validImages: ProductImage[] = [];
      let hasInvalidImages = false;
      
      for (const image of product.images) {
        if (!image.url) {
          console.log(`  ❌ Removing image with no URL`);
          hasInvalidImages = true;
          imagesRemoved++;
          continue;
        }
        
        // Check if URL is accessible
        const isValid = await CloudinaryService.validateImageUrl(image.url);
        
        if (isValid) {
          validImages.push(image);
          console.log(`  ✅ Valid image: ${image.url}`);
        } else {
          console.log(`  ❌ Invalid image (404): ${image.url}`);
          hasInvalidImages = true;
          imagesRemoved++;
          
          // Try to delete from Cloudinary if we can extract the public ID
          const publicId = CloudinaryService.extractPublicId(image.url);
          if (publicId) {
            try {
              await CloudinaryService.deleteImage(publicId);
              console.log(`  🗑️ Deleted from Cloudinary: ${publicId}`);
            } catch (error) {
              console.log(`  ⚠️ Could not delete from Cloudinary: ${publicId}`);
            }
          }
        }
      }
      
      // Update product if we found invalid images
      if (hasInvalidImages) {
        await doc.ref.update({
          images: validImages,
          updatedAt: new Date()
        });
        
        productsUpdated++;
        console.log(`  📝 Updated product with ${validImages.length} valid images`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`  - Total products checked: ${totalProducts}`);
    console.log(`  - Products updated: ${productsUpdated}`);
    console.log(`  - Invalid images removed: ${imagesRemoved}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run cleanup if this file is executed directly
if (require.main === module) {
  cleanupInvalidImages()
    .then(() => {
      console.log('✅ Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}