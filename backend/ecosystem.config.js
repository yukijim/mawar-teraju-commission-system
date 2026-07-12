module.exports = {
  apps: [
    {
      name: 'mawar-commission-backend',
      script: 'src/server.js',
      instances: 'max', // Cluster mode uses all available CPU cores on the VPS
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
