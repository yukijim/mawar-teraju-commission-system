const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const compression = require('compression');

const variables = require('./config/variables');
const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler, AppError } = require('./middleware/error');
const healthRouter = require('./routes/health');
const { authenticate, authorize } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const dispatchRouter = require('./routes/dispatch');

const app = express();

// 1. Set Security HTTP Headers
app.use(helmet());

// 2. Enable CORS
app.use(cors({
  origin: true, // Reflects the request origin, or customize as needed
  credentials: true,
}));

// 3. Request Logging via Morgan
if (variables.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 4. Compress response bodies
app.use(compression());

// 5. Body parser, reading data from body into req.body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 6. Parse Cookie header and populate req.cookies
app.use(cookieParser());

// 7. Limit requests from the same IP to API routes
app.use('/api', rateLimiter);

// 8. Register API routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', authenticate(), authorize('ADMIN'), adminRouter);
app.use('/api/dispatch', authenticate(), authorize('DISPATCH'), dispatchRouter);

// 9. Fallback for unhandled routes
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server.`, 404));
});

// 10. Global error handling middleware
app.use(errorHandler);

module.exports = app;
