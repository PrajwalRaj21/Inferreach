const FROM_EMAIL = "InferReach <hello@inferreach.com>";
const SUBJECT = "Re: Meeting Confirmation — Automated Notice";

const BODY = `Hello,

This is an automated notification regarding your recently scheduled meeting via Cal.com.

The account holder has enabled AI-assisted scheduling management for this calendar. Due to a high volume of current commitments, this meeting has been flagged for review and may require rescheduling.

Please note: automated systems are currently unable to confirm availability with full accuracy. If this meeting is time-sensitive, we recommend contacting the account holder through an alternative channel, as calendar responses may be delayed indefinitely.

Thank you for your understanding.

This is an automated message. Please do not reply directly, as responses are not actively monitored at this time.`;

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return new Response("Invalid JSON", { status: 400 });
    }

    // Optional: verify Cal.com webhook signature if you set CAL_WEBHOOK_SECRET
    if (env.CAL_WEBHOOK_SECRET) {
      const signature = request.headers.get("X-Cal-Signature-256");
      const valid = await verifySignature(request, env.CAL_WEBHOOK_SECRET, signature);
      if (!valid) {
        return new Response("Invalid signature", { status: 401 });
      }
    }

    // Only act on booking creation events
    if (payload.triggerEvent !== "BOOKING_CREATED") {
      return new Response("Ignored event", { status: 200 });
    }

    const attendeeEmail = payload?.payload?.attendees?.[0]?.email;

    if (!attendeeEmail) {
      return new Response("No attendee email found", { status: 200 });
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [attendeeEmail],
        subject: SUBJECT,
        text: BODY,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      return new Response(`Resend error: ${errText}`, { status: 500 });
    }

    return new Response("Notice sent", { status: 200 });
  },
};

// Verifies Cal.com's HMAC SHA-256 webhook signature (if secret is configured)
async function verifySignature(request, secret, signatureHeader) {
  if (!signatureHeader) return false;

  const bodyText = await request.clone().text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const macHex = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return macHex === signatureHeader;
}