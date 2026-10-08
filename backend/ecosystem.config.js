module.exports = {
  // One canonical process list. Deploy from any working directory.
  apps: [
    {
      name: 'blynta-api',
      cwd: __dirname,
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
    {
      name: 'blynta-worker',
      cwd: __dirname,
      script: 'dist/src/worker.js',
      instances: 1, // Current 1 GB / 2 vCPU EC2 capacity, independent of user count
      exec_mode: 'fork',
      kill_timeout: 20000,
      restart_delay: 3000,
      treekill: true,
      env: {
        NODE_ENV: 'production',
        RECONCILE_IN_WORKER: 'true',
        MEDIA_WORKER_ROLE: 'all',
        PIPELINE_CONCURRENCY: '1',
        RENDER_CONCURRENCY: '1',
        RENDER_GLOBAL_CONCURRENCY: '1',
        STUDIO_CONCURRENCY: '1',
        MEDIA_HOST_CONCURRENCY: '1',
        MEDIA_HOST_LOCK_DIR: '/tmp/blynta-media-slots',
        FFMPEG_THREADS: '1',
        MEDIA_COMMAND_TIMEOUT_SECONDS: '1800',
      },
    },
    {
      name: 'blynta-mail-worker',
      cwd: __dirname,
      script: 'dist/src/mail/mail.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'blynta-notifications-worker',
      cwd: __dirname,
      script: 'dist/src/notifications/notifications.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'blynta-activities-worker',
      cwd: __dirname,
      script: 'dist/src/activities/activities.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
