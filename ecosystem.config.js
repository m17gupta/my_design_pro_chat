module.exports = {
  apps: [
    {
      name: "chat-app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production"
      },
      error_file: "~/logs/chat-app/err.log",
      out_file: "~/logs/chat-app/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      time: true
    }
  ]
};