// Handles Google's redirect, exchanges code -> token, fetches the channel,
// upserts a creator badge if subscriberCount >= 100,000, then closes the popup.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const MIN_SUBS = 100_000;

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;background:#0a0a0a;color:#fff;padding:24px">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function closeWith(payload: Record<string, unknown>): Response {
  const json = JSON.stringify(payload);
  return html(`
    <p>${payload.ok ? "✅ Verified! You can close this window." : "❌ " + (payload.error ?? "Verification failed")}</p>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'youtube-verify', payload: ${json} }, '*');
        }
      } catch (e) {}
      setTimeout(() => window.close(), 1500);
    </script>
  `);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errParam = url.searchParams.get("error");

    if (errParam) return closeWith({ ok: false, error: errParam });
    if (!code || !state) return closeWith({ ok: false, error: "Missing code or state" });

    let stateData: { uid: string };
    try {
      const [payloadB64, sigB64] = state.split(".");
      if (!payloadB64 || !sigB64) throw new Error("malformed");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(serviceKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
      const ok = await crypto.subtle.verify(
        "HMAC",
        key,
        sigBytes,
        new TextEncoder().encode(payloadB64),
      );
      if (!ok) throw new Error("bad signature");
      const parsed = JSON.parse(atob(payloadB64));
      // Reject states older than 10 minutes
      if (typeof parsed.t !== "number" || Date.now() - parsed.t > 10 * 60 * 1000) {
        throw new Error("expired");
      }
      stateData = { uid: parsed.uid };
    } catch {
      return closeWith({ ok: false, error: "Invalid state" });
    }
    const userId = stateData.uid;
    if (!userId) return closeWith({ ok: false, error: "Invalid state user" });

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
      return closeWith({ ok: false, error: "Server misconfigured" });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/youtube-verify-callback`;

    // 1) Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return closeWith({ ok: false, error: `Token exchange failed: ${tokenJson.error_description ?? tokenJson.error ?? "unknown"}` });
    }
    const accessToken = tokenJson.access_token as string;

    // 2) Fetch the user's YouTube channel
    const ytRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const ytJson = await ytRes.json();
    if (!ytRes.ok) {
      return closeWith({ ok: false, error: `YouTube API: ${ytJson.error?.message ?? "failed"}` });
    }
    const channel = ytJson.items?.[0];
    if (!channel) {
      return closeWith({ ok: false, error: "No YouTube channel on this Google account" });
    }

    const subs = parseInt(channel.statistics?.subscriberCount ?? "0", 10);
    const channelId: string = channel.id;
    const handle: string = channel.snippet?.customUrl ?? channel.snippet?.title ?? "";

    if (!Number.isFinite(subs) || subs < MIN_SUBS) {
      return closeWith({
        ok: false,
        error: `Channel has ${subs.toLocaleString()} subscribers. Need ${MIN_SUBS.toLocaleString()}+.`,
      });
    }

    // 3) Upsert badge using service role
    const admin = createClient(supabaseUrl, serviceKey);
    const { error: upsertErr } = await admin
      .from("creator_badges")
      .upsert(
        {
          user_id: userId,
          platform: "youtube",
          external_id: channelId,
          handle,
          subscriber_count: subs,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform" }
      );

    if (upsertErr) {
      return closeWith({ ok: false, error: `Save failed: ${upsertErr.message}` });
    }

    return closeWith({ ok: true, platform: "youtube", subs, handle });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return closeWith({ ok: false, error: message });
  }
});
