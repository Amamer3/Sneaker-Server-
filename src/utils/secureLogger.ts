import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Sensitive data patterns to redact from logs
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /authorization/i,
  /bearer/i,
  /jwt/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /client[_-]?secret/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /ssn/i,
  /social[_-]?security/i,
  /phone[_-]?number/i,
  /email/i,
  /address/i
];

// Redact sensitive information from log messages
const redactSensitiveData = (message: string): string => {
  let redactedMessage = message;
  
  SENSITIVE_PATTERNS.forEach(pattern => {
    redactedMessage = redactedMessage.replace(pattern, '[REDACTED]');
  });
  
  // Redact JWT tokens (format: eyJ...)
  redactedMessage = redactedMessage.replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, '[JWT_TOKEN]');
  
  // Redact email addresses
  redactedMessage = redactedMessage.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  
  // Redact phone numbers
  redactedMessage = redactedMessage.replace(/(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, '[PHONE]');
  
  // Redact credit card numbers
  redactedMessage = redactedMessage.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_NUMBER]');
  
  return redactedMessage;
};

// Custom format for secure logging
const secureFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const redactedMessage = redactSensitiveData(String(message));
    const redactedStack = stack ? redactSensitiveData(String(stack)) : undefined;
    
    let logEntry = `${timestamp} ${level}: ${redactedMessage}`;
    
    if (redactedStack) {
      logEntry += `\n${redactedStack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      const redactedMeta = JSON.stringify(meta, (key, value) => {
        if (typeof value === 'string') {
          return redactSensitiveData(value);
        }
        return value;
      });
      logEntry += ` ${redactedMeta}`;
    }
    
    return logEntry;
  })
);

// Create secure logger
const secureLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: secureFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        secureFormat
      )
    }),
    new DailyRotateFile({
      filename: 'logs/secure-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
    }),
    new DailyRotateFile({
      filename: 'logs/secure-all-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

// Secure error logging function
export const logSecureError = (error: Error, context?: any): void => {
  secureLogger.error('Application error', {
    error: error.message,
    stack: error.stack,
    context: context ? JSON.stringify(context) : undefined
  });
};

// Secure info logging function
export const logSecureInfo = (message: string, meta?: any): void => {
  secureLogger.info(message, meta);
};

// Secure warning logging function
export const logSecureWarn = (message: string, meta?: any): void => {
  secureLogger.warn(message, meta);
};

// Secure debug logging function
export const logSecureDebug = (message: string, meta?: any): void => {
  secureLogger.debug(message, meta);
};

export default secureLogger;
