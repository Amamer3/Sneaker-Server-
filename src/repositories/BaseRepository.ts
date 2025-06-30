export abstract class BaseRepository<T> {
  protected abstract collection: string;
  
  async findById(id: string): Promise<T | null> {
    // Firestore implementation with caching
    throw new Error("Method not implemented.");
  }
  
  async findMany(filters: Partial<T> = {}): Promise<T[]> {
    // Optimized query with pagination
    throw new Error("Method not implemented.");
  }
  
  async create(data: T extends { id: any } ? Omit<T, 'id'> : T): Promise<T> {
    throw new Error("Method not implemented.");
  }
  
  async update(id: string, data: Partial<T>): Promise<T | null> {
    throw new Error("Method not implemented.");
  }
  
  async delete(id: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}