// Brevo (formerly Sendinblue) sends over HTTPS, not SMTP — deliberate, since
// cloud platforms often block outbound SMTP ports as an anti-spam measure
// (see ARCHITECTURE.md). Chosen over Resend/SendGrid specifically because:
// Resend requires a verified domain (no shared test-sender fallback on this
// account), SendGrid dropped its free tier — Brevo verifies a single sender
// *email* (not a domain) on a genuinely free plan. ponytail: plain fetch
// against Brevo's REST API, no SDK needed for one endpoint.
// Falls back to console-logging if unconfigured, so local dev keeps working
// without an API key.
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM;

  if (!apiKey || !from) {
    console.log(`[mailer] BREVO_API_KEY/BREVO_FROM not configured, logging instead. To: ${to} | Subject: ${subject}\n${body}`);
    return;
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: from },
      to: [{ email: to }],
      subject,
      textContent: body,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Failed to send email via Brevo (${res.status}): ${errorBody}`);
  }
}

export async function sendMagicLinkEmail(email: string, link: string) {
  await sendEmail(email, "Your CampusBallot sign-in link", `Sign in: ${link}\nThis link expires in 15 minutes.`);
}
