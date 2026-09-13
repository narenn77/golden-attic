import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// TODO: replace with a verified sending domain once one is set up in Resend
// (e.g. "Golden Attic <noreply@goldenattic.app>"). Using onboarding@resend.dev
// works for testing but Resend restricts it to your own verified account email.
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Golden Attic <onboarding@resend.dev>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendEmail(to: string, subject: string, body: string) {
  if (!resend) {
    // No API key configured (e.g. local dev) - fall back to logging so the
    // auth flow is still testable without a Resend account.
    console.log('--- EMAIL (RESEND_API_KEY not set - logging instead of sending) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(body);
    console.log('--------------------------------------------------------------------');
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    text: body,
  });

  if (error) {
    // Don't throw here - a failed email shouldn't crash a signup/reset request.
    // The caller has already made its DB changes; log and move on.
    console.error('Failed to send email via Resend:', error);
  }
}

export function verificationEmailBody(verifyUrl: string) {
  return `Welcome to Golden Attic! Please verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
}

export function passwordResetEmailBody(resetUrl: string) {
  return `We received a request to reset your Golden Attic password. Visit:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`;
}
