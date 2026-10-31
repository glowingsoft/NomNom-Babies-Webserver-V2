const fs = require("fs");
const path = require("path");

// Release deploys (deploy/release.sh) set APP_ROOT to the `current` symlink, so a pm2 reload picks up the
// newly switched release; locally it is the repository root.
const APP_ROOT = process.env.APP_ROOT || path.resolve(__dirname, "../..");
const LOG_ROOT = path.join(APP_ROOT, "logs");
const PM2_LOG_DIR = path.join(LOG_ROOT, "pm2");

if (!fs.existsSync(LOG_ROOT)) {
  fs.mkdirSync(LOG_ROOT, { recursive: true });
}

if (!fs.existsSync(PM2_LOG_DIR)) {
  fs.mkdirSync(PM2_LOG_DIR, { recursive: true });
}

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "backend-server",
      script: "backend/server.js",
      cwd: APP_ROOT,

      exec_mode: "cluster",
      instances: process.env.PM2_INSTANCES || 1,

      max_memory_restart: "1500M",
      kill_timeout: 8000,
      listen_timeout: 8000,

      restart_delay: 2000,
      exp_backoff_restart_delay: 100,

      output: path.join(PM2_LOG_DIR, "out.log"),
      error: path.join(PM2_LOG_DIR, "error.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      env: {
        NODE_ENV: "dev",
        PORT: process.env.PORT || 4001,
      },

      env_prod: {
        NODE_ENV: "prod",
        PORT: process.env.PORT || 4002,
      },
    },
  ],
};
