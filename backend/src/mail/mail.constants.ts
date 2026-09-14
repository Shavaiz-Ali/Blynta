export const MAIL_QUEUE = 'mail';

export const MAIL_JOBS = {
  SEND_OTP: 'send-otp',
  SEND_PASSWORD_RESET: 'send-password-reset',
  SEND_WELCOME: 'send-welcome',
  SEND_REFERRAL_INVITE: 'send-referral-invite',
  SEND_REFERRAL_REWARD: 'send-referral-reward',
  SEND_JOB_COMPLETED: 'send-job-completed',
  SEND_JOB_FAILED: 'send-job-failed',
  SEND_SUBSCRIPTION_ACTIVATED: 'send-subscription-activated',
} as const;
