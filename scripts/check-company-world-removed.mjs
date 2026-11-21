import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const loaded=[
  html,
  ...['core-app-data','core-app-shell','core-app-views','core-app-admin','core-app-runtime','core-app-cloud']
    .map(name=>fs.readFileSync(new URL(`../prototype/${name}.js`,import.meta.url),'utf8'))
].join('\n');

for(const asset of ['company-world.css','company-world.js']){
  assert.ok(!html.includes(asset),`removed company map asset is still loaded: ${asset}`);
}
assert.ok(!loaded.includes("NAV.world="),'company map is still registered in navigation');
assert.ok(!loaded.includes("RENDER.world="),'company map route is still registered');
assert.ok(!loaded.includes("go('world')"),'company map entry point is still available');
assert.ok(!loaded.includes('แผนที่บริษัท'),'company map label is still present in loaded UI');

console.log('PASS company world removed: no menu, route, entry point, stylesheet or script is loaded');
