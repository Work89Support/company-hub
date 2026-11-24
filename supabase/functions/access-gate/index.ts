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
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() || "";
  return value.startsWith("::ffff:") ? value.slice(7) : value;
}

function cleanLine(value: unknown, fallback = "ไม่ระบุ") {
  const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
  return text || fallback;
}

function deviceLabel(body: Record<string, unknown>) {
  return cleanLine(body.device_label, "อุปกรณ์ที่ไม่ระบุชื่อ").slice(0, 120);
}

async function queueTelegram(admin: any, type: string, dedupe: string, message: string) {
  try {
    const queued = await admin.rpc("queue_telegram_notification", {
      p_type: type,
      p_task: null,
      p_dedupe_key: dedupe,
      p_message: message.slice(0, 4096),
    });
    if (queued.error) throw queued.error;
    // Reuse the existing Company Hub group. Failure here does not undo a
    // device decision because the scheduled dispatcher retries the queue.
    await admin.rpc("dispatch_telegram_notifications", { p_limit: 20 });
  } catch (error) {
    console.error("telegram device notification", error);
  }
}

async function createGrant(admin: any, profileId: string, deviceId: string, ip: string) {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const result = await admin.from("user_access_grants").upsert({
    profile_id: profileId,
    device_id: deviceId,
    ip_address: ip,
    expires_at: expiresAt,
    last_seen_at: new Date().toISOString(),
    revoked_at: null,
  }, { onConflict: "profile_id,device_id" });
  if (result.error) throw result.error;
  return expiresAt;
}

async function audit(admin: any, profileId: string, deviceId: string | null, ip: string,
  result: "allowed" | "denied", reason: string, userAgent: string) {
  const saved = await admin.from("login_access_audit").insert({
    profile_id: profileId,
    device_id: deviceId,
    ip_address: ip || null,
    result,
    reason,
    user_agent: userAgent.slice(0, 300),
  });
  if (saved.error) console.error("device audit", saved.error);
}

async function actorContext(admin: any, actorId: string) {
  const profile = await admin.from("profiles")
    .select("id,email,display_name,position_title,role,department_code,active")
    .eq("id", actorId).maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data?.active) throw new Error("บัญชีถูกปิดใช้งานหรือยังไม่ได้รับสิทธิ์");
  return profile.data;
}

async function listPending(admin: any, actor: any) {
  if (!["admin", "lead"].includes(actor.role)) return { allowed: false, error: "ไม่มีสิทธิ์ดูคำขออุปกรณ์" };
  let managed: string[] = [];
  if (actor.role === "lead") {
    const scopes = await admin.from("profile_departments").select("department_code")
      .eq("profile_id", actor.id).eq("can_manage", true);
    if (scopes.error) throw scopes.error;
    managed = (scopes.data || []).map((row: any) => row.department_code);
  }
  const devices = await admin.from("user_access_devices")
    .select("id,profile_id,device_label,request_kind,requested_at,first_seen_ip,last_seen_ip,user_agent,status")
    .eq("status", "pending").order("requested_at", { ascending: true });
  if (devices.error) throw devices.error;
  const ids = [...new Set((devices.data || []).map((row: any) => row.profile_id))];
  const profiles = ids.length
    ? await admin.from("profiles").select("id,display_name,email,position_title,role,department_code").in("id", ids)
    : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  const byId = new Map((profiles.data || []).map((row: any) => [row.id, row]));
  const rows = (devices.data || []).flatMap((device: any) => {
    const profile: any = byId.get(device.profile_id);
    if (!profile || profile.id === actor.id) return [];
    if (actor.role === "lead" && (profile.role !== "staff" || !managed.includes(profile.department_code))) return [];
    return [{ ...device, profile }];
  });
  return { allowed: true, requests: rows };
}

async function visibleProfiles(admin: any, actor: any) {
  if (!["admin", "lead"].includes(actor.role)) throw new Error("ไม่มีสิทธิ์ดูทะเบียนอุปกรณ์");
  if (actor.role === "admin") {
    const profiles = await admin.from("profiles")
      .select("id,display_name,email,position_title,role,department_code,active")
      .eq("active", true).order("display_name", { ascending: true });
    if (profiles.error) throw profiles.error;
    return profiles.data || [];
  }
  const scopes = await admin.from("profile_departments").select("department_code")
    .eq("profile_id", actor.id).eq("can_manage", true);
  if (scopes.error) throw scopes.error;
  const managed = [...new Set((scopes.data || []).map((row: any) => row.department_code))];
  if (!managed.length) return [];
  const profiles = await admin.from("profiles")
    .select("id,display_name,email,position_title,role,department_code,active")
    .eq("active", true).eq("role", "staff").in("department_code", managed)
    .order("display_name", { ascending: true });
  if (profiles.error) throw profiles.error;
  return profiles.data || [];
}

async function listRegistry(admin: any, actor: any) {
  const profiles = await visibleProfiles(admin, actor);
  const ids = profiles.map((profile: any) => profile.id);
  const devices = ids.length
    ? await admin.from("user_access_devices")
      .select("id,profile_id,device_label,request_kind,status,requested_at,approved_at,reviewed_at,review_note,first_seen_at,last_seen_at")
      .in("profile_id", ids).order("requested_at", { ascending: false })
    : { data: [], error: null };
  if (devices.error) throw devices.error;
  const byProfile = new Map<string, any[]>();
  for (const device of devices.data || []) {
    const list = byProfile.get(device.profile_id) || [];
    list.push(device);
    byProfile.set(device.profile_id, list);
  }
  const registry = profiles.map((profile: any) => ({ profile, devices: byProfile.get(profile.id) || [] }));
  return {
    allowed: true,
    registry,
    summary: {
      total: registry.length,
      registered: registry.filter((row: any) => row.devices.some((device: any) => device.status === "approved")).length,
      pending: registry.filter((row: any) => row.devices.some((device: any) => device.status === "pending")).length,
      never_registered: registry.filter((row: any) => !row.devices.length).length,
    },
  };
}

async function reviewDevice(admin: any, actor: any, body: Record<string, unknown>, ip: string, userAgent: string) {
  const targetId = String(body.device_record_id || "");
  const decision = String(body.decision || "");
  if (!/^[0-9a-f-]{36}$/i.test(targetId) || !["approve", "reject"].includes(decision)) {
    return { allowed: false, error: "ข้อมูลการอนุมัติไม่ถูกต้อง" };
  }
  const device = await admin.from("user_access_devices")
    .select("id,profile_id,device_label,status,requested_at").eq("id", targetId).maybeSingle();
  if (device.error) throw device.error;
  if (!device.data || device.data.status !== "pending") return { allowed: false, error: "คำขอนี้ถูกดำเนินการแล้ว" };
  const target = await actorContext(admin, device.data.profile_id);
  if (target.id === actor.id) return { allowed: false, error: "ไม่สามารถอนุมัติอุปกรณ์ของตนเอง" };

  let canReview = actor.role === "admin";
  if (!canReview && actor.role === "lead" && target.role === "staff") {
    const scope = await admin.from("profile_departments").select("profile_id")
      .eq("profile_id", actor.id).eq("department_code", target.department_code).eq("can_manage", true).maybeSingle();
    if (scope.error) throw scope.error;
    canReview = Boolean(scope.data);
  }
  if (!canReview) return { allowed: false, error: target.role === "lead" ? "เครื่องของหัวหน้าแผนกต้องให้ผู้ดูแลระบบอนุมัติ" : "ไม่มีสิทธิ์อนุมัติคำขอนี้" };

  const now = new Date().toISOString();
  if (decision === "approve") {
    const oldDevices = await admin.from("user_access_devices").select("id")
      .eq("profile_id", target.id).eq("status", "approved").neq("id", targetId);
    if (oldDevices.error) throw oldDevices.error;
    const oldIds = (oldDevices.data || []).map((row: any) => row.id);
    if (oldIds.length) {
      const blocked = await admin.from("user_access_devices").update({
        status: "blocked", reviewed_at: now, review_note: "แทนที่ด้วยอุปกรณ์ที่อนุมัติใหม่",
      }).in("id", oldIds);
      if (blocked.error) throw blocked.error;
      const revoked = await admin.from("user_access_grants").update({ revoked_at: now })
        .in("device_id", oldIds).is("revoked_at", null);
      if (revoked.error) throw revoked.error;
    }
    const approved = await admin.from("user_access_devices").update({
      status: "approved", approved_by: actor.id, approved_at: now,
      reviewed_at: now, review_note: "อนุมัติเปลี่ยนอุปกรณ์",
    }).eq("id", targetId);
    if (approved.error) throw approved.error;
  } else {
    const rejected = await admin.from("user_access_devices").update({
      status: "blocked", approved_by: null, approved_at: null,
      reviewed_at: now, review_note: "ปฏิเสธคำขอเปลี่ยนอุปกรณ์",
    }).eq("id", targetId);
    if (rejected.error) throw rejected.error;
  }
  await audit(admin, target.id, targetId, ip, decision === "approve" ? "allowed" : "denied",
    decision === "approve" ? "ผู้มีสิทธิ์อนุมัติอุปกรณ์ใหม่" : "ผู้มีสิทธิ์ปฏิเสธอุปกรณ์ใหม่", userAgent);
  const outcome = decision === "approve" ? "✅ อนุมัติแล้ว" : "❌ ปฏิเสธแล้ว";
  await queueTelegram(admin, `device_${decision}`, `device-${decision}:${targetId}:${now}`,
    `${outcome} · คำขอเปลี่ยนอุปกรณ์ Company Hub\n` +
    `ผู้ใช้: ${cleanLine(target.display_name || target.email)}\n` +
    `ตำแหน่ง: ${cleanLine(target.position_title)}\n` +
    `แผนก: ${cleanLine(target.department_code)}\n` +
    `อุปกรณ์: ${cleanLine(device.data.device_label)}\n` +
    `ดำเนินการโดย: ${cleanLine(actor.display_name || actor.email)}\n` +
    `เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
  return { allowed: true, reviewed: true, decision };
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
      const jwtBody = (accessToken.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(jwtBody + "=".repeat((4 - jwtBody.length % 4) % 4)));
      const { data: ready, error: readyError } = await admin.rpc("company_credentials_ready", { p_profile: actorId, p_iat: Number(claims.iat || 0) });
      if (readyError || !ready) return json({ allowed: false, reason: "กรุณาตั้งรหัสผ่านใหม่และเข้าสู่ระบบอีกครั้ง" });

      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const action = String(body.action || "status");
      const actor = await actorContext(admin, actorId);
      const ip = clientIp(request);
      const userAgent = request.headers.get("user-agent") || "";

      const config = await admin.from("device_access_config").select("enabled").eq("id", true).maybeSingle();
      if (config.error) throw config.error;
      if (!config.data?.enabled) return json({ allowed: true, enforcement_enabled: false });

      if (action === "list_pending") return json(await listPending(admin, actor));
      if (action === "list_registry") return json(await listRegistry(admin, actor));
      if (action === "review") return json(await reviewDevice(admin, actor, body, ip, userAgent));

      const rawDeviceKey = String(body.device_id || "").trim();
      if (!/^[0-9a-f-]{20,80}$/i.test(rawDeviceKey)) return json({ allowed: false, error: "ข้อมูลประจำอุปกรณ์ไม่ถูกต้อง" });
      if (!ip) return json({ allowed: false, error: "ไม่สามารถตรวจสอบเครือข่ายของอุปกรณ์ได้" });
      const keyHash = await sha256(rawDeviceKey);
      const label = deviceLabel(body);
      const exempt = actor.role === "exec" || actor.role === "admin";
      const existing = await admin.from("user_access_devices").select("*")
        .eq("profile_id", actorId).eq("device_key_hash", keyHash).maybeSingle();
      if (existing.error) throw existing.error;
      const approvedCount = await admin.from("user_access_devices")
        .select("id", { count: "exact", head: true }).eq("profile_id", actorId).eq("status", "approved");
      if (approvedCount.error) throw approvedCount.error;
      const hasApproved = Number(approvedCount.count || 0) > 0;
      const now = new Date().toISOString();

      if (exempt) {
        let device = existing.data;
        let firstRegistration = false;
        if (!device) {
          const inserted = await admin.from("user_access_devices").insert({
            profile_id: actorId, device_key_hash: keyHash, device_label: label,
            status: "approved", request_kind: "exempt", requested_at: now,
            approved_by: actorId, approved_at: now, reviewed_at: now,
            review_note: "ผู้บริหาร/ผู้ดูแลได้รับการยกเว้นการรออนุมัติ",
            first_seen_ip: ip, last_seen_ip: ip, user_agent: userAgent.slice(0, 500),
          }).select("*").single();
          if (inserted.error) throw inserted.error;
          device = inserted.data; firstRegistration = true;
        } else {
          const updated = await admin.from("user_access_devices").update({
            status: "approved", request_kind: "exempt", device_label: label,
            approved_by: actorId, approved_at: device.approved_at || now,
            reviewed_at: now, review_note: "ผู้บริหาร/ผู้ดูแลได้รับการยกเว้นการรออนุมัติ",
            last_seen_ip: ip, last_seen_at: now, user_agent: userAgent.slice(0, 500),
          }).eq("id", device.id).select("*").single();
          if (updated.error) throw updated.error;
          device = updated.data;
        }
        const expiresAt = await createGrant(admin, actorId, device.id, ip);
        if (firstRegistration) {
          await audit(admin, actorId, device.id, ip, "allowed", "ลงทะเบียนอุปกรณ์อัตโนมัติสำหรับผู้บริหาร/ผู้ดูแล", userAgent);
          await queueTelegram(admin, "device_exempt_registered", `device-exempt:${device.id}`,
            `🔐 ลงทะเบียนอุปกรณ์ใหม่อัตโนมัติ\nผู้ใช้: ${cleanLine(actor.display_name || actor.email)}\n` +
            `สิทธิ์: ${actor.role === "exec" ? "CEO/ผู้บริหาร" : "ผู้ดูแลระบบ"}\nอุปกรณ์: ${label}\n` +
            `เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}\nไม่ต้องรออนุมัติ`);
        }
        return json({ allowed: true, exempt: true, device_status: "approved", expires_at: expiresAt });
      }

      if (existing.data?.status === "approved") {
        await admin.from("user_access_devices").update({ device_label: label, last_seen_ip: ip, last_seen_at: now, user_agent: userAgent.slice(0, 500) }).eq("id", existing.data.id);
        const expiresAt = await createGrant(admin, actorId, existing.data.id, ip);
        return json({ allowed: true, device_status: "approved", expires_at: expiresAt });
      }
      if (existing.data?.status === "pending") return json({ allowed: false, state: "pending", reason: "ส่งคำขอแล้ว กำลังรอผู้มีสิทธิ์อนุมัติ", device_record_id: existing.data.id });
      if (existing.data?.status === "blocked") return json({ allowed: false, state: "blocked", reason: "อุปกรณ์นี้ถูกปฏิเสธหรือยกเลิกสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ" });

      if (action === "status") {
        return json({
          allowed: false,
          state: hasApproved ? "needs_change_confirmation" : "needs_initial_confirmation",
          reason: hasApproved ? "ตรวจพบอุปกรณ์ใหม่ ต้องส่งคำขออนุมัติ" : "กรุณายืนยันการลงทะเบียนอุปกรณ์เครื่องแรก",
        });
      }

      if (action === "confirm_initial" && !hasApproved) {
        const inserted = await admin.from("user_access_devices").insert({
          profile_id: actorId, device_key_hash: keyHash, device_label: label,
          status: "approved", request_kind: "initial", requested_at: now,
          approved_by: actorId, approved_at: now, reviewed_at: now,
          review_note: "ผู้ใช้ยืนยันลงทะเบียนอุปกรณ์เครื่องแรก",
          first_seen_ip: ip, last_seen_ip: ip, user_agent: userAgent.slice(0, 500),
        }).select("*").single();
        if (inserted.error) throw inserted.error;
        const expiresAt = await createGrant(admin, actorId, inserted.data.id, ip);
        await audit(admin, actorId, inserted.data.id, ip, "allowed", "ผู้ใช้ยืนยันลงทะเบียนอุปกรณ์เครื่องแรก", userAgent);
        await queueTelegram(admin, "device_initial_registered", `device-initial:${inserted.data.id}`,
          `🔐 ลงทะเบียนอุปกรณ์เครื่องแรก Company Hub\nผู้ใช้: ${cleanLine(actor.display_name || actor.email)}\n` +
          `ตำแหน่ง: ${cleanLine(actor.position_title)}\nแผนก: ${cleanLine(actor.department_code)}\nอุปกรณ์: ${label}\n` +
          `เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
        return json({ allowed: true, state: "initial_registered", device_status: "approved", expires_at: expiresAt });
      }

      if (action === "request_change" || action === "confirm_initial") {
        const inserted = await admin.from("user_access_devices").insert({
          profile_id: actorId, device_key_hash: keyHash, device_label: label,
          status: "pending", request_kind: "replacement", requested_at: now,
          first_seen_ip: ip, last_seen_ip: ip, user_agent: userAgent.slice(0, 500),
        }).select("*").single();
        if (inserted.error) throw inserted.error;
        await audit(admin, actorId, inserted.data.id, ip, "denied", "ส่งคำขอเปลี่ยนอุปกรณ์ รออนุมัติ", userAgent);
        await queueTelegram(admin, "device_change_requested", `device-request:${inserted.data.id}`,
          `📱 คำขอเปลี่ยนอุปกรณ์ Company Hub\nผู้ใช้: ${cleanLine(actor.display_name || actor.email)}\n` +
          `ตำแหน่ง: ${cleanLine(actor.position_title)}\nแผนก: ${cleanLine(actor.department_code)}\nอุปกรณ์ใหม่: ${label}\n` +
          `เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}\n` +
          `${actor.role === "lead" ? "ต้องให้ผู้ดูแลระบบอนุมัติ" : "หัวหน้าแผนกหรือผู้ดูแลระบบอนุมัติได้"}`);
        return json({ allowed: false, state: "pending", reason: "ส่งคำขอแล้ว กำลังรอผู้มีสิทธิ์อนุมัติ", device_record_id: inserted.data.id });
      }
      return json({ allowed: false, error: "คำสั่งอุปกรณ์ไม่ถูกต้อง" });
    } catch (error) {
      console.error(error);
      return json({ allowed: false, error: error instanceof Error ? error.message : "Access Gate ผิดพลาด" }, 400);
    }
  },
};
