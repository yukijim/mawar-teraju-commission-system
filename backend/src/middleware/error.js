const variables = require('../config/variables');

/**
 * Custom application error class for handling operational errors.
 * Now captures programmatic error code and errors array.
 */
class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_SERVER_ERROR', errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Express error handling middleware
 * Enforces standardized response structure: { success: false, code, message, errors }
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_SERVER_ERROR';
  err.errors = err.errors || [];

  const responsePayload = {
    success: false,
    code: err.code,
    message: err.message,
    errors: err.errors,
  };

  if (variables.NODE_ENV === 'development') {
    responsePayload.stack = err.stack;
    return res.status(err.statusCode).json(responsePayload);
  } else {
    // Production Mode: Limit exposure of sensitive debug information
    if (err.isOperational) {
      return res.status(err.statusCode).json(responsePayload);
    } else {
      // Unhandled programming error or third-party package error
      console.error('[Unhandled Server Error] ', err);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error occurred.',
        errors: [],
      });
    }
  }
};

module.exports = {
  AppError,
  errorHandler,
};
