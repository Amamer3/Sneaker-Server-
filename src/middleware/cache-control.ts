import { Request, Response, NextFunction } from 'express';

type CacheControlOptions = {
  maxAge?: number;
  staleWhileRevalidate?: number;
  public?: boolean;
  private?: boolean;
};

export const cacheControl = (options: CacheControlOptions = {}) => {
  const {
    maxAge = 300, // 5 minutes default
    staleWhileRevalidate = 60,
    public: isPublic = false,
    private: isPrivate = true
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    const directives = [
      isPublic ? 'public' : null,
      isPrivate ? 'private' : null,
      `max-age=${maxAge}`,
      `stale-while-revalidate=${staleWhileRevalidate}`
    ].filter(Boolean);

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};
