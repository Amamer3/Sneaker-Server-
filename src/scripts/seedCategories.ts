import { categoryService } from '../services/categoryService';
import { Category } from '../models/Category';

const initialCategories: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Men's",
    slug: 'mens',
    description: 'Sneakers and footwear for men',
    parentId: null,
    isActive: true,
    sortOrder: 1
  },
  {
    name: "Women's",
    slug: 'womens',
    description: 'Sneakers and footwear for women',
    parentId: null,
    isActive: true,
    sortOrder: 2
  },
  {
    name: "Kids",
    slug: 'kids',
    description: 'Sneakers and footwear for kids',
    parentId: null,
    isActive: true,
    sortOrder: 3
  }
];

export const seedCategories = async (): Promise<void> => {
  try {
    console.log('🌱 Starting category seeding...');
    
    // Check if categories already exist
    const existingCategories = await categoryService.getAllCategories();
    
    if (existingCategories.length > 0) {
      console.log('📋 Categories already exist. Skipping seeding.');
      return;
    }
    
    // Create initial categories
    const createdCategories: Category[] = [];
    
    for (const categoryData of initialCategories) {
      try {
        const category = await categoryService.createCategory(categoryData);
        createdCategories.push(category);
        console.log(`✅ Created category: ${category.name} (${category.slug})`);
      } catch (error) {
        console.error(`❌ Failed to create category ${categoryData.name}:`, error);
      }
    }
    
    console.log(`🎉 Successfully seeded ${createdCategories.length} categories`);
    
    // Log created categories for reference
    console.log('\n📋 Created categories:');
    createdCategories.forEach(category => {
      console.log(`  - ID: ${category.id}, Name: ${category.name}, Slug: ${category.slug}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedCategories()
    .then(() => {
      console.log('✅ Category seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Category seeding failed:', error);
      process.exit(1);
    });
}