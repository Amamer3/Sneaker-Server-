import { logSecureError } from './secureLogger';

// Required environment variables
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
]; 

// Optional environment variables with defaults
const OPTIONAL_ENV_VARS = [
  { name: 'NODE_ENV', default: 'development' },
  { name: 'PORT', default: '3000' },
  { name: 'LOG_LEVEL', default: 'info' },
  { name: 'REDIS_URL', default: '' },
  { name: 'PAYSTACK_SECRET_KEY', default: '' },
  { name: 'PAYSTACK_PUBLIC_KEY', default: '' },
  { name: 'JWT_REFRESH_SECRET', default: '' } // Will be generated if empty
];

// Validate environment variables
export const validateEnvironment = (): void => {
  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  // Check required variables
  REQUIRED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Check optional variables and set defaults
  OPTIONAL_ENV_VARS.forEach(({ name, default: defaultValue }) => {
    if (!process.env[name]) {
      if (name === 'JWT_REFRESH_SECRET' && defaultValue === '') {
        // Generate a secure refresh secret if not provided
        process.env[name] = generateSecureSecret(64);
        console.log(`🔐 Generated JWT_REFRESH_SECRET (${name} was not provided)`);
      } else {
        process.env[name] = defaultValue;
      }
    }
  });

  // Validate specific variables
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    invalidVars.push('JWT_SECRET must be at least 32 characters long');
  }

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    invalidVars.push('JWT_REFRESH_SECRET must be at least 32 characters long');
  }

  if (process.env.PORT && isNaN(parseInt(process.env.PORT))) {
    invalidVars.push('PORT must be a valid number');
  }

  // Log and exit if there are issues
  if (missingVars.length > 0) {
    const error = new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logSecureError(error);
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
  }

  if (invalidVars.length > 0) {
    const error = new Error(`Invalid environment variables: ${invalidVars.join(', ')}`);
    logSecureError(error);
    console.error('❌ Invalid environment variables:', invalidVars.join(', '));
    process.exit(1);
  }

  console.log('✅ Environment variables validated successfully');
};

// Generate secure random strings for JWT secrets
export const generateSecureSecret = (length: number = 64): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

// Validate JWT secret strength
export const validateJWTSecret = (secret: string): boolean => {
  return secret.length >= 32 && /^[a-zA-Z0-9+/=]+$/.test(secret);
};
