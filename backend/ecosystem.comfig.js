module.exports = {
  apps: [
    {
      name: 'blynta-api',
      script: 'dist/main.js',
      cwd: '/home/ec2-user/Blynta/backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-general',
      script: 'dist/worker.js',
      cwd: '/home/ec2-user/Blynta/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-notifications',
      script: 'dist/notifications/notifications.worker.js',
      cwd: '/home/ec2-user/Blynta/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-mail',
      script: 'dist/mail/mail.worker.js',
      cwd: '/home/ec2-user/Blynta/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-activities',
      script: 'dist/activities/activities.worker.js',
      cwd: '/home/ec2-user/Blynta/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-youtube',
      script: 'dist/youtube-worker.js',
      cwd: '/home/ec2-user/Blynta/backend',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};