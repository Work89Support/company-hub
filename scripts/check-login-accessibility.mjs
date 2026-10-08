import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const activity=fs.readFileSync(new URL('../prototype/activity-module.js',import.meta.url),'utf8');
const markup=html.slice(html.indexOf('<div id="loginBg"'),html.lastIndexOf('</body>'));

assert.match(markup,/role="dialog"/);
assert.match(markup,/aria-modal="true"/);
assert.match(markup,/aria-labelledby="loginTitle"/);
assert.match(markup,/id="sbErr"[^>]*role="alert"[^>]*aria-live="assertive"/);
assert.match(html,/node\.inert=true/);
assert.match(html,/LOGIN_PREVIOUS_FOCUS/);
assert.match(html,/setLoginBusy\(true/);
assert.doesNotMatch(activity,/กรุณารัน Migration 008/);
assert.match(html,/<meta name="description"/);
assert.match(html,/rel="icon" href="favicon\.svg"/);
assert.doesNotMatch(html,/<title>[^<]*Prototype/i);

const window=new Window({url:'https://example.test/'}),{document}=window;
document.body.innerHTML=`<div class="app"><button id="behind">behind</button></div><div id="overlay"></div><button class="talk-fab">talk</button>${markup}`;
for(const node of document.querySelectorAll('input,select,button,[tabindex]'))node.getClientRects=()=>[{}];
const source=html.slice(html.indexOf('let LOGIN_PREVIOUS_FOCUS'),html.indexOf('function accessDeviceId'));
window.eval(`${source};window.loginTestAPI={showLogin,hideLogin,setLoginBusy};`);
window.loginTestAPI.showLogin();await new Promise(resolve=>window.requestAnimationFrame(resolve));
assert.equal(document.querySelector('.app').inert,true);
assert.equal(document.querySelector('.app').getAttribute('aria-hidden'),'true');
assert.equal(document.activeElement.id,'sbEmail');
const loginButton=document.getElementById('sbLoginBtn');loginButton.focus();
loginButton.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
assert.equal(document.activeElement.id,'sbEmail','Tab from the final login control wraps to the first field');
window.loginTestAPI.setLoginBusy(true);assert.equal(loginButton.getAttribute('aria-busy'),'true');assert.equal(loginButton.disabled,true);
window.loginTestAPI.setLoginBusy(false);assert.equal(loginButton.hasAttribute('aria-busy'),false);assert.equal(loginButton.disabled,false);
window.loginTestAPI.hideLogin();assert.equal(document.querySelector('.app').inert,false);assert.equal(document.querySelector('.app').hasAttribute('aria-hidden'),false);
await window.happyDOM.close();

console.log('PASS login accessibility: modal semantics, trapped focus, isolated background, alert and busy state, release metadata');
