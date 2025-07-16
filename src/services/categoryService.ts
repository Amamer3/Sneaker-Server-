import { COLLECTIONS } from '../constants/collections';
import { Category } from '../models/Category';
import { FirestoreService } from '../config/firebase';
import { cacheKey, getCache, setCache, clearCache } from '../utils/cache';
import { CustomError } from '../utils/helpers';

const categoriesCollection = FirestoreService.collection(COLLECTIONS.CATEGORIES);

export class CategoryService {
  
  async getAllCategories(): Promise<Category[]> {
    try {
      const cacheKeyStr = cacheKey('categories', { type: 'all' });
      const cached = await getCache<Category[]>(cacheKeyStr);
      if (cached) return cached;

      const snapshot = await categoriesCollection
        .orderBy('name', 'asc')
        .get();

      const categories = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Category[];

      await setCache(cacheKeyStr, categories, 3600); // Cache for 1 hour
      return categories;
    } catch (error) {
      console.error('Error getting categories:', error);
      throw new CustomError('Failed to retrieve categories', 500);
    }
  }

  async getCategoryById(id: string): Promise<Category | null> {
    try {
      const cacheKeyStr = cacheKey('category', { id });
      const cached = await getCache<Category>(cacheKeyStr);
      if (cached) return cached;

      const doc = await categoriesCollection.doc(id).get();
      if (!doc.exists) return null;

      const category = { ...doc.data(), id: doc.id } as Category;
      await setCache(cacheKeyStr, category, 3600);
      return category;
    } catch (error) {
      console.error('Error getting category by ID:', error);
      throw new CustomError('Failed to retrieve category', 500);
    }
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const cacheKeyStr = cacheKey('category', { slug });
      const cached = await getCache<Category>(cacheKeyStr);
      if (cached) return cached;

      const snapshot = await categoriesCollection
        .where('slug', '==', slug)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const category = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Category;
      await setCache(cacheKeyStr, category, 3600);
      return category;
    } catch (error) {
      console.error('Error getting category by slug:', error);
      throw new CustomError('Failed to retrieve category', 500);
    }
  }

  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    try {
      // Validate required fields
      if (!data.name || !data.slug) {
        throw new CustomError('Name and slug are required', 400);
      }

      // Check if slug already exists
      const existingCategory = await this.getCategoryBySlug(data.slug);
      if (existingCategory) {
        throw new CustomError('Category with this slug already exists', 409);
      }

      const now = new Date();
      const categoryData = {
        ...data,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await categoriesCollection.add(categoryData);
      const category = { ...categoryData, id: docRef.id } as Category;

      // Clear cache
      await this.clearCache();

      return category;
    } catch (error) {
      console.error('Error creating category:', error);
      if (error instanceof CustomError) throw error;
      throw new CustomError('Failed to create category', 500);
    }
  }

  async updateCategory(id: string, data: Partial<Omit<Category, 'id'>>): Promise<Category> {
    try {
      const existingCategory = await this.getCategoryById(id);
      if (!existingCategory) {
        throw new CustomError('Category not found', 404);
      }

      // If updating slug, check for conflicts
      if (data.slug && data.slug !== existingCategory.slug) {
        const conflictCategory = await this.getCategoryBySlug(data.slug);
        if (conflictCategory && conflictCategory.id !== id) {
          throw new CustomError('Category with this slug already exists', 409);
        }
      }

      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      await categoriesCollection.doc(id).update(updateData);
      
      const updatedCategory = { ...existingCategory, ...updateData } as Category;

      // Clear cache
      await this.clearCache();

      return updatedCategory;
    } catch (error) {
      console.error('Error updating category:', error);
      if (error instanceof CustomError) throw error;
      throw new CustomError('Failed to update category', 500);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      const category = await this.getCategoryById(id);
      if (!category) {
        throw new CustomError('Category not found', 404);
      }

      // Check if category has child categories
      const childCategories = await categoriesCollection
        .where('parentId', '==', id)
        .limit(1)
        .get();

      if (!childCategories.empty) {
        throw new CustomError('Cannot delete category with subcategories', 400);
      }

      // TODO: Check if category is used by products
      // This would require checking the products collection

      await categoriesCollection.doc(id).delete();

      // Clear cache
      await this.clearCache();
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error instanceof CustomError) throw error;
      throw new CustomError('Failed to delete category', 500);
    }
  }

  async getSubcategories(parentId: string): Promise<Category[]> {
    try {
      const cacheKeyStr = cacheKey('categories', { parentId });
      const cached = await getCache<Category[]>(cacheKeyStr);
      if (cached) return cached;

      const snapshot = await categoriesCollection
        .where('parentId', '==', parentId)
        .orderBy('name', 'asc')
        .get();

      const subcategories = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Category[];

      await setCache(cacheKeyStr, subcategories, 3600);
      return subcategories;
    } catch (error) {
      console.error('Error getting subcategories:', error);
      throw new CustomError('Failed to retrieve subcategories', 500);
    }
  }

  async getRootCategories(): Promise<Category[]> {
    try {
      const cacheKeyStr = cacheKey('categories', { type: 'root' });
      const cached = await getCache<Category[]>(cacheKeyStr);
      if (cached) return cached;

      const snapshot = await categoriesCollection
        .where('parentId', '==', null)
        .orderBy('name', 'asc')
        .get();

      const rootCategories = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Category[];

      await setCache(cacheKeyStr, rootCategories, 3600);
      return rootCategories;
    } catch (error) {
      console.error('Error getting root categories:', error);
      throw new CustomError('Failed to retrieve root categories', 500);
    }
  }

  private async clearCache(): Promise<void> {
    await clearCache('categories:*');
    await clearCache('category:*');
  }

  // Utility method to generate slug from name
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}

export const categoryService = new CategoryService();