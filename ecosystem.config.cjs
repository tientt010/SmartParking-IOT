// PM2 Ecosystem Config for SmartParking-Pi
// Run with: pm2 start ecosystem.config.cjs
// Auto-start on boot: pm2 startup && pm2 save
module.exports = {
  apps: [
    {
      name: "sp-backend",
      cwd: "/home/viethuy/smartparking/source/backend",
      script: "server.js",
      interpreter: "node",
      max_memory_restart: "300M",
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/home/viethuy/smartparking/logs/backend-error.log",
      out_file: "/home/viethuy/smartparking/logs/backend-out.log",
    },
    {
      name: "sp-ai",
      cwd: "/home/viethuy/smartparking/source/ai-service",
      script: "app.py",
      interpreter: "/home/viethuy/smartparking/source/ai-service/venv/bin/python3",
      max_memory_restart: "700M",
      restart_delay: 5000,
      env: {
        PORT: 5001,
      },
      error_file: "/home/viethuy/smartparking/logs/ai-error.log",
      out_file: "/home/viethuy/smartparking/logs/ai-out.log",
    },
    {
      name: "sp-driver",
      cwd: "/home/viethuy/smartparking/source/pi-driver",
      script: "driver.py",
      interpreter: "/home/viethuy/smartparking/source/pi-driver/venv/bin/python3",
      max_memory_restart: "100M",
      restart_delay: 2000,
      error_file: "/home/viethuy/smartparking/logs/driver-error.log",
      out_file: "/home/viethuy/smartparking/logs/driver-out.log",
    },
  ],
};
