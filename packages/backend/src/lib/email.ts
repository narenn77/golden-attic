// Placeholder email sender. Swap this out for a real provider (Resend, SendGrid,
// Postmark, SES, etc.) before launch - for now it just logs so the auth flow
// is fully testable without a mail provider decided/configured yet.

export async function sendEmail(to: string, subject: string, body: string) {
  console.log('--- EMAIL (stub - not actually sent) ---');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(body);
  console.log('-----------------------------------------');
}

export function verificationEmailBody(verifyUrl: string) {
  return `Welcome to Golden Attic! Please verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
}

export function passwordResetEmailBody(resetUrl: string) {
  return `We received a request to reset your Golden Attic password. Visit:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`;
}
