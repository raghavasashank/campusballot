import nodemailer from "nodemailer";

// Falls back to console-logging if SMTP isn't configured — keeps local dev
// working without credentials, but real delivery needs SMTP_HOST/PORT/USER/PASS.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // nodemailer's defaults (10 min socket timeout) leave a user staring at
    // "Sending…" for ages if the host can't reach the SMTP server (blocked
    // egress port, network hiccup, etc.) — fail fast instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, body: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP not configured, logging instead. To: ${to} | Subject: ${subject}\n${body}`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text: body,
  });
}

export async function sendMagicLinkEmail(email: string, link: string) {
  await sendEmail(email, "Your CampusBallot sign-in link", `Sign in: ${link}\nThis link expires in 15 minutes.`);
}
