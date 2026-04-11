import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import type { Request } from 'express';

function clientKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return String(ip);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Limits password-reset requests per IP (abuse / email flooding). */
export const forgotPasswordIpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parsePositiveInt(process.env.PW_RESET_IP_MAX, 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many reset attempts from this network. Please try again later.',
  },
  keyGenerator: (req) => `pwreset-ip:${clientKey(req)}`,
});

/**
 * Limits reset emails per normalized address (reduces targeted harassment of one inbox).
 * Runs after body validation so `email` is present and well-formed.
 */
export const forgotPasswordEmailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parsePositiveInt(process.env.PW_RESET_EMAIL_MAX, 3),
  standardHeaders: false,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many reset attempts for this email. Please try again later.',
  },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const hash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
    return `pwreset-email:${hash}`;
  },
});

/** Limits JWT completion attempts per IP (credential-stuffing / token guessing). */
export const resetPasswordWithTokenIpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parsePositiveInt(process.env.PW_RESET_TOKEN_IP_MAX, 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
  },
  keyGenerator: (req) => `pwreset-token-ip:${clientKey(req)}`,
});
