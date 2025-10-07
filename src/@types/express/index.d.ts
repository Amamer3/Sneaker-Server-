declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        uid?: string;
        role: string;
        name?: string;
        email?: string;
      }; 
    }
  }
}