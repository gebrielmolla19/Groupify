/**
 * Logger utility for debugging
 * Supports different log levels and can be toggled via localStorage
 * 
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('Debug message');
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message');
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix: string;
  showTimestamp: boolean;
}

class Logger {
  private config: LoggerConfig = {
    enabled: this.getDebugMode(),
    level: this.getLogLevel(),
    prefix: '[Groupify]',
    showTimestamp: true,
  };

  private getDebugMode(): boolean {
    if (typeof window === 'undefined') return false;
    // Check localStorage for debug mode
    const stored = localStorage.getItem('groupify:debug');
    if (stored !== null) return stored === 'true';
    // Default: enabled in development, disabled in production
    return import.meta.env.DEV;
  }

  private getLogLevel(): LogLevel {
    if (typeof window === 'undefined') return 'error';
    const stored = localStorage.getItem('groupify:logLevel') as LogLevel | null;
    return stored || (import.meta.env.DEV ? 'debug' : 'warn');
  }

  private shouldLog(level: LogLevel): boolean {
    // If disabled, only show errors
    if (!this.config.enabled) {
      return level === 'error';
    }
    
    // If enabled, check log level
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): [string, ...any[]] {
    const timestamp = this.config.showTimestamp 
      ? new Date().toLocaleTimeString() 
      : '';
    const prefix = `${this.config.prefix} [${level.toUpperCase()}]${timestamp ? ` ${timestamp}` : ''}`;
    return [`${prefix} ${message}`, ...args];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(...this.formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(...this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    // Errors are always shown (even when debug is disabled)
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', message, ...args));
    }
  }

  /**
   * Enable/disable debug mode
   * Can be called from browser console: window.groupifyLogger.enable()
   */
  enable(): void {
    // Update config immediately and synchronously
    this.config.enabled = true;
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('groupify:debug', 'true');
    }
    // Use direct console.log to avoid going through the logger
    console.log('[Groupify] Debug logging enabled');
  }

  disable(): void {
    // Update config immediately and synchronously
    this.config.enabled = false;
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('groupify:debug', 'false');
    }
    // Use direct console.log to avoid going through the logger (which might be disabled)
    console.log('[Groupify] Debug logging disabled');
  }

  setLevel(level: LogLevel): void {
    // Update config immediately and synchronously
    this.config.level = level;
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('groupify:logLevel', level);
    }
    // Use direct console.log to avoid going through the logger
    console.log(`[Groupify] Log level set to: ${level}`);
  }

  /**
   * Get current config (useful for debugging)
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Create singleton instance
export const logger = new Logger();

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).groupifyLogger = logger;
  
  // Add helper commands
  (window as any).enableGroupifyDebug = () => {
    logger.enable();
    logger.setLevel('debug');
    console.log('✅ Groupify debug mode enabled! Logs will now appear.');
    console.log('💡 Use logger.disable() to turn off, or logger.setLevel("warn") to reduce verbosity');
  };
  
  (window as any).disableGroupifyDebug = () => {
    logger.disable();
    logger.setLevel('warn'); // Set log level to warn (only show warnings and errors)
    console.log('🔇 Groupify debug mode disabled. Only warnings and errors will be shown.');
    console.log('📊 Current config:', logger.getConfig());
    
    // Test that logging is actually disabled
    console.log('🧪 Testing logger (these should NOT appear):');
    logger.debug('This debug log should NOT appear');
    logger.info('This info log should NOT appear');
    logger.warn('This warn log should appear');
    logger.error('This error log should appear');
  };
}
