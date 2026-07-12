const variables = require('../config/variables');

/**
 * Custom application error class for handling operational errors.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Express error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (variables.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: {
        name: err.name,
        statusCode: err.statusCode,
        isOperational: err.isOperational
      },
      stack: err.stack,
    });
  } else {
    // Production: Hide sensitive stack traces
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      // Programming or third-party library errors
      console.error('[Unhandled Server Error] ', err);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error occurred.',
      });
    }
  }
};

module.exports = {
  AppError,
  errorHandler,
};
