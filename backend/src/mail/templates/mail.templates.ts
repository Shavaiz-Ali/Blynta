function baseEmailLayout(contentHtml: string, previewText: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blynta</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f17;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f17;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #111827;
      border: 1px solid #1f293d;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 28px 32px 20px;
      border-bottom: 1px solid #1f293d;
      text-align: center;
    }
    .logo {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #38bdf8;
      text-decoration: none;
    }
    .body {
      padding: 32px;
      line-height: 1.6;
      font-size: 15px;
      color: #cbd5e1;
    }
    .footer {
      padding: 20px 32px;
      border-top: 1px solid #1f293d;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .button {
      display: inline-block;
      background-color: #0ea5e9;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      margin-top: 20px;
      margin-bottom: 12px;
    }
    .code-box {
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 6px;
      text-align: center;
      color: #38bdf8;
      margin: 20px 0;
      font-family: monospace;
    }
    .highlight-card {
      background-color: #1e293b;
      border-left: 4px solid #38bdf8;
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin: 20px 0;
      font-size: 14px;
      color: #e2e8f0;
    }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="logo">Blynta</span>
      </div>
      <div class="body">
        ${contentHtml}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px;">&copy; ${new Date().getFullYear()} Blynta. AI-Powered Video Repurposing.</p>
        <p style="margin: 0;">You're receiving this email because of your account activity on Blynta.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const otpEmailTemplate = (otp: string) => ({
  subject: `${otp} is your Blynta verification code`,
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Verify your email address</h2>
    <p>Please enter the verification code below to confirm your account and get started:</p>
    <div class="code-box">${otp}</div>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">This code expires in 10 minutes. If you didn't request this verification, you can safely ignore this email.</p>
  `, `Your verification code is ${otp}`),
});

export const passwordResetEmailTemplate = (resetUrl: string) => ({
  subject: 'Reset your Blynta password',
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Password Reset Request</h2>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
  `, 'Reset your Blynta password'),
});

export const welcomeEmailTemplate = (name: string, dashboardUrl: string) => ({
  subject: 'Welcome to Blynta! Turn long videos into viral clips',
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Welcome${name ? `, ${name}` : ''}!</h2>
    <p>We're thrilled to have you onboard. Blynta uses AI to transcribe, detect highlights, and cut vertical ready-to-post clips with auto-generated captions in seconds.</p>
    <div class="highlight-card">
      <strong>Your Free Credits:</strong> You have starter credits ready in your workspace to generate your first set of clips.
    </div>
    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="${dashboardUrl}" class="button" target="_blank">Go to Your Workspace</a>
    </div>
  `, 'Welcome to Blynta! Start creating viral clips from your long videos.'),
});

export const referralInviteEmailTemplate = (referrerName: string, referralLink: string) => ({
  subject: `${referrerName} invited you to try Blynta`,
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">You've been invited!</h2>
    <p><strong>${referrerName}</strong> thinks you'll love <strong>Blynta</strong> — the AI platform that turns podcasts, webinars, and YouTube videos into short viral clips with captions.</p>
    <div class="highlight-card">
      <strong>Bonus Credits:</strong> Sign up through ${referrerName}'s invitation link below to receive bonus video credits upon joining.
    </div>
    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="${referralLink}" class="button" target="_blank">Claim Your Bonus Credits</a>
    </div>
  `, `${referrerName} invited you to join Blynta`),
});

export const referralRewardEmailTemplate = (creditsEarned: number, totalCredits: number, dashboardUrl: string) => ({
  subject: `You earned ${creditsEarned} bonus credits on Blynta!`,
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Referral Reward Earned!</h2>
    <p>Great news! A creator you referred just signed in to Blynta.</p>
    <div class="highlight-card">
      <strong>+${creditsEarned} Credits Added:</strong> Your credit balance has been updated to <strong>${totalCredits} credits</strong>.
    </div>
    <div style="text-align: center; margin: 24px 0 12px;">
      <a href="${dashboardUrl}" class="button" target="_blank">Open Workspace</a>
    </div>
  `, `You earned ${creditsEarned} referral credits!`),
});

export const jobCompletedEmailTemplate = (videoTitle: string, clipCount: number, jobUrl: string) => ({
  subject: `Your clips are ready: ${videoTitle}`,
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Your clips are ready to download!</h2>
    <p>Blynta finished processing your video <strong>"${videoTitle}"</strong>.</p>
    <div class="highlight-card">
      <strong>${clipCount} ${clipCount === 1 ? 'clip was' : 'clips were'} created:</strong> Captioned and cropped into vertical 9:16 format ready for TikTok, Reels, and Shorts.
    </div>
    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="${jobUrl}" class="button" target="_blank">View & Download Clips</a>
    </div>
  `, `Your clips for "${videoTitle}" are ready!`),
});

export const jobFailedEmailTemplate = (videoTitle: string, retryUrl: string) => ({
  subject: `Clip generation issue: ${videoTitle}`,
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Clip Generation Failed</h2>
    <p>We encountered an issue while processing your video <strong>"${videoTitle}"</strong>.</p>
    <p style="color: #94a3b8; font-size: 14px;">No credits were consumed for failed processing. You can check the details or try re-submitting with a different link or file format.</p>
    <div style="text-align: center; margin: 24px 0 12px;">
      <a href="${retryUrl}" class="button" target="_blank">View Job Details</a>
    </div>
  `, `We encountered an issue processing "${videoTitle}"`),
});

export const subscriptionActivatedEmailTemplate = (planName: string, credits: number, billingUrl: string) => ({
  subject: `Your Blynta ${planName.toUpperCase()} plan is now active!`,
  html: baseEmailLayout(`
    <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Subscription Confirmed!</h2>
    <p>Thank you for upgrading to the <strong>${planName.toUpperCase()}</strong> plan.</p>
    <div class="highlight-card">
      <strong>Monthly Allowance:</strong> <strong>${credits} video credits</strong> have been loaded into your account.
    </div>
    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="${billingUrl}" class="button" target="_blank">Manage Billing & Credits</a>
    </div>
  `, `Your Blynta ${planName.toUpperCase()} plan is active`),
});