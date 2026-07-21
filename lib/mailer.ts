import { Resend } from "resend";

// Resend sends over HTTPS (port 443), not raw SMTP — cloud platforms often
// block or restrict outbound SMTP ports (25/465/587) as an anti-spam
// measure, which is what made the earlier nodemailer/SMTP approach fail
// with ETIMEDOUT on Render. Falls back to console-logging if RESEND_API_KEY
// isn't set, so local dev keeps working without an API key.
let client: Resend | null = null;

function getClient() {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) return null;
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmail(to: string, subject: string, body: string) {
  const resend = getClient();
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY not configured, logging instead. To: ${to} | Subject: ${subject}\n${body}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "CampusBallot <onboarding@resend.dev>",
    to,
    subject,
    text: body,
  });
  if (error) throw new Error(`Failed to send email via Resend: ${error.message}`);
}

export async function sendMagicLinkEmail(email: string, link: string) {
  await sendEmail(email, "Your CampusBallot sign-in link", `Sign in: ${link}\nThis link expires in 15 minutes.`);
}
