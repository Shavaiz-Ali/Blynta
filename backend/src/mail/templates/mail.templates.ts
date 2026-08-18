export const otpEmailTemplate = (otp: string) => ({
    subject: 'Your verification code',
    html: `<p>Your code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
});

export const passwordResetEmailTemplate = (resetUrl: string) => ({
    subject: 'Reset your password',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
});

export const referralInviteEmailTemplate = (referrerName: string, referralLink: string) => ({
    subject: `${referrerName} invited you to try Blynta`,
    html: `
    <p>${referrerName} thinks you'd like Blynta — an AI tool that turns long videos into short, ready-to-post clips with auto-generated captions.</p>
    <p>Sign up using their link and you'll both get bonus credits:</p>
    <p><a href="${referralLink}">${referralLink}</a></p>
  `,
});