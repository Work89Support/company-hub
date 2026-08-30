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
      const role = ["staff", "lead", "exec"].includes(body.role) ? body.role : "staff";
      const department = String(body.department_code || "GRAPHIC").trim().toUpperCase();
      const trelloMemberId = String(body.trello_member_id || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
      }
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { display_name: displayName },
        redirectTo: "https://work89support.github.io/company-hub/prototype/index.html",
      });
      if (inviteError) throw inviteError;
      const userId = invited.user?.id;
      if (!userId) throw new Error("ไม่พบรหัสผู้ใช้หลังส่งคำเชิญ");
      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId, email, display_name: displayName, role, department_code: department, active: true,
      });
      if (profileError) throw profileError;
      const { error: departmentError } = await admin.from("profile_departments").upsert({
        profile_id: userId, department_code: department, can_manage: role === "lead" || role === "exec",
      });
      if (departmentError) throw departmentError;
      if (trelloMemberId) {
        const { error: memberError } = await admin.from("graphic_trello_members").update({
          email, linked_profile_id: userId, account_status: "invited", updated_at: new Date().toISOString(),
        }).eq("trello_member_id", trelloMemberId);
        if (memberError) throw memberError;
        await admin.from("graphic_job_members").update({ profile_id: userId }).eq("trello_member_id", trelloMemberId);
      }
      return Response.json({ ok: true, user_id: userId, email, invited: true });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
  }),
};
