/**
 * Utility functions for the Daily AI News project
 */

/**
 * Get the current environment, defaulting to production
 */
export function getEnvironment(): string {
  return process.env.NODE_ENV || 'production';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Log a message only in development mode
 */
export function logDev(message: string, ...args: any[]): void {
  if (isDevelopment()) {
    console.log(`[DEV] ${message}`, ...args);
  }
}

/**
 * Log a message only in production mode
 */
export function logProd(message: string, ...args: any[]): void {
  if (isProduction()) {
    console.log(`[PROD] ${message}`, ...args);
  }
}

/**
 * Log a message in both environments
 */
export function logAlways(message: string, ...args: any[]): void {
  console.log(message, ...args);
}

/**
 * Log an error in both environments
 */
export function logError(message: string, ...args: any[]): void {
  console.error(message, ...args);
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  return {
    environment: getEnvironment(),
    isProduction: isProduction(),
    isDevelopment: isDevelopment(),
    verboseLogging: isDevelopment(),
  };
}
