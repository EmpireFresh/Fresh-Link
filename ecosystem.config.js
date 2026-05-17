module.exports = {
  apps: [{
    name: 'freshlink',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: 'C:/Users/Laptop/Fresh_Link',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      PORT: '3000'
    },
    restart_delay: 3000,
    max_restarts: 10,
  }]
}
