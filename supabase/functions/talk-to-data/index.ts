import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type Row = Record<string, unknown>;

const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.4-mini";
const MAX_HISTORY = 8;

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

async function pageRows(fetchPage: (from: number, to: number) => Promise<{ data: Row[] | null; error: unknown }>, max = 5000) {
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

function responseText(payload: Row) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as Row[]) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Row[]) if (part.type === "output_text" && typeof part.text === "string") return part.text;
  }
  return "";
}

async function safetyId(userId: string) {
  const bytes = new TextEncoder().encode(userId);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].slice(0, 16).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) return Response.json({ error: "AI backend ยังไม่ได้ตั้งค่า OPENAI_API_KEY" }, { status: 503 });
      const actorId = String(ctx.userClaims?.sub || "");
      if (!actorId) return Response.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
      const body = await request.json();
      const question = String(body.question || "").trim().slice(0, 2000);
      if (!question) return Response.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });
      const view = String(body.view || "unknown").slice(0, 80);
      const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
      const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY).map((item: Row) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || "").slice(0, 1800),
      })) : [];

      const admin = ctx.supabaseAdmin;
      const [{ data: profile, error: profileError }, { data: departments, error: departmentError }] = await Promise.all([
        admin.from("profiles").select("id,email,display_name,role,department_code,active").eq("id", actorId).single(),
        admin.from("departments").select("code,name").order("code"),
      ]);
      if (profileError || !profile?.active) return Response.json({ error: "บัญชีไม่มีสิทธิ์ใช้งาน" }, { status: 403 });
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

      const [jobs, projectResult, issues, activities, knowledgeRows, sopRows, kpis] = await Promise.all([
        jobsPromise, projectsPromise, issuesPromise, activitiesPromise, knowledgePromise, sopPromise, kpiPromise,
      ]);
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
          total: jobs.length, active: activeJobs.length, overdue: overdueJobs.length,
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
          total: issues.length, open: issues.length - resolvedIssues.length, resolved: resolvedIssues.length,
          status_counts: countBy(issues, "status"), priority_counts: countBy(issues, "priority"), category_counts: countBy(issues, "category"), project_counts: countBy(issues, "project_code"),
          average_resolution_minutes: resolvedIssues.length ? Math.round(resolvedIssues.reduce((sum, row) => sum + Number(row.resolution_minutes || 0), 0) / resolvedIssues.length) : null,
          relevant_issues: relevant(issues, question, ["id", "project_code", "category", "problem", "priority", "status", "owner_team", "solution"], 80),
        } : null,
        employee_activities: {
          total: activities.length, counted_hours: Math.round(validMinutes / 6) / 10,
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

      const instructions = `คุณคือ Company Hub Data Analyst ตอบภาษาไทยแบบผู้ช่วยผู้บริหารและหัวหน้างาน
กติกาสำคัญ:
1. ใช้เฉพาะ COMPANY_DATA ที่ให้มา ห้ามสร้างตัวเลข ชื่อบุคคล เหตุการณ์ หรือข้อสรุปที่ไม่มีหลักฐาน
2. แยกให้ชัดระหว่าง “ข้อเท็จจริงจากข้อมูล” กับ “ข้อเสนอแนะ/ข้อสันนิษฐาน”
3. ตอบคำถามให้ตรงก่อน แล้วจึงให้ insight ความเสี่ยง แนวโน้ม สาเหตุที่เป็นไปได้ และข้อเสนอแนะที่ลงมือทำได้
4. หากข้อมูลไม่พอ ให้บอกว่าขาดฟิลด์ใดและควรเก็บอะไรเพิ่ม ห้ามเดา
5. เคารพ user_scope ซึ่งผ่านการจำกัดสิทธิ์มาแล้ว และห้ามกล่าวถึงข้อมูลนอก scope
6. เมื่อผู้ใช้ถามต่อ ให้ใช้บทสนทนาก่อนหน้าเพื่อเข้าใจคำอ้างอิง เช่น “คนนั้น”, “โปรเจกต์นี้”, “แล้วเดือนก่อน”
7. sources ต้องระบุชื่อตาราง/ชุดข้อมูลที่ใช้จริง เช่น graphic_jobs, graphic_job_files, graphic_job_comments, operational_issues, daily_activities, knowledge_articles, sops, sop_versions, kpi_definitions, kpi_results
8. recommendations ต้องเฉพาะเจาะจง มีผู้รับผิดชอบหรือขั้นตอนถ้าสามารถอนุมานอย่างปลอดภัย และติดป้ายว่าเป็นข้อเสนอแนะ
9. current_filters คือบริบทตัวกรองบนหน้าจอ ส่วนยอดสรุปเป็นยอดในขอบเขตสิทธิ์ทั้งหมด หากคำนวณยอดตามตัวกรองจากรายการที่ให้มาไม่ได้ ต้องบอกข้อจำกัด ห้ามนำยอดรวมมาอ้างว่าเป็นยอดหลังกรอง
10. ถ้าคำถามขอสิ่งที่ฐานข้อมูลนี้ตอบไม่ได้ ให้ตอบตรง ๆ พร้อมเสนอคำถามที่ตอบได้ใกล้เคียงที่สุด`;
      const input = [
        ...history.map((item: Row) => ({ role: item.role, content: item.content })),
        { role: "user", content: `คำถาม: ${question}\n\nCOMPANY_DATA:\n${JSON.stringify(context)}` },
      ];
      const aiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, store: false, instructions, input, max_output_tokens: 2200,
          reasoning: { effort: "low" }, safety_identifier: await safetyId(actorId),
          text: { format: { type: "json_schema", name: "company_hub_answer", strict: true, schema: {
            type: "object", additionalProperties: false,
            properties: {
              answer: { type: "string" },
              insights: { type: "array", items: { type: "string" }, maxItems: 6 },
              recommendations: { type: "array", items: { type: "string" }, maxItems: 6 },
              caveats: { type: "array", items: { type: "string" }, maxItems: 4 },
              follow_up_questions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
              sources: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["answer", "insights", "recommendations", "caveats", "follow_up_questions", "sources", "confidence"],
          } } },
        }),
      });
      const aiPayload = await aiResponse.json();
      if (!aiResponse.ok) {
        console.error("OpenAI error", aiResponse.status, aiPayload?.error?.code || "unknown");
        return Response.json({ error: "AI ประมวลผลไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
      }
      const text = responseText(aiPayload);
      if (!text) return Response.json({ error: "AI ไม่ได้ส่งคำตอบกลับมา" }, { status: 502 });
      const answer = JSON.parse(text);
      return Response.json({ ok: true, answer, model: MODEL, generated_at: context.generated_at, scope: context.user_scope });
    } catch (error) {
      console.error(error);
      return Response.json({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }, { status: 400 });
    }
  }),
};
