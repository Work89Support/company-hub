import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

const projectRef = "mfvbggjwqgeaoezlgiqo";
const baseWeb = "https://work89support.github.io/company-hub/prototype/";
const baseApi = `https://${projectRef}.supabase.co`;
const cli = "/Users/a/.npm/_npx/ade306d1eb8b9835/node_modules/@supabase/cli-darwin-arm64/bin/supabase";
const phase = process.env.LOAD_TEST_PHASE || "after";
const outFile = new URL(`load-test-results-${phase}.json`, import.meta.url);

function percentile(values, p) {
  if (!values.length) return null;
  const a = [...values].sort((x,y)=>x-y);
  return Math.round(a[Math.min(a.length-1, Math.ceil((p/100)*a.length)-1)] * 10) / 10;
}
function summarize(name, started, samples, users) {
  const ok = samples.filter(x=>x.ok), lat = samples.map(x=>x.ms), duration = performance.now()-started;
  const statuses = {};
  for (const x of samples) statuses[String(x.status ?? "ERR")] = (statuses[String(x.status ?? "ERR")]||0)+1;
  return {name,virtual_users:users,requests:samples.length,success:ok.length,errors:samples.length-ok.length,error_rate:Number(((samples.length-ok.length)/samples.length).toFixed(4)),duration_ms:Math.round(duration),requests_per_second:Number((samples.length/(duration/1000)).toFixed(2)),latency_ms:{p50:percentile(lat,50),p95:percentile(lat,95),p99:percentile(lat,99),max:percentile(lat,100)},bytes:samples.reduce((n,x)=>n+(x.bytes||0),0),statuses};
}
async function timedFetch(url, options={}) {
  const t=performance.now();
  try {
    const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000),headers:{"User-Agent":"CompanyHub-Authorized-LoadTest/2026-10-02",...(options.headers||{})}});
    const b=await r.arrayBuffer();
    return {ok:r.ok,status:r.status,ms:performance.now()-t,bytes:b.byteLength,url};
  } catch (e) { return {ok:false,status:null,ms:performance.now()-t,bytes:0,url,error:e.name||String(e)}; }
}
async function runUsers(name, users, fn) {
  const samples=[], started=performance.now();
  await Promise.all(Array.from({length:users},(_,i)=>fn(i,samples)));
  return summarize(name,started,samples,users);
}

const staticAssets=[
  "index.html","activity-module.js?v=20260905-kpi-catalog","native-entry.css?v=20260904-native","native-entry.js?v=20260909-department-entry",
  "kpi-work.js?v=20260909-programmer","department-workflows.css?v=20260905","department-workflows.js?v=20260905-kpi-catalog",
  "team-board.css?v=20260905","team-board.js?v=20260906-3","company-accounts.js?v=20260915-shared-email",
  "reporting-integrity.js?v=20260909-live-review","ux-system.css","ux-system.js"
];

const raw=execFileSync(cli,["projects","api-keys","--project-ref",projectRef,"--reveal","--output","json"],{encoding:"utf8"});
const parsed=JSON.parse(raw), secrets=[];
const walk=v=>{if(Array.isArray(v))return v.forEach(walk);if(!v||typeof v!=="object")return;const vals=Object.values(v).filter(x=>typeof x==="string");const k=vals.find(x=>x.startsWith("sb_secret_"))||vals.find(x=>x.startsWith("eyJ")&&String(v.name||v.type||v.role||"").toLowerCase().includes("service"));if(k)secrets.push(k);Object.values(v).forEach(walk);};
walk(parsed);
if(!secrets.length)throw new Error("Supabase service key unavailable");
const key=secrets[0], apiHeaders={apikey:key,Authorization:`Bearer ${key}`};
const dashboardReads=[
  "/rest/v1/departments?select=code,name&limit=100",
  "/rest/v1/profiles?select=id,display_name,role,department_code,active&active=eq.true&limit=200",
  "/rest/v1/kpi_definitions?select=id,department_code,name,target,weight,active&active=eq.true&limit=500",
  "/rest/v1/implementation_actions?select=id,department_code,status,priority,updated_at&limit=500",
  "/rest/v1/sops?select=id,department_code,title,status,created_at&limit=500",
  "/rest/v1/announcements?select=id,title,starts_on,ends_on,pinned,created_at&limit=500",
  "/rest/v1/operational_issues?select=id,status,department_code,updated_at&limit=500",
  "/rest/v1/tasks?select=id,status,department_code,updated_at&limit=500"
];

// Small warm-up outside reported samples.
await Promise.all([timedFetch(baseWeb+"index.html?warm=1"),timedFetch(baseApi+dashboardReads[0],{headers:apiHeaders}),timedFetch(baseApi+"/functions/v1/company-accounts",{method:"OPTIONS"})]);

const results=[];
results.push(await runUsers("static_shell_100_users",100,async(i,samples)=>{
  const first=await timedFetch(baseWeb+`index.html?loadtest=20261002&vu=${i}`);samples.push(first);
  const rest=await Promise.all(staticAssets.slice(1).map(x=>timedFetch(baseWeb+x)));samples.push(...rest);
}));
results.push(await runUsers("dashboard_database_bundle_100_users",100,async(i,samples)=>{
  const rows=await Promise.all(dashboardReads.map(x=>timedFetch(baseApi+x,{headers:apiHeaders})));samples.push(...rows);
}));
results.push(await runUsers("edge_preflight_100_users",100,async(i,samples)=>{
  samples.push(await timedFetch(baseApi+"/functions/v1/company-accounts",{method:"OPTIONS",headers:{Origin:baseWeb,"Access-Control-Request-Method":"POST"}}));
}));

const report={tested_at:new Date().toISOString(),target_users:100,mode:"read-only production infrastructure test; no login attempts and no business-data writes",results};
await fs.writeFile(outFile,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
