import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../prototype/index.html', import.meta.url);
const html = fs.readFileSync(file, 'utf8');
const checks = [
  ['Graphic navigation entry', /graphic:\{ic:'i-grid',t:'Graphic Production'\}/],
  ['Graphic navigation group', /items:\['dash','myTasks','board','graphic'/],
  ['Graphic renderer', /RENDER\.graphic\s*=\s*function/],
  ['Graphic database loader', /async function loadGraphic\(/],
  ['Graphic pagination', /GP_COLUMN_PAGE_SIZE\s*=\s*30/],
  ['Graphic realtime refresh', /table:'graphic_jobs'/],
  ['Dashboard includes Graphic jobs', /function dashboardAllWork\(\)/],
  ['Dashboard prevents empty NaN percent', /donePct=all\.length\?/],
  ['Graphic account profile', /async function loadAuthenticatedProfile\(/],
  ['Activity renderer', /RENDER\.activity\s*=\s*function/],
  ['Operational issue loader', /async function cloudLoadIssues\(/],
  ['Verified issue save', /save_verified_issue_resolution/],
  ['Talk to Data popup', /Talk to Data/],
];

const failed = checks.filter(([, pattern]) => !pattern.test(html));
if (/^\+/m.test(html)) failed.push(['No accidental diff markers', /^\+/m]);

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());
try {
  scripts.forEach((source, index) => new vm.Script(source, { filename: `prototype-inline-${index + 1}.js` }));
} catch (error) {
  console.error('FAIL: Prototype JavaScript syntax');
  console.error(error.message);
  process.exit(1);
}

if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL: ${name}`));
  process.exit(1);
}

console.log(`PASS: ${checks.length} critical prototype checks and ${scripts.length} inline script syntax check`);
