/**
 * PM2 process file for Stampogen on a shared VPS.
 *
 * Default ports avoid clashing with a typical first site on :3000 / :5000:
 *   - Frontend (Next.js): 3001
 *   - Backend (Express):  5001
 *
 * Usage (from repo root on the VPS):
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'stampogen-api',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      max_memory_restart: '512M',
      time: true,
    },
    {
      name: 'stampogen-web',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '768M',
      time: true,
    },
  ],
};
