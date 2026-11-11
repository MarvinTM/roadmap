// PM2 config for production (villacautela.com/roadmap/, behind nginx).
// Data lives outside the deployed code so `deploy.sh` (rsync --delete) can
// never touch it.
module.exports = {
  apps: [
    {
      name: 'roadmap',
      cwd: __dirname,
      script: 'server/src/index.js',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3002, // tareas-backend owns 3001
        ROADMAP_DATA_FILE: '/var/www/roadmap-data/roadmap.json',
      },
      instances: 1, // must stay 1: the server holds an exclusive lock on the data file
      autorestart: true,
      watch: false,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 10000, // let the server close and release its lock on restart
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
