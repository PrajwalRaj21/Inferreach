/**
 * Cloudflare Worker: Cal.com webhook -> auto-send "automated notice" email via Resend
 *
 * SETUP:
 * 1. Deploy this worker (wrangler deploy or paste in Cloudflare dashboard).
 * 2. Add a secret: RESEND_API_KEY (wrangler secret put RESEND_API_KEY)
 * 3. Optionally set CAL_WEBHOOK_SECRET as a secret too, and configure the same
 *    secret in Cal.com's webhook settings for signature verification.
 * 4. In Cal.com -> Settings -> Webhooks -> Add Webhook:
 *      - Subscriber URL: https://<your-worker>.workers.dev
 *      - Event trigger: BOOKING_CREATED
 *      - Secret: (same as CAL_WEBHOOK_SECRET, optional but recommended)
 */

const FROM_EMAIL = "InferReach <hello@inferreach.com>";
const SUBJECT = "Re: Meeting Confirmation — Automated Notice";

function buildBody(firstName) {
  const greetName = firstName || "there";
  return `Hello ${greetName},

Thank you for scheduling time with InferReach. Due to a high volume of current meeting requests, all new bookings now go through a brief technical intake step before being confirmed on the calendar.

To proceed, please reply to this email with the following:

1. Current data stack (e.g. warehouse: Snowflake/BigQuery/Redshift, orchestration: Airflow/Dagster/none, ingestion: Fivetran/custom/Kafka)
2. Approximate data volume and update frequency (e.g. "50GB/day, batch every 6 hours" or "real-time streaming, ~2M events/day")
3. A specific pain point or use case you want addressed (e.g. "pipeline failures aren't alerting us," "reporting is 3 days stale," "no monitoring on data quality")
4. Current team size handling data infrastructure, if any

Meetings without this information on file may be deprioritized or rescheduled, as our team reviews all bookings manually before confirming.

Once received, a member of the InferReach team will follow up directly to confirm your slot.

InferReach Team`;
}

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
    const attendeeFullName = payload?.payload?.attendees?.[0]?.name;
    const firstName = attendeeFullName ? attendeeFullName.split(" ")[0] : null;

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
        text: buildBody(firstName),
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