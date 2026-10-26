/* Progressive enhancement for numeric and time entry. Native values remain the source of truth. */
(function(){
 const presets={
  f_sla_n:[1,2,3,5,7],issueResolutionMinutes:[15,30,60,120],
  newIssueCustomers:[0,1,5,10],newIssueTransactions:[0,1,10,50],
  newIssueFinancial:[0,1000,5000,10000]
 };
 const labels={newIssueFinancial:v=>Number(v).toLocaleString('th-TH')+' บาท',issueResolutionMinutes:v=>v+' นาที',f_sla_n:v=>String(v)};
 function fire(input){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
 function enhanceNumber(input){
  input.inputMode=Number(input.step||1)%1?'decimal':'numeric';input.classList.add('smart-number-input');
  const parent=input.closest('.field,label')||input.parentElement;if(!parent||parent.dataset.smartNumber)return;parent.dataset.smartNumber='1';parent.classList.add('smart-field');
  const values=presets[input.id]||(input.classList.contains('admin-kpi-score')?[0,Math.max(0,Number(input.max)/2),Number(input.max)]:null);
  if(values){const row=document.createElement('div');row.className='smart-choice-row';row.setAttribute('aria-label','ค่าที่ใช้บ่อย');for(const value of [...new Set(values)]){const button=document.createElement('button');button.type='button';button.textContent=(labels[input.id]?.(value))??String(value);button.onclick=()=>{input.value=String(value);fire(input);input.focus();};row.append(button);}parent.append(row);}
  if(!input.disabled&&!input.readOnly&&input.closest('.modal')){const wrap=document.createElement('div');wrap.className='smart-number-wrap';input.before(wrap);wrap.append(input);const controls=document.createElement('span');controls.className='smart-number-stepper';for(const [text,direction] of [['−',-1],['+',1]]){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',direction<0?'ลดค่า':'เพิ่มค่า');button.textContent=text;button.onclick=()=>{direction<0?input.stepDown():input.stepUp();fire(input);};controls.append(button);}wrap.append(controls);}
 }
 function enhanceTime(input){
  input.step=input.step||'60';input.inputMode='numeric';const parent=input.closest('.field,label')||input.parentElement;if(!parent||parent.dataset.smartTime)return;parent.dataset.smartTime='1';parent.classList.add('smart-field');
  const row=document.createElement('div');row.className='smart-choice-row';row.setAttribute('aria-label','เวลาที่ใช้บ่อย');for(const value of ['08:00','09:00','13:00','17:00']){const button=document.createElement('button');button.type='button';button.textContent=value;button.onclick=()=>{input.value=value;fire(input);input.focus();};row.append(button);}parent.append(row);
 }
 function enhance(root=document){for(const input of root.querySelectorAll?.('input[type="number"]:not([data-smart-input]),input[type="time"]:not([data-smart-input])')||[]){input.dataset.smartInput='1';input.type==='time'?enhanceTime(input):enhanceNumber(input);}}
 enhance();new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)enhance(node.matches?.('input')?node.parentElement:node);}).observe(document.body,{childList:true,subtree:true});
 window.enhanceCompanyFormControls=enhance;
})();
