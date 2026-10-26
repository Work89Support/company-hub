import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const source=fs.readFileSync(new URL('../prototype/form-controls.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../prototype/form-controls.css',import.meta.url),'utf8');
const ux=fs.readFileSync(new URL('../prototype/ux-system.css',import.meta.url),'utf8');
const window=new Window();const {document}=window;
document.body.innerHTML='<form><label id="minutes">เวลาแก้ (นาที)<input class="fin" id="issueResolutionMinutes" type="number" min="0" step="1"></label><label id="clock">เวลาเริ่ม<input class="fin" id="start" type="time"></label></form>';
const context={window,document,MutationObserver:window.MutationObserver,Event:window.Event,Intl};vm.createContext(context);vm.runInContext(source,context);
assert.equal(document.getElementById('issueResolutionMinutes').inputMode,'numeric');
assert.equal(document.querySelectorAll('#minutes .smart-choice-row button').length,4);
document.querySelector('#minutes .smart-choice-row button').click();assert.equal(document.getElementById('issueResolutionMinutes').value,'15');
assert.equal(document.getElementById('start').step,'60','time inputs must accept every minute, including values such as 16:58');assert.equal(document.querySelectorAll('#clock .smart-choice-row button').length,4);
assert.match(css,/smart-number-stepper/);assert.match(css,/@media\(max-width:600px\)/);
assert.match(ux,/grid-template-columns:minmax\(0,1fr\)/,'mobile grid track must be allowed to shrink below intrinsic toolbar width');
console.log('PASS responsive 390px guard and friendly time/number controls');
await window.happyDOM.close();
