const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logsDir = path.join(__dirname, '../../logs');

// Ensure logs directory exists (important on deploy: container filesystem has no logs/ folder)
try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch (err) {
  // If we can't create the dir (e.g. read-only filesystem), file transports may fail later;
  // console transport still works
  if (err.code !== 'EEXIST') {
    console.error('[Logger] Could not create logs directory:', err.message);
  }
}

// Custom log levels (error > warn > info > http > debug)
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Color mapping for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan'
};

winston.addColors(colors);

// Determine active log level based on environment
// In production, suppress debug/http; in development, show everything
const activeLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Shared format for file transports (JSON, machine-readable)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Human-readable format for console output in development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? ' ' + JSON.stringify(meta, null, 0)
      : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// Daily-rotating file transport for all logs
const combinedFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d', // keep 14 days of logs
  level: 'debug',
  format: fileFormat,
  zippedArchive: true
});

// Daily-rotating file transport for errors only
const errorFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d', // keep error logs longer
  level: 'error',
  format: fileFormat,
  zippedArchive: true
});

const transports = [
  combinedFileTransport,
  errorFileTransport
];

// Always add console transport; format varies by environment
transports.push(
  new winston.transports.Console({
    level: activeLevel,
    format: process.env.NODE_ENV === 'production'
      ? fileFormat // structured JSON in production console (e.g. Cloud Run)
      : consoleFormat
  })
);

const logger = winston.createLogger({
  levels,
  level: activeLevel,
  transports,
  exitOnError: false
});

module.exports = logger;
