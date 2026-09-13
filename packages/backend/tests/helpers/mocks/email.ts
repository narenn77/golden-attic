import { vi } from 'vitest';

export interface SentEmail {
  to: string;
  subject: string;
  body: string;
}

export const sentEmails: SentEmail[] = [];

export function resetSentEmails() {
  sentEmails.length = 0;
}

export const sendEmail = vi.fn(async (to: string, subject: string, body: string) => {
  sentEmails.push({ to, subject, body });
});

export function verificationEmailBody(verifyUrl: string) {
  return `Welcome to Golden Attic! Please verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
}

export function passwordResetEmailBody(resetUrl: string) {
  return `We received a request to reset your Golden Attic password. Visit:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`;
}

// Test helper: pull the raw token out of the last email sent to an address,
// since the DB only ever stores a hash of it.
export function extractTokenFromLastEmail(to: string): string {
  const email = [...sentEmails].reverse().find((e) => e.to === to);
  if (!email) throw new Error(`No email found for ${to}`);
  const match = /token=([a-f0-9]+)/.exec(email.body);
  if (!match) throw new Error(`No token found in email body: ${email.body}`);
  return match[1];
}
