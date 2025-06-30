import { OptimizedProductService } from '../services/optimizedProductService';


class DIContainer {
  private services = new Map<string, any>();
  
  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory);
  }
  
  resolve<T>(name: string): T {
    const factory = this.services.get(name);
    if (!factory) throw new Error(`Service ${name} not found`);
    return factory();
  }
}


// Usage in controllers
export const container = new DIContainer();
container.register('productService', () => new OptimizedProductService());