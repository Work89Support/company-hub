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

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientIp(request: Request) {
  // Supabase's gateway supplies forwarding headers. Use only the first hop and
  // never accept an IP value from the JSON body.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() || "";
  return value.startsWith("::ffff:") ? value.slice(7) : value;
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

      const body = await request.json();
      const deviceKey = String(body.device_id || "").trim();
      const deviceLabel = String(body.device_label || "").trim().slice(0, 120);
      if (!/^[0-9a-f-]{20,80}$/i.test(deviceKey)) return json({ error: "ข้อมูลประจำเครื่องไม่ถูกต้อง" }, 400);
      const ip = clientIp(request);
      if (!ip) return json({ allowed: false, reason: "ไม่สามารถตรวจสอบ IP ของเครื่องได้" }, 403);

      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const claims = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const { data: ready, error: readyError } = await admin.rpc("company_credentials_ready", { p_profile: actorId, p_iat: Number(claims.iat || 0) });
      if (readyError || !ready) return json({ allowed: false, reason: "กรุณาตั้งรหัสผ่านใหม่และเข้าสู่ระบบอีกครั้ง" }, 403);
      const { data, error } = await admin.rpc("evaluate_login_access", {
        p_profile_id: actorId,
        p_device_key_hash: await sha256(deviceKey),
        p_device_label: deviceLabel,
        p_ip: ip,
        p_user_agent: request.headers.get("user-agent") || "",
      });
      if (error) throw error;
      const result = data && typeof data === "object" ? data : { allowed: false, reason: "Access Gate ไม่ส่งผลตรวจกลับมา" };
      return json(result, result.allowed ? 200 : 403);
    } catch (error) {
      console.error(error);
      return json({ allowed: false, error: error instanceof Error ? error.message : "Access Gate ผิดพลาด" }, 400);
    }
  },
};
