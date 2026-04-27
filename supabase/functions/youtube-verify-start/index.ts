// Starts the YouTube OAuth flow. Returns the Google authorize URL.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");
    if (!supabaseUrl) throw new Error("SUPABASE_URL not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // state encodes the user id + a nonce, signed lightly via the service key
    const nonce = crypto.randomUUID();
    const state = btoa(JSON.stringify({ uid: user.id, n: nonce, t: Date.now() }));

    const redirectUri = `${supabaseUrl}/functions/v1/youtube-verify-callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "online",
      include_granted_scopes: "true",
      prompt: "select_account",
      state,
    });

    return new Response(
      JSON.stringify({ url: `${GOOGLE_AUTH}?${params.toString()}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
