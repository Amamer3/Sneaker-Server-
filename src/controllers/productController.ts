import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService';
import cloudinary from '../config/cloudinary';

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let images: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      // Multer array upload
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload((file as any).path, { folder: 'products' });
        images.push(result.secure_url);
      }
    } else if (req.file) {
      // Multer single upload
      const result = await cloudinary.uploader.upload((req.file as any).path, { folder: 'products' });
      images = [result.secure_url];
    }
    const product = await productService.createProduct({ ...req.body, images });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productService.getAllProducts(req.query);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let images: string[] | undefined;
    if (req.files && Array.isArray(req.files)) {
      images = [];
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload((file as any).path, { folder: 'products' });
        images.push(result.secure_url);
      }
    } else if (req.file) {
      const result = await cloudinary.uploader.upload((req.file as any).path, { folder: 'products' });
      images = [result.secure_url];
    }
    const product = await productService.updateProduct(req.params.id, { ...req.body, ...(images ? { images } : {}) });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
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
