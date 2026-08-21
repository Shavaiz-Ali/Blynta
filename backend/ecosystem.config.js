module.exports = {
  apps: [
    {
      name: 'blynta-api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
    {
      name: 'blynta-worker',
      script: 'dist/worker.js',
      instances: 2, // Scale worker count independently
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        RECONCILE_IN_WORKER: 'true',
      },
    },
  ],
};
