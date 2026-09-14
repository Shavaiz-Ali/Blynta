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
      instances: 2, // Scale media worker count independently
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        RECONCILE_IN_WORKER: 'true',
      },
    },
    {
      name: 'blynta-mail-worker',
      script: 'dist/mail/mail.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'blynta-notifications-worker',
      script: 'dist/notifications/notifications.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'blynta-activities-worker',
      script: 'dist/activities/activities.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
