import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export default {
  fetch: async (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Access Gate ยังตั้งค่าไม่ครบ" }, 503);

      const accessToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!accessToken) return json({ error: "กรุณาเข้าสู่ระบบใหม่" }, 401);
      const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
      const actorId = String(authData.user?.id || "");
      if (authError || !actorId) return json({ error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, 401);

      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const claims = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const { data: ready, error: readyError } = await admin.rpc("company_credentials_ready", { p_profile: actorId, p_iat: Number(claims.iat || 0) });
      if (readyError || !ready) return json({ allowed: false, reason: "กรุณาตั้งรหัสผ่านใหม่และเข้าสู่ระบบอีกครั้ง" }, 403);
      return json({ allowed: true, reason: "บัญชีพร้อมใช้งาน" });
    } catch (error) {
      console.error(error);
      return json({ allowed: false, error: error instanceof Error ? error.message : "Access Gate ผิดพลาด" }, 400);
    }
  },
};
