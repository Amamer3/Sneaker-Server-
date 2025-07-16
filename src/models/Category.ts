export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image?: string;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
