export const otpEmailTemplate = (otp: string) => ({
    subject: 'Your verification code',
    html: `<p>Your code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
});

export const passwordResetEmailTemplate = (resetUrl: string) => ({
    subject: 'Reset your password',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
});