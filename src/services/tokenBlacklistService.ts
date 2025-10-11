import { getCache, setCache } from '../utils/cache';
import Logger from '../utils/logger';

export class TokenBlacklistService {
  private static readonly BLACKLIST_PREFIX = 'blacklisted_token:';
  private static readonly TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Add a token to the blacklist
   */
  static async blacklistToken(token: string): Promise<void> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${token}`;
      await setCache(key, true, this.TTL);
      Logger.info('Token blacklisted successfully');
    } catch (error) {
      Logger.error('Error blacklisting token:', error);
      throw new Error('Failed to blacklist token');
    }
  }

  /**
   * Check if a token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${token}`;
      const blacklisted = await getCache(key);
      return !!blacklisted;
    } catch (error) {
      Logger.error('Error checking token blacklist:', error);
      return false; // Fail open - allow token if check fails
    }
  }

  /**
   * Extract token from authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.split(' ')[1];
  }
}
