import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function isMailerConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendAdminInviteEmail(input: {
  email: string;
  name: string;
  password: string;
  loginUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { sent: false, error: "RESEND_API_KEY not configured" };

  const { email, name, password, loginUrl } = input;
  const from = process.env.ADMIN_INVITE_FROM || "Sentinel Admin <onboarding@resend.dev>";
  const portalName = "TaskForce AI Administration Portal";
  const subject = `You've been invited to ${portalName}`;

  const text = `Hi ${name},

You've been invited as an admin on ${portalName}.

Sign in here: ${loginUrl}
Email: ${email}
Temporary password: ${password}

You can change your password after signing in.`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="margin-bottom:4px">You've been invited to ${portalName}</h2>
      <p style="color:#444">Hi ${escapeHtml(name)}, an account was created for you on the ${portalName}.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#777">Email</td><td style="padding:6px 0"><strong>${escapeHtml(email)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#777">Temporary password</td><td style="padding:6px 0"><strong>${escapeHtml(password)}</strong></td></tr>
      </table>
      <p><a href="${loginUrl}" style="display:inline-block;background:#e11d3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Sign in to ${portalName}</a></p>
      <p style="color:#999;font-size:12px">You can change your password after signing in. If you weren't expecting this invite, you can ignore this email.</p>
    </div>`;

  try {
    const { error } = await resend.emails.send({ from, to: email, subject, text, html });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Failed to send invite email" };
  }
}

// Client invite / set-password email. Deliberately carries no password —
// only a single-use link. The same call is reused for admin-triggered
// "Resend invite" (a real password reset), so the copy stays neutral
// rather than assuming this is the client's first invite.
export async function sendClientInviteEmail(input: {
  email: string;
  company: string;
  setPasswordUrl: string;
  expiresAt: string;
}): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { sent: false, error: "RESEND_API_KEY not configured" };

  const { email, company, setPasswordUrl, expiresAt } = input;
  const from = process.env.CLIENT_INVITE_FROM || process.env.ADMIN_INVITE_FROM || "TaskForce AI Client Portal <onboarding@resend.dev>";
  const portalName = "TaskForce AI Client Portal";
  const subject = `Set your password for ${portalName}`;
  const expiresLabel = new Date(expiresAt).toUTCString();

  const text = `Hi,

You've been invited to sign in to ${portalName} for ${company}.

Set your password here: ${setPasswordUrl}

This link is single-use and expires ${expiresLabel} (24 hours from now).
If you didn't expect this, you can ignore this email.`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="margin-bottom:4px">Set your password</h2>
      <p style="color:#444">You've been invited to sign in to ${portalName} for <strong>${escapeHtml(company)}</strong>.</p>
      <p><a href="${setPasswordUrl}" style="display:inline-block;background:#e11d3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Set your password</a></p>
      <p style="color:#999;font-size:12px">This link is single-use and expires ${escapeHtml(expiresLabel)} (24 hours from now). If you didn't expect this, you can ignore this email — no account changes happen until the link is used.</p>
    </div>`;

  try {
    const { error } = await resend.emails.send({ from, to: email, subject, text, html });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Failed to send invite email" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
