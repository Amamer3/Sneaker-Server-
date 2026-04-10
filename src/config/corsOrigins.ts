const DEFAULT_PRODUCTION_ORIGINS = ['https://www.kicksintel.com', 'https://kicksintel.com'];

const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Origins allowed for CORS and Socket.IO in production.
 * Set FRONTEND_URL to your primary app URL; use CORS_ORIGINS for extras (comma-separated).
 */
export function getAllowedCorsOrigins(): string[] {
  const set = new Set<string>(DEFAULT_PRODUCTION_ORIGINS);
  if (process.env.FRONTEND_URL?.trim()) {
    set.add(process.env.FRONTEND_URL.trim());
  }
  if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((o) => set.add(o));
  }
  return Array.from(set);
}

export function getSocketCorsOrigin(): string[] | string {
  if (process.env.NODE_ENV === 'production') {
    const origins = getAllowedCorsOrigins();
    return origins.length === 1 ? origins[0] : origins;
  }
  return LOCAL_DEV_ORIGINS;
}
