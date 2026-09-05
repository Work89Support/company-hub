import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { withSupabase } from "jsr:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient;
      const actorId = ctx.jwtClaims?.sub;
      if (!actorId) return Response.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
      const { data: credentialReady, error: credentialError } = await admin.rpc("company_credentials_ready", { p_profile: actorId, p_iat: Number(ctx.jwtClaims?.iat || 0) });
      if (credentialError || !credentialReady) return Response.json({ error: "กรุณาตั้งรหัสผ่านใหม่และเข้าสู่ระบบอีกครั้ง" }, { status: 403 });
      const forwardedIp = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().replace(/^::ffff:/, "");
      const { data: edgeAllowed, error: edgeAccessError } = await admin.rpc("edge_access_allowed", { p_profile_id: actorId, p_ip: forwardedIp });
      if (edgeAccessError || !edgeAllowed) return Response.json({ error: "เครื่องหรือ IP นี้ไม่มีสิทธิ์เรียกใช้งาน" }, { status: 403 });
      const { data: actor, error: actorError } = await admin.from("profiles")
        .select("id,role,active").eq("id", actorId).single();
      if (actorError || !actor?.active || !["admin", "exec"].includes(actor.role)) {
        return Response.json({ error: "เฉพาะผู้ดูแลระบบหรือผู้บริหารสร้างบัญชีได้" }, { status: 403 });
      }
      const body = await request.json();
      const email = String(body.email || "").trim().toLowerCase();
      const displayName = String(body.display_name || "").trim();
      const positionTitle = String(body.position_title || "").trim().slice(0, 120);
      const allowedRoles = actor.role === "admin" ? ["staff", "lead", "exec", "admin"] : ["staff", "lead", "exec"];
      const role = allowedRoles.includes(body.role) ? body.role : "staff";
      const department = String(body.department_code || "GRAPHIC").trim().toUpperCase();
      const trelloMemberId = String(body.trello_member_id || "").trim();
      const requestedVisible = Array.isArray(body.visible_departments) ? body.visible_departments : [department];
      const requestedManaged = role === "lead" && Array.isArray(body.managed_departments) ? body.managed_departments : [];
      const enforceDevice = body.enforce_device !== false;
      const requestedIpRules = Array.isArray(body.allowed_ip_cidrs)
        ? [...new Set<string>(body.allowed_ip_cidrs.map((value: unknown) => String(value).trim()).filter(Boolean))]
        : [];
      const enforceIp = body.enforce_ip === true;
      const { data: departments, error: departmentsError } = await admin.from("departments").select("code");
      if (departmentsError) throw departmentsError;
      const validDepartments = new Set((departments || []).map((row) => row.code));
      if (!validDepartments.has(department)) return Response.json({ error: "ไม่พบแผนกหลัก" }, { status: 400 });
      const visible = [...new Set([department, ...requestedVisible.map((value: unknown) => String(value).toUpperCase())])]
        .filter((value: string) => validDepartments.has(value));
      const managed = new Set(requestedManaged.map((value: unknown) => String(value).toUpperCase()).filter((value: string) => validDepartments.has(value)));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
      }
      if (!displayName || !positionTitle) {
        return Response.json({ error: "กรุณาระบุชื่อและตำแหน่งงาน" }, { status: 400 });
      }
      if (enforceIp && !requestedIpRules.length) {
        return Response.json({ error: "ต้องระบุ IP/CIDR อย่างน้อย 1 ค่าเมื่อเปิดล็อก IP" }, { status: 400 });
      }
      if (requestedIpRules.some((value) => !/^[0-9a-f:.]+(?:\/\d{1,3})?$/i.test(value))) {
        return Response.json({ error: "รูปแบบ IP/CIDR ไม่ถูกต้อง" }, { status: 400 });
      }
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { display_name: displayName, position_title: positionTitle },
        redirectTo: "https://work89support.github.io/company-hub/prototype/index.html",
      });
      if (inviteError) throw inviteError;
      const userId = invited.user?.id;
      if (!userId) throw new Error("ไม่พบรหัสผู้ใช้หลังส่งคำเชิญ");
      const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: { company_role: role, department },
        user_metadata: { display_name: displayName, position_title: positionTitle },
      });
      if (metadataError) throw metadataError;
      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId, email, display_name: displayName, position_title: positionTitle, role, department_code: department, active: true,
      });
      if (profileError) throw profileError;
      const { error: clearDepartmentsError } = await admin.from("profile_departments").delete().eq("profile_id", userId);
      if (clearDepartmentsError) throw clearDepartmentsError;
      const departmentRows = (role === "exec" || role === "admin" ? [department] : visible).map((code) => ({
        profile_id: userId,
        department_code: code,
        can_manage: role === "lead" && managed.has(code),
      }));
      const { error: departmentError } = await admin.from("profile_departments").insert(departmentRows);
      if (departmentError) throw departmentError;
      const { error: policyError } = await admin.from("user_access_policies").upsert({
        profile_id: userId, enforce_device: enforceDevice, enforce_ip: enforceIp,
        session_minutes: 5, updated_by: actorId, updated_at: new Date().toISOString(),
      });
      if (policyError) throw policyError;
      if (requestedIpRules.length) {
        const { error: ipError } = await admin.from("user_access_ip_rules").insert(requestedIpRules.map((network) => ({
          profile_id: userId, allowed_network: network, label: "กำหนดตอนสร้างบัญชี", created_by: actorId,
        })));
        if (ipError) throw ipError;
      }
      if (trelloMemberId) {
        const { error: memberError } = await admin.from("graphic_trello_members").update({
          email, linked_profile_id: userId, account_status: "invited", updated_at: new Date().toISOString(),
        }).eq("trello_member_id", trelloMemberId);
        if (memberError) throw memberError;
        await admin.from("graphic_job_members").update({ profile_id: userId }).eq("trello_member_id", trelloMemberId);
      }
      return Response.json({ ok: true, user_id: userId, email, position_title: positionTitle, role, department, visible_departments: visible, managed_departments: [...managed], enforce_device: enforceDevice, enforce_ip: enforceIp, invited: true });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
  }),
};
