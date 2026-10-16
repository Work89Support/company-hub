import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Row = Record<string, unknown>;

const MAX_HISTORY = 8;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

function countBy(rows: Row[], key: string) {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
    result[value] = (result[value] || 0) + 1;
  }
  return Object.entries(result).sort((a, b) => b[1] - a[1]).slice(0, 30);
}

function words(input: string) {
  return [...new Set(input.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [])]
    .filter((word) => !["อะไร", "เท่าไหร่", "อย่างไร", "ของ", "และ", "หรือ", "ที่", "ใน", "มี", "เป็น"].includes(word))
    .slice(0, 12);
}

function relevant(rows: Row[], question: string, fields: string[], limit = 60) {
  const tokens = words(question);
  return rows.map((row, index) => {
    const text = fields.map((field) => String(row[field] ?? "")).join(" ").toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 2 : 0), 0);
    return { row, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((item, index) => item.score > 0 || index < Math.min(25, limit))
    .slice(0, limit).map((item) => item.row);
}

async function pageRows(fetchPage: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>, max = 5000) {
  const all: Row[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function exactCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

function topLabel(rows: unknown, empty = "ยังไม่มีข้อมูล") {
  if (!Array.isArray(rows) || !rows.length) return empty;
  return rows.slice(0, 3).map((item) => Array.isArray(item) ? `${item[0]} ${item[1]} รายการ` : "").filter(Boolean).join(" · ") || empty;
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function ruleAnswer(context: Row, question: string) {
  const q = question.toLowerCase();
  const activities = context.employee_activities as Row;
  const issues = context.operational_issues as Row | null;
  const graphic = context.graphic as Row | null;
  const kpis = context.kpis as Row;
  const knowledge = context.knowledge as Row;
  const sops = context.sops as Row;
  const answer = {
    answer: "", insights: [] as string[], recommendations: [] as string[],
    caveats: ["คำตอบนี้คำนวณด้วยกฎจากข้อมูล Company Hub ตามสิทธิ์ของผู้ใช้ โดยไม่ส่งข้อมูลไปยัง AI ภายนอก"],
    follow_up_questions: ["สรุปกิจกรรมและชั่วโมงที่นับได้", "มีปัญหาอะไรที่ต้องติดตาม", "สรุป KPI ตามแผนก"],
    sources: [] as string[], confidence: "high" as "high" | "medium" | "low",
  };
  if (/กิจกรรม|ชั่วโมง|พนักงาน.*ทำ|ใครทำ|activity|บันทึกงาน/.test(q)) {
    answer.answer = `พบกิจกรรม ${numberValue(activities.total).toLocaleString("th-TH")} รายการ รวมเวลาที่นับได้ ${numberValue(activities.counted_hours).toLocaleString("th-TH")} ชั่วโมง`;
    answer.insights.push(`แผนกที่มีรายการมาก: ${topLabel(activities.department_counts)}`, `ผู้บันทึกที่มีรายการมาก: ${topLabel(activities.employee_counts)}`, `สถานะการตรวจเวลา: ${topLabel(activities.time_flag_counts, "ไม่พบรายการเวลาผิดปกติ")}`);
    answer.recommendations.push("ตรวจรายการเวลาที่ผิดปกติหรือข้อมูลไม่ครบก่อนนำไปคิด KPI"); answer.sources = ["daily_activities"]; return answer;
  }
  if (/ปัญหา|problem|เคส|incident|วิธีแก้|สาเหตุ/.test(q)) {
    if (!issues) { answer.answer = "บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลปัญหาของแผนก ADMIN"; answer.sources = ["profile_departments"]; return answer; }
    answer.answer = `พบปัญหา ${numberValue(issues.total).toLocaleString("th-TH")} รายการ เปิดอยู่ ${numberValue(issues.open).toLocaleString("th-TH")} รายการ และแก้แล้ว ${numberValue(issues.resolved).toLocaleString("th-TH")} รายการ`;
    answer.insights.push(`หมวดปัญหาหลัก: ${topLabel(issues.category_counts)}`, `โครงการที่พบปัญหามาก: ${topLabel(issues.project_counts)}`);
    answer.recommendations.push("เริ่มติดตามจากเคสที่ยังเปิดและมีความสำคัญสูง แล้วบันทึกวิธีแก้เมื่อปิดเคส"); answer.sources = ["operational_issues"]; return answer;
  }
  if (/กราฟิก|graphic|trello|งานออกแบบ|ภาระงาน|เกินกำหนด/.test(q)) {
    if (!graphic) { answer.answer = "บัญชีนี้ไม่มีสิทธิ์ดูข้อมูล Graphic Production"; answer.sources = ["profile_departments"]; return answer; }
    answer.answer = `งานกราฟิกทั้งหมด ${numberValue(graphic.total).toLocaleString("th-TH")} งาน กำลังดำเนินการ ${numberValue(graphic.active).toLocaleString("th-TH")} งาน และเกินกำหนด ${numberValue(graphic.overdue).toLocaleString("th-TH")} งาน`;
    answer.insights.push(`สถานะงาน: ${topLabel(graphic.status_counts)}`, `ผู้รับผิดชอบงานคงค้าง: ${topLabel(graphic.assignee_counts)}`);
    answer.recommendations.push("จัดลำดับงานเกินกำหนดก่อน และตรวจงานที่ยังไม่ระบุผู้รับผิดชอบ"); answer.sources = ["graphic_jobs", "graphic_projects", "graphic_job_members"]; return answer;
  }
  if (/kpi|คะแนน|ตัวชี้วัด|ประเมิน/.test(q)) {
    answer.answer = `พบตัวชี้วัดที่ใช้งาน ${numberValue(kpis.definitions).toLocaleString("th-TH")} ตัว และผลประเมิน ${numberValue(kpis.results).toLocaleString("th-TH")} รายการ`;
    answer.insights.push(`ตัวชี้วัดแยกตามแผนก: ${topLabel(kpis.by_department)}`); answer.recommendations.push("ตรวจรอบประเมิน สถานะการรับรอง และหลักฐานของ KPI ก่อนสรุปผล"); answer.sources = ["kpi_definitions", "kpi_results"]; return answer;
  }
  if (/sop|คู่มือ|ความรู้|บทความ/.test(q)) {
    answer.answer = `มี SOP ที่มองเห็นได้ ${numberValue(sops.total).toLocaleString("th-TH")} รายการ และบทความความรู้ ${numberValue(knowledge.total).toLocaleString("th-TH")} รายการ`;
    answer.recommendations.push("นำปัญหาที่เกิดซ้ำและมีวิธีแก้แล้วมาจัดทำ SOP เพื่อให้ทีมใช้มาตรฐานเดียวกัน"); answer.sources = ["sops", "sop_versions", "knowledge_articles"]; return answer;
  }
  const parts = [`กิจกรรม ${numberValue(activities.total).toLocaleString("th-TH")} รายการ`, `KPI ${numberValue(kpis.definitions).toLocaleString("th-TH")} ตัว`];
  if (issues) parts.push(`ปัญหาเปิด ${numberValue(issues.open).toLocaleString("th-TH")} รายการ`); if (graphic) parts.push(`งานกราฟิกคงค้าง ${numberValue(graphic.active).toLocaleString("th-TH")} งาน`);
  answer.answer = `สรุปข้อมูลในขอบเขตสิทธิ์ของคุณ: ${parts.join(" · ")}`; answer.insights.push(`กิจกรรมตามแผนก: ${topLabel(activities.department_counts)}`);
  answer.recommendations.push("เลือกถามเจาะจงเรื่องกิจกรรม ปัญหา กราฟิก KPI หรือ SOP เพื่อดูรายละเอียดที่เกี่ยวข้อง"); answer.sources = ["daily_activities", "kpi_definitions", ...(issues ? ["operational_issues"] : []), ...(graphic ? ["graphic_jobs"] : [])]; return answer;
}

export default {
  fetch: async (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const authorization = request.headers.get("Authorization") || "";
      const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
      if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return json({ error: "AI backend ยังตั้งค่า Supabase ไม่ครบ" }, 503);
      }
      if (!accessToken) return json({ error: "กรุณาเข้าสู่ระบบใหม่" }, 401);

      // Verify the access token with Supabase Auth instead of trusting decoded
      // claims. This keeps the function protected while legacy JWT verification
      // is disabled at the Edge gateway.
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
      const actorId = String(authData.user?.id || "");
      if (authError || !actorId) return json({ error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, 401);

      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: credentialReady, error: credentialError } = await admin.rpc("company_credentials_ready", { p_profile: actorId, p_iat: Number(JSON.parse(atob(accessToken.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).iat || 0) });
      if (credentialError || !credentialReady) return json({ error: "กรุณาตั้งรหัสผ่านใหม่และเข้าสู่ระบบอีกครั้ง" }, 403);
      const body = await request.json();
      const question = String(body.question || "").trim().slice(0, 2000);
      if (!question) return json({ error: "กรุณาระบุคำถาม" }, 400);
      const view = String(body.view || "unknown").slice(0, 80);
      const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
      const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY).map((item: Row) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || "").slice(0, 1800),
      })) : [];

      const [{ data: profile, error: profileError }, { data: departments, error: departmentError }] = await Promise.all([
        admin.from("profiles").select("id,email,display_name,role,department_code,active").eq("id", actorId).single(),
        admin.from("departments").select("code,name").order("code"),
      ]);
      if (profileError || !profile?.active) return json({ error: "บัญชีไม่มีสิทธิ์ใช้งาน" }, 403);
      if (departmentError) throw departmentError;
      let allowedDepartments: string[];
      if (["admin", "exec"].includes(profile.role)) {
        allowedDepartments = (departments || []).map((row: Row) => String(row.code));
      } else {
        const { data: access, error } = await admin.from("profile_departments").select("department_code,can_manage").eq("profile_id", actorId);
        if (error) throw error;
        allowedDepartments = [...new Set([profile.department_code, ...(access || []).map((row: Row) => row.department_code)].filter(Boolean).map(String))];
      }
      const can = (department: string) => allowedDepartments.includes(department);
      const { data: accessRows, error: accessError } = await admin.from("profile_departments").select("department_code,can_manage").eq("profile_id", actorId);
      if (accessError) throw accessError;
      const managedDepartments = ["admin", "exec"].includes(profile.role)
        ? allowedDepartments
        : profile.role === "lead"
          ? [...new Set([profile.department_code, ...(accessRows || []).filter((row: Row) => row.can_manage).map((row: Row) => row.department_code)].filter(Boolean).map(String))]
          : [];

      const countPromise = Promise.all([
        can("GRAPHIC") ? exactCount(admin.from("graphic_jobs").select("id", { count: "exact", head: true }).eq("department_code", "GRAPHIC")) : Promise.resolve(0),
        can("GRAPHIC") ? exactCount(admin.from("graphic_jobs").select("id", { count: "exact", head: true }).eq("department_code", "GRAPHIC").neq("status", "done")) : Promise.resolve(0),
        can("GRAPHIC") ? exactCount(admin.from("graphic_jobs").select("id", { count: "exact", head: true }).eq("department_code", "GRAPHIC").neq("status", "done").lt("due_at", new Date().toISOString())) : Promise.resolve(0),
        can("ADMIN") ? exactCount(admin.from("operational_issues").select("id", { count: "exact", head: true }).eq("department_code", "ADMIN")) : Promise.resolve(0),
        can("ADMIN") ? exactCount(admin.from("operational_issues").select("id", { count: "exact", head: true }).eq("department_code", "ADMIN").eq("status", "Resolved")) : Promise.resolve(0),
        exactCount(admin.from("daily_activities").select("id", { count: "exact", head: true }).in("department_code", allowedDepartments.length ? allowedDepartments : ["__NONE__"])),
      ]);
      const jobsPromise = can("GRAPHIC") ? pageRows((from, to) => admin.from("graphic_jobs")
        .select("id,job_no,department_code,project_id,title,brief,work_type,status,priority,requester_name,assignee_name,due_at,revision_count,started_at,submitted_at,completed_at,created_at,updated_at")
        .eq("department_code", "GRAPHIC").order("updated_at", { ascending: false }).range(from, to)) : Promise.resolve([]);
      const projectsPromise = can("GRAPHIC") ? admin.from("graphic_projects").select("id,name,workstream,active").eq("active", true) : Promise.resolve({ data: [], error: null });
      const issuesPromise = can("ADMIN") ? pageRows((from, to) => admin.from("operational_issues")
        .select("id,department_code,occurred_at,project_code,category,problem,priority,status,owner_team,solution,resolution_minutes,updated_at")
        .eq("department_code", "ADMIN").order("occurred_at", { ascending: false }).range(from, to)) : Promise.resolve([]);
      const activitiesPromise = pageRows((from, to) => admin.from("daily_activities")
        .select("id,department_code,department_label,group_code,activity_date,employee_name,activity,category,duration_minutes,status,time_flag,updated_at")
        .in("department_code", allowedDepartments.length ? allowedDepartments : ["__NONE__"])
        .order("activity_date", { ascending: false }).range(from, to));
      const knowledgePromise = pageRows((from, to) => admin.from("knowledge_articles")
        .select("id,department_code,title,problem,solution,status,updated_at")
        .in("department_code", allowedDepartments.length ? allowedDepartments : ["__NONE__"])
        .order("updated_at", { ascending: false }).range(from, to), 2000);
      const sopPromise = pageRows((from, to) => admin.from("sops")
        .select("id,department_code,title,status,created_at")
        .in("department_code", allowedDepartments.length ? allowedDepartments : ["__NONE__"])
        .order("created_at", { ascending: false }).range(from, to), 2000);
      const kpiPromise = pageRows((from, to) => admin.from("kpi_definitions")
        .select("id,department_code,name,target,weight,formula,source,active")
        .in("department_code", allowedDepartments.length ? allowedDepartments : ["__NONE__"])
        .eq("active", true).order("department_code").range(from, to), 2000);

      const [counts, jobs, projectResult, issues, activities, knowledgeRows, sopRows, kpis] = await Promise.all([
        countPromise, jobsPromise, projectsPromise, issuesPromise, activitiesPromise, knowledgePromise, sopPromise, kpiPromise,
      ]);
      const [jobTotal,activeJobTotal,overdueJobTotal,issueTotal,resolvedIssueTotal,activityTotal]=counts;
      if (projectResult.error) throw projectResult.error;
      const knowledge = knowledgeRows.filter((row) => row.status === "published" || managedDepartments.includes(String(row.department_code)));
      const sops = sopRows.filter((row) => row.status === "published" || managedDepartments.includes(String(row.department_code)));
      const projects = (projectResult.data || []) as Row[];
      const projectNames = Object.fromEntries(projects.map((row) => [String(row.id), String(row.name)]));
      const relevantJobs = relevant(jobs.map((row) => ({ ...row, project_name: projectNames[String(row.project_id)] || "" })), question,
        ["job_no", "title", "brief", "project_name", "assignee_name", "requester_name", "status", "priority"], 70);
      const relevantJobIds = relevantJobs.map((row) => String(row.id));
      const kpiIds = kpis.map((row) => String(row.id));
      const sopIds = sops.map((row) => String(row.id));
      const [kpiResults, graphicFiles, graphicComments, sopVersions] = await Promise.all([
        kpiIds.length ? pageRows((from, to) => admin.from("kpi_results")
          .select("id,definition_id,period_start,period_end,actual,status,approved_at,version")
          .in("definition_id", kpiIds).order("period_end", { ascending: false }).range(from, to), 5000) : Promise.resolve([]),
        relevantJobIds.length ? pageRows((from, to) => admin.from("graphic_job_files")
          .select("job_id,name,url,file_type,preview_url,mime_type,created_at")
          .in("job_id", relevantJobIds).order("created_at", { ascending: false }).range(from, to), 2000) : Promise.resolve([]),
        relevantJobIds.length ? pageRows((from, to) => admin.from("graphic_job_comments")
          .select("job_id,author_name,body,created_at")
          .in("job_id", relevantJobIds).order("created_at", { ascending: false }).range(from, to), 2000) : Promise.resolve([]),
        sopIds.length ? pageRows((from, to) => admin.from("sop_versions")
          .select("sop_id,version,content,approved_at")
          .in("sop_id", sopIds).order("version", { ascending: false }).range(from, to), 2000) : Promise.resolve([]),
      ]);
      const kpiById = Object.fromEntries(kpis.map((row) => [String(row.id), row]));
      const filesByJob = graphicFiles.reduce((acc: Record<string, Row[]>, row) => {
        const key = String(row.job_id); (acc[key] ||= []).push(row); return acc;
      }, {});
      const commentsByJob = graphicComments.reduce((acc: Record<string, Row[]>, row) => {
        const key = String(row.job_id); (acc[key] ||= []).push(row); return acc;
      }, {});
      const latestSopVersion = sopVersions.reduce((acc: Record<string, Row>, row) => {
        const key = String(row.sop_id); if (!acc[key]) acc[key] = row; return acc;
      }, {});
      const enrichedSops = sops.map((row) => {
        const latestVersion = latestSopVersion[String(row.id)] || null;
        return { ...row, latest_version: latestVersion, search_text: latestVersion ? JSON.stringify(latestVersion.content || {}) : "" };
      });
      const now = Date.now();
      const activeJobs = jobs.filter((row) => row.status !== "done");
      const overdueJobs = activeJobs.filter((row) => row.due_at && Date.parse(String(row.due_at)) < now);
      const completedWithDue = jobs.filter((row) => row.status === "done" && row.completed_at && row.due_at);
      const onTime = completedWithDue.filter((row) => Date.parse(String(row.completed_at)) <= Date.parse(String(row.due_at))).length;
      const validMinutes = activities.filter((row) => Number.isFinite(Number(row.duration_minutes))).reduce((sum, row) => sum + Number(row.duration_minutes), 0);
      const resolvedIssues = issues.filter((row) => row.status === "Resolved");

      const context = {
        generated_at: new Date().toISOString(),
        user_scope: { role: profile.role, primary_department: profile.department_code, visible_departments: allowedDepartments },
        current_page: view,
        current_filters: filters,
        graphic: can("GRAPHIC") ? {
          total: jobTotal, active: activeJobTotal, overdue: overdueJobTotal,
          status_counts: countBy(jobs, "status"), priority_counts: countBy(jobs, "priority"),
          project_counts: Object.entries(jobs.reduce((acc: Record<string, number>, row) => {
            const name = projectNames[String(row.project_id)] || "ไม่ระบุโปรเจกต์"; acc[name] = (acc[name] || 0) + 1; return acc;
          }, {})).sort((a, b) => b[1] - a[1]),
          assignee_counts: countBy(activeJobs, "assignee_name"), revision_total: jobs.reduce((sum, row) => sum + Number(row.revision_count || 0), 0),
          on_time: { measured_jobs: completedWithDue.length, jobs: onTime, rate_percent: completedWithDue.length ? Math.round(onTime / completedWithDue.length * 100) : null },
          relevant_jobs: relevantJobs.map((row) => ({
            ...row, files: (filesByJob[String(row.id)] || []).slice(0, 12), recent_comments: (commentsByJob[String(row.id)] || []).slice(0, 6),
          })),
        } : null,
        operational_issues: can("ADMIN") ? {
          total: issueTotal, open: issueTotal - resolvedIssueTotal, resolved: resolvedIssueTotal,
          status_counts: countBy(issues, "status"), priority_counts: countBy(issues, "priority"), category_counts: countBy(issues, "category"), project_counts: countBy(issues, "project_code"),
          average_resolution_minutes: resolvedIssues.length ? Math.round(resolvedIssues.reduce((sum, row) => sum + Number(row.resolution_minutes || 0), 0) / resolvedIssues.length) : null,
          relevant_issues: relevant(issues, question, ["id", "project_code", "category", "problem", "priority", "status", "owner_team", "solution"], 80),
        } : null,
        employee_activities: {
          total: activityTotal, counted_hours: Math.round(validMinutes / 6) / 10,
          department_counts: countBy(activities, "department_code"), employee_counts: countBy(activities, "employee_name"), category_counts: countBy(activities, "category"), time_flag_counts: countBy(activities, "time_flag"), status_counts: countBy(activities, "status"),
          relevant_activities: relevant(activities, question, ["department_code", "group_code", "activity_date", "employee_name", "activity", "category", "status", "time_flag"], 70),
        },
        knowledge: { total: knowledge.length, relevant_articles: relevant(knowledge, question, ["department_code", "title", "problem", "solution", "status"], 40) },
        sops: { total: sops.length, status_counts: countBy(sops, "status"), relevant_sops: relevant(enrichedSops, question, ["department_code", "title", "status", "search_text"], 30) },
        kpis: {
          definitions: kpis.length, results: kpiResults.length, by_department: countBy(kpis, "department_code"),
          relevant_definitions: relevant(kpis, question, ["department_code", "name", "formula", "source"], 40),
          latest_results: relevant(kpiResults.map((row) => {
            const definition = kpiById[String(row.definition_id)] || {};
            return { ...row, department_code: definition.department_code, kpi_name: definition.name, target: definition.target, weight: definition.weight };
          }), question, ["department_code", "kpi_name", "period_start", "period_end", "status"], 80),
        },
      };

      const answer = ruleAnswer(context, question);
      return json({ ok: true, answer, model: "company-data-rules-v1", generated_at: context.generated_at, scope: context.user_scope });
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }, 400);
    }
  },
};
