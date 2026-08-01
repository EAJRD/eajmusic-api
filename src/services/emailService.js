// ===========================================
// TRANSACTIONAL EMAIL (SMTP via nodemailer)
// ===========================================
// Extracted from the inline block that already existed in the
// forgot-password route so email verification can reuse it instead of
// duplicating the transporter setup. Same lazy-init/never-throw pattern as
// the other external integrations in this codebase (minioStorageService,
// n8nWebhookService, firebaseService) - if SMTP_HOST isn't configured, this
// silently no-ops rather than breaking whatever flow triggered it.

let transporter = null;
let initAttempted = false;

async function getTransporter() {
  if (transporter) return transporter;
  if (initAttempted) return null;
  initAttempted = true;

  if (!process.env.SMTP_HOST) return null;

  try {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  } catch (err) {
    console.error('[emailService] Failed to initialize SMTP transporter:', err.message);
    return null;
  }
}

/**
 * Sends an HTML email. Returns true on success, false on any failure (SMTP
 * not configured, send error) - never throws, so a delivery failure can
 * never break the request that triggered it.
 */
export async function sendEmail({ to, subject, html }) {
  const t = await getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || '"EAJMUSIC" <noreply@eajmusic.com>',
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('[emailService] Send failed:', err.message);
    return false;
  }
}

const BRAND_WRAPPER = (title, bodyHtml) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #7c3aed;">${title}</h2>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="color: #999; font-size: 12px;">EAJMUSIC - Music Distribution Platform</p>
  </div>
`;

export function employeeInvitationEmailHtml({ name, role, email, registerUrl }) {
  return BRAND_WRAPPER('You\'ve been added to the EAJMUSIC team', `
    <p>Hi ${name},</p>
    <p>You've been given <strong>${role}</strong> access to the EAJMUSIC admin panel. To activate your account, sign up using this exact email address - your role and permissions are already set up:</p>
    <p style="font-weight: bold;">${email}</p>
    <a href="${registerUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Create Your Account</a>
    <p style="color: #666; font-size: 14px;">The sign-up page asks whether you're an Artist or a Label - it doesn't matter which you pick, your real ${role} access is already assigned and won't change. Choose your own password when you sign up. Once you're in, log in at eaj.eajmusic.com.</p>
  `);
}

export function labelInvitationEmailHtml({ name, labelName, email, acceptUrl }) {
  return BRAND_WRAPPER('You\'ve been invited to a Label', `
    <p>Hi ${name},</p>
    <p><strong>${labelName}</strong> invited you to join their roster on EAJMUSIC as <strong>${email}</strong>. Accept the invitation to choose your password and activate your account - your name and label are already set up:</p>
    <a href="${acceptUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Accept Invitation</a>
    <p style="color: #666; font-size: 14px;">This link expires in 7 days. If you weren't expecting this, you can safely ignore this email - no account has been created yet.</p>
  `);
}

