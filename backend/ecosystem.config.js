module.exports = {
  apps: [
    {
      name: 'mawar-commission-backend',
      script: 'src/server.js',
      instances: 'max', // Utilizing all available CPU cores
      exec_mode: 'cluster', // Cluster mode for load balancing
      watch: false, // Turn off watch in production
      max_memory_restart: '1G', // Restart application if memory threshold is hit
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      combine_logs: true,
      time: true,
    },
  ],
};
