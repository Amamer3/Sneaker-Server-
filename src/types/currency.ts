import { z } from 'zod';

export interface ExchangeRateResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
  success?: boolean;
}

export const ExchangeRateQuerySchema = z.object({
  base: z.string().length(3).optional(),
  currencies: z.string().optional(),
});

export type ExchangeRateQuery = z.infer<typeof ExchangeRateQuerySchema>;

export interface CurrencyError {
  message: string;
  error: string;
  status?: number;
  code?: string;
}
