import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getCache, setCache } from '../utils/cache';
import { validateQuery } from '../middleware/zodValidation';
import { ExchangeRateResponse, ExchangeRateQuery, ExchangeRateQuerySchema, CurrencyError } from '../types/currency';
import logger from '../utils/logger';

interface ExchangeRates {
  USD: number;
  GHS: number;
  timestamp: number;
}

const router = Router();
const CACHE_TTL = 3600; // 1 hour

/**
 * @api {get} /api/exchange-rates Get Exchange Rates
 * @apiName GetExchangeRates
 * @apiGroup Currency
 * @apiQuery {String} [base=USD] Base currency code (3 letters)
 * @apiQuery {String} [currencies] Comma-separated list of currency codes
 */
router.get('/exchange-rates', 
  validateQuery(ExchangeRateQuerySchema) as any,
  async (req: Request<{}, {}, {}, ExchangeRateQuery>, res: Response): Promise<void> => {
    try {
      const { base = 'USD', currencies } = req.query;
      const cacheKey = `exchange_rates:${base}${currencies ? `:${currencies}` : ''}`;

      // Try to get from cache first
      const cachedRates = await getCache<ExchangeRateResponse>(cacheKey);
      if (cachedRates) {
        logger.debug(`Cache hit for exchange rates: ${cacheKey}`);
        res.json(cachedRates);
        return;
      }

      logger.debug(`Cache miss for exchange rates: ${cacheKey}`);
      const url = `https://api.exchangerate-api.com/v4/latest/${base.toUpperCase()}`;
      const response = await axios.get<ExchangeRateResponse>(url);
      
      if (!response.data || !response.data.rates) {
        throw new Error('Invalid response from exchange rate API');
      }

      const rates = response.data;
      
      // Filter currencies if specified
      if (currencies) {
        const currencyList = currencies.toUpperCase().split(',');
        const filteredRates: Record<string, number> = {};
        for (const currency of currencyList) {
          if (rates.rates[currency]) {
            filteredRates[currency] = rates.rates[currency];
          }
        }
        rates.rates = filteredRates;
      }

      // Try to cache the results, but continue even if caching fails
      const cached = await setCache(cacheKey, rates, CACHE_TTL);
      if (!cached) {
        logger.warn(`Failed to cache exchange rates for ${cacheKey}`);
      }

      res.json(rates);    } catch (error: unknown) {
      logger.error('Exchange rate error:', error);      
        const isAxiosError = error && typeof error === 'object' && 'isAxiosError' in error;
      if (isAxiosError && (error as any).isAxiosError) {
        const axiosError = error as any;
        const statusCode = axiosError.response?.status || 500;
        const errorResponse: CurrencyError = {
          message: 'Error fetching exchange rates',
          error: axiosError.message || 'Network error',
          status: statusCode,
          code: axiosError.code || 'UNKNOWN'
        };

        if (statusCode === 400) {
          errorResponse.message = 'Invalid currency code';
        } else if (statusCode === 429) {
          errorResponse.message = 'Rate limit exceeded';
        }

        res.status(statusCode).json(errorResponse);
      } else {
        res.status(500).json({ 
          message: 'Error fetching exchange rates',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
});

/**
 * @api {get} /api/exchange-rates/simple Get Simple Exchange Rates
 * @apiName GetSimpleExchangeRates
 * @apiGroup Currency
 * @apiDescription Get exchange rates in a simplified format with USD and GHS
 */
router.get('/simple', async (req: Request, res: Response): Promise<void> => {
  try {
    // Try to get from cache first
    const cacheKey = 'exchange_rates:simple';
    const cachedRates = await getCache<ExchangeRates>(cacheKey);
    
    if (cachedRates) {
      logger.debug(`Cache hit for simple exchange rates: ${cacheKey}`);
      res.json(cachedRates);
      return;
    }

    logger.debug(`Cache miss for simple exchange rates: ${cacheKey}`);
    const response = await axios.get<ExchangeRateResponse>(
      'https://api.exchangerate-api.com/v4/latest/USD'
    );
    
    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    const { rates } = response.data;
    const simplifiedRates: ExchangeRates = {
      USD: 1,
      GHS: rates.GHS || 0,
      timestamp: Date.now()
    };

    // Cache for 1 hour
    await setCache(cacheKey, simplifiedRates, CACHE_TTL);
    
    res.json(simplifiedRates);
  } catch (error) {
    logger.error('Simple exchange rate error:', error);
    
    const isAxiosError = error && typeof error === 'object' && 'isAxiosError' in error;
    if (isAxiosError && (error as any).isAxiosError) {
      const axiosError = error as any;
      const statusCode = axiosError.response?.status || 500;
      const errorResponse: CurrencyError = {
        message: 'Error fetching exchange rates',
        error: axiosError.message || 'Network error',
        status: statusCode,
        code: axiosError.code || 'UNKNOWN'
      };

      if (statusCode === 400) {
        errorResponse.message = 'Invalid currency code';
      } else if (statusCode === 429) {
        errorResponse.message = 'Rate limit exceeded';
      }

      res.status(statusCode).json(errorResponse);
    } else {
      res.status(500).json({ 
        message: 'Error fetching exchange rates',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
});

export default router;
