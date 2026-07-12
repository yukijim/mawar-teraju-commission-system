const app = require('./app');
const variables = require('./config/variables');
const { pool } = require('./config/database');

const PORT = variables.PORT || 5000;

// Start Server listening
const server = app.listen(PORT, () => {
  const companyConfig = require('./config/company');
  console.log(`[Server] ${companyConfig.portalName} Backend running on port ${PORT} in [${variables.NODE_ENV}] mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection] Shutting down server gracefully. Error details:', err);
  server.close(() => {
    pool.end().finally(() => {
      process.exit(1);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] Shutting down server gracefully. Error details:', err);
  server.close(() => {
    pool.end().finally(() => {
      process.exit(1);
    });
  });
});

// Graceful shutdown on process termination signals
const shutdown = (signal) => {
  console.log(`[Server] Received ${signal} signal. Shutting down gracefully...`);
  
  server.close(async () => {
    console.log('[Server] Express HTTP server stopped.');
    try {
      await pool.end();
      console.log('[Database] PostgreSQL connection pool terminated successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Database Error] Failed to terminate PostgreSQL connection pool during shutdown:', err.message);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
