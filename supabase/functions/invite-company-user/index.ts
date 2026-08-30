import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      const admin = ctx.supabaseAdmin;
      const actorId = ctx.userClaims?.sub;
      if (!actorId) return Response.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
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
      const { data: departments, error: departmentsError } = await admin.from("departments").select("code");
      if (departmentsError) throw departmentsError;
      const validDepartments = new Set((departments || []).map((row) => row.code));
      if (!validDepartments.has(department)) return Response.json({ error: "ไม่พบแผนกหลัก" }, { status: 400 });
      const visible = [...new Set([department, ...requestedVisible.map((value: unknown) => String(value).toUpperCase())])]
        .filter((value) => validDepartments.has(value));
      const managed = new Set(requestedManaged.map((value: unknown) => String(value).toUpperCase()).filter((value) => validDepartments.has(value)));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
      }
      if (!displayName || !positionTitle) {
        return Response.json({ error: "กรุณาระบุชื่อและตำแหน่งงาน" }, { status: 400 });
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
      if (trelloMemberId) {
        const { error: memberError } = await admin.from("graphic_trello_members").update({
          email, linked_profile_id: userId, account_status: "invited", updated_at: new Date().toISOString(),
        }).eq("trello_member_id", trelloMemberId);
        if (memberError) throw memberError;
        await admin.from("graphic_job_members").update({ profile_id: userId }).eq("trello_member_id", trelloMemberId);
      }
      return Response.json({ ok: true, user_id: userId, email, position_title: positionTitle, role, department, visible_departments: visible, managed_departments: [...managed], invited: true });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
  }),
};
