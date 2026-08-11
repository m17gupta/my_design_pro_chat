module.exports = {
  apps: [
    {
      name: "chat-app",

      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",

      cwd: "/home/dzinlynxt-luna/htdocs/luna.dzinlynxt.com/my_design_pro_chat",

      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      watch: false,

      max_memory_restart: "1G",

      env: {
        NODE_ENV: "production",
        PORT: 5178
      },

      error_file: "/home/dzinlynxt-luna/logs/chat-app/err.log",
      out_file: "/home/dzinlynxt-luna/logs/chat-app/out.log",

      log_date_format: "YYYY-MM-DD HH:mm:ss",
      time: true,

      kill_timeout: 5000,
      listen_timeout: 10000
    }
  ]
};