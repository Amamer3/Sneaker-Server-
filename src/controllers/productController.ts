import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService';
import { CloudinaryService } from '../config/cloudinary';
import { Product } from '../models/Product';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const handleImageUpload = async (file: Express.Multer.File) => {
  try {
    const result = await CloudinaryService.uploadImage(file.path, {
      width: 800,
      height: 800,
      quality: 90
    });

    // Clean up temporary file
    await fs.unlink(file.path).catch(console.error);
    
    return result;
  } catch (error) {
    // Clean up temporary file even if upload fails
    await fs.unlink(file.path).catch(console.error);
    throw error;
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Creating product with data:', req.body);
    console.log('Files received:', req.files);

    let images: Product['images'] = [];
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
    
    if (files) {
      let uploadFiles: Express.Multer.File[] = [];
      
      if (Array.isArray(files)) {
        uploadFiles = files;
      } else {
        // Combine all files from different fields
        uploadFiles = Object.values(files).flat();
      }
      
      console.log(`Processing ${uploadFiles.length} images`);
      
      const uploadPromises = uploadFiles.map(async (file, index) => {
        console.log(`Uploading image ${index + 1}:`, file.originalname);
        const result = await handleImageUpload(file);
        console.log(`Image ${index + 1} uploaded successfully:`, result.secure_url);
        
        return {
          id: uuidv4(),
          url: result.secure_url,
          order: index,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format
        };
      });
      
      images = await Promise.all(uploadPromises);
      console.log('All images processed:', images);
    }

    // Create the product with images
    // Set default values and convert types appropriately
    const stock = req.body.stock ? Number(req.body.stock) : 0;
    const productData = {
      ...req.body,
      price: Number(req.body.price),
      stock: stock,
      sizes: Array.isArray(req.body.sizes) ? req.body.sizes : (req.body.sizes ? JSON.parse(req.body.sizes) : []),
      images,
      inStock: req.body.inStock === true || req.body.inStock === 'true',
      featured: req.body.featured === true || req.body.featured === 'true',
      createdAt: new Date(),
      updatedAt: new Date(),
      searchTokens: createSearchTokens(req.body.name, req.body.brand, req.body.category)
    };

    console.log('Creating product with final data:', productData);
    const product = await productService.createProduct(productData);
    console.log('Product created successfully:', product);

    // Force cache invalidation to ensure updated data is returned
    await productService.invalidateCache();

    // Return the complete product data
    res.status(201).json(product);
  } catch (error) {
    console.error('Error in createProduct:', error);
    next(error);
  }
};

// Helper function to generate search tokens
function createSearchTokens(name: string, brand: string, category: string): string[] {
  const tokens = new Set<string>();
  
  // Add full strings
  tokens.add(name.toLowerCase());
  tokens.add(brand.toLowerCase());
  tokens.add(category.toLowerCase());
  
  // Add word tokens
  const words = `${name} ${brand} ${category}`.toLowerCase().split(/\s+/);
  words.forEach(word => tokens.add(word));
  
  // Add partial matches (ngrams)
  words.forEach(word => {
    for (let i = 1; i <= word.length; i++) {
      tokens.add(word.substring(0, i));
    }
  });
  
  return Array.from(tokens);
};

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productService.getAllProducts(req.query);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.params.id;
    const existingProduct = await productService.getProductById(productId);
    
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let images = existingProduct.images;

    if (req.files && Array.isArray(req.files)) {
      const uploadPromises = (req.files as Express.Multer.File[]).map(async (file, index) => {
        const result = await handleImageUpload(file);
        return {
          id: uuidv4(),
          url: result.secure_url,
          order: images.length + index,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format
        };
      });
      
      const newImages = await Promise.all(uploadPromises);
      images = [...images, ...newImages];
    }

    const updatedData = {
      ...req.body,
      images,
      price: req.body.price ? Number(req.body.price) : undefined,
      stock: req.body.stock ? Number(req.body.stock) : undefined,
      sizes: req.body.sizes ? JSON.parse(req.body.sizes) : undefined,
      inStock: req.body.stock ? Number(req.body.stock) > 0 : undefined,
      featured: req.body.featured ? req.body.featured === 'true' : undefined
    };

    // Get user information for inventory synchronization
    const authReq = req as AuthRequest;
    const updatedBy = authReq.user?.id || 'system';
    
    const product = await productService.updateProduct(productId, updatedData, updatedBy);
    await productService.invalidateCache();
    
    res.json(product);
  } catch (error) {
    console.error('Error in updateProduct:', error);
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await productService.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

export const updateStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.updateProduct(req.params.id, { inStock: req.body.inStock });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const toggleFeatured = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.updateProduct(req.params.id, { featured: req.body.featured });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const uploadImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    console.log(`Uploading images for product ${id}`);
    console.log('Files received:', req.files);

    // Get existing product
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let newImages: Product['images'] = [];
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;
    
    if (!files || (Array.isArray(files) && files.length === 0) || (!Array.isArray(files) && Object.keys(files).length === 0)) {
      return res.status(400).json({ message: 'No images provided' });
    }

    try {
      let uploadFiles: Express.Multer.File[] = [];
      if (Array.isArray(files)) {
        uploadFiles = files;
      } else {
        uploadFiles = Object.values(files).flat();
      }

      console.log(`Processing ${uploadFiles.length} new images`);

      const uploadPromises = uploadFiles.map(async (file, index) => {
        console.log(`Uploading image ${index + 1}:`, file.originalname);
        const result = await handleImageUpload(file);
        console.log(`Image ${index + 1} uploaded successfully:`, result.secure_url);
        
        return {
          id: uuidv4(),
          url: result.secure_url,
          order: existingProduct.images.length + index,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format
        };
      });

      newImages = await Promise.all(uploadPromises);
      console.log('All new images processed:', newImages);

      // Combine existing and new images
      const updatedImages = [...existingProduct.images, ...newImages];

      // Update product with new images
      const updatedProduct = await productService.updateProduct(id, {
        images: updatedImages,
        updatedAt: new Date()
      });

      // Force cache invalidation
      await productService.invalidateCache();

      res.json(updatedProduct);
    } catch (error) {
      console.error('Error processing images:', error);
      // Clean up any uploaded images if there was an error
      for (const image of newImages) {
        if (image.publicId) {
          await CloudinaryService.deleteImage(image.publicId).catch(console.error);
        }
      }
      throw new Error('Failed to process images');
    }
  } catch (error) {
    console.error('Error in uploadImages:', error);
    next(error);
  }
};

export const deleteImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: productId, imageId } = req.params;
    
    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const imageToDelete = product.images.find(img => img.id === imageId);
    if (!imageToDelete) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Delete from Cloudinary
    if (imageToDelete.publicId) {
      await CloudinaryService.deleteImage(imageToDelete.publicId);
    }

    // Remove image and reorder remaining images
    const updatedImages = product.images
      .filter(img => img.id !== imageId)
      .map((img, index) => ({ ...img, order: index }));

    const updatedProduct = await productService.updateProduct(productId, { 
      images: updatedImages 
    });

    await productService.invalidateCache();
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error in deleteImage:', error);
    next(error);
  }
};

export const reorderImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: productId } = req.params;
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ message: 'imageIds must be an array' });
    }

    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Create a map of existing images
    const imageMap = new Map(product.images.map(img => [img.id, img]));

    // Validate all imageIds exist
    if (!imageIds.every(id => imageMap.has(id))) {
      return res.status(400).json({ message: 'Invalid image ID provided' });
    }

    // Reorder images
    const updatedImages = imageIds.map((id, index) => ({
      ...imageMap.get(id)!,
      order: index
    }));

    const updatedProduct = await productService.updateProduct(productId, { images: updatedImages });
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

export const getProductFilters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = await productService.getProductFilters();
    res.json(filters);
  } catch (error) {
    console.error('Error getting product filters:', error);
    next(error);
  }
};

export const getFeaturedProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = 6 } = req.query;
    const products = await productService.getAllProducts({
      limit: Number(limit),
      featured: true,
      inStock: true
    });
    res.json(products);
  } catch (error) {
    console.error('Error getting featured products:', error);
    next(error);
  }
};

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: productId } = req.params;
    const reviews = await productService.getProductReviews(productId);
    res.json(reviews);
  } catch (error) {
    console.error('Error getting product reviews:', error);
    next(error);
  }
};

export const addProductReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user!.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const review = await productService.addProductReview(productId, userId, {
      rating,
      comment
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Error adding product review:', error);
    next(error);
  }
};
