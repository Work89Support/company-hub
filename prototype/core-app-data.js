/* ============================================================
   DATA
============================================================ */
const DEPTS = [
  {code:'SC', name:'SC', color:'#0f9488'},
  {code:'KPI',   name:'แผนก KPI',            color:'#7a53e0'},
  {code:'MKT',   name:'การตลาด',             color:'#e2445c'},
  {code:'GRAPHIC',name:'กราฟิก',             color:'#2f8fe6'},
  {code:'CRM',   name:'ลูกค้าสัมพันธ์ (CRM)', color:'#00a878'},
  {code:'ADMIN', name:'แอดมิน',              color:'#e8971b'},
  {code:'QC',    name:'QC Chat',              color:'#2158c8'},
  {code:'FIN',   name:'การเงิน',             color:'#0b7a75'},
  {code:'BO',    name:'Back Office (BC)',     color:'#67769a'},
  {code:'HR',    name:'ทรัพยากรบุคคล (HR)',  color:'#c2557a'},
  {code:'AUD123',name:'ออดิทระบบ (ส่วนกลาง)',       color:'#c77d3a'},
  {code:'BOM',   name:'Back Office Mgmt',     color:'#6d4c9f'},
  {code:'PROG',  name:'โปรแกรมเมอร์ (Programmer)', color:'#2b9098'},
  {code:'AIAUTO',name:'AI Automation',         color:'#4f46b8'},
];
const deptColor = c => (DEPTS.find(d=>d.code===c)||{}).color || '#888';
const deptName  = c => (DEPTS.find(d=>d.code===(c==='AUDXB'?'AUD123':c))||{}).name || c;
/* แม็ปแผนก → กลุ่มงานตามแผนผังองค์กร (4 กลุ่ม) + ระดับตำแหน่ง */
const DEPT_GROUP={SC:'04',KPI:'01',FIN:'01',BO:'01',HR:'01',MKT:'02',GRAPHIC:'02',CRM:'03',ADMIN:'04',QC:'04',AUD123:'04',AUDXB:'04',BOM:'01',PROG:'03',AIAUTO:'03'};
const GROUP_NAME={'01':'01 Corporate & Governance','02':'02 Brand, Content & Marketing','03':'03 Technology & Customer','04':'04 Operations & Quality'};
const deptGroup=c=>DEPT_GROUP[c]||'01';
const REPORTING_PARENT={GRAPHIC:'MKT'};
const reportingDeptName=c=>REPORTING_PARENT[c]?`${deptName(c)} (รายงานภายใต้ ${deptName(REPORTING_PARENT[c])})`:deptName(c);
const userLevel=id=>(String(id).startsWith('lead')||id==='boss')?'head':'staff';
const levelName=l=>l==='head'?'หัวหน้างาน':'พนักงาน';

const USERS = {
  boss:{n:'คุณธนกร (ผู้บริหาร)',s:'ธ',c:'#0b2a6b'},
  lead_gr:{n:'พิมพ์ (หัวหน้ากราฟิก)',s:'พ',c:'#2f8fe6'},
  lead_crm:{n:'วีร์ (หัวหน้า CRM)',s:'ว',c:'#00a878'},
  lead_mkt:{n:'นัท (หัวหน้าการตลาด)',s:'น',c:'#e2445c'},
  lead_hr:{n:'อร (หัวหน้า HR)',s:'อ',c:'#c2557a'},
  lead_fin:{n:'ตาล (หัวหน้าการเงิน)',s:'ต',c:'#0b7a75'},
  lead_bc:{n:'ก้อง (หัวหน้า Back Office)',s:'ก',c:'#67769a'},
  lead_bom:{n:'เจน (หัวหน้า BO Mgmt)',s:'จ',c:'#6d4c9f'},
  hr1:{n:'แนน',s:'แ',c:'#c2557a'}, bc1:{n:'พล',s:'พ',c:'#67769a'},
  lead_a123:{n:'บิว (หัวหน้าออดิท 123)',s:'บ',c:'#c77d3a'}, a123s:{n:'ปอ',s:'ป',c:'#c77d3a'},
  lead_axb:{n:'มาย (หัวหน้าออดิท XB)',s:'ม',c:'#5b7a3a'}, axbs:{n:'กิ๊ฟ',s:'ก',c:'#5b7a3a'},
  a:{n:'ฟ้า',s:'ฟ',c:'#2f6fe0'}, b:{n:'ต้น',s:'ต',c:'#e8971b'},
  c:{n:'มิ้น',s:'ม',c:'#7a53e0'}, d:{n:'โบ๊ท',s:'บ',c:'#0b7a75'},
  e:{n:'จู',s:'จ',c:'#e2445c'}, f:{n:'เก่ง',s:'ก',c:'#2f8fe6'},
};
const u = id => {
  if(USERS[id])return USERS[id];
  const name=String(id||'ยังไม่ระบุ').trim()||'ยังไม่ระบุ';
  return {n:name,s:Array.from(name)[0]?.toUpperCase()||'?',c:'#64748b'};
};

/* กลุ่ม/ทีม — ตั้งไว้ล่วงหน้า กดเลือกทั้งกลุ่มได้ */
let GROUPS=[
  {id:'g_gr', name:'ทีมกราฟิก',          dept:'GRAPHIC', members:['lead_gr','a','f']},
  {id:'g_crm',name:'ทีม CRM',            dept:'CRM',     members:['lead_crm','b','e']},
  {id:'g_mkt',name:'ทีมการตลาด',         dept:'MKT',     members:['lead_mkt','c']},
  {id:'g_fin',name:'ทีมการเงิน',         dept:'FIN',     members:['d']},
  {id:'g_qc', name:'ทีม QC Chat',        dept:'QC',      members:['e','d']},
  {id:'g_hr', name:'ทีม HR',             dept:'HR',      members:['lead_hr','hr1']},
  {id:'g_bo', name:'ทีม Back Office (BC)',dept:'BO',      members:['lead_bc','bc1','d']},
  {id:'g_a123',name:'ทีมออดิท 123',      dept:'AUD123',  members:['lead_a123','a123s']},
  {id:'g_axb',name:'ทีมออดิท XB',        dept:'AUDXB',   members:['lead_axb','axbs']},
  {id:'g_bomgt',name:'ทีม Back Office Mgmt',dept:'BOM',   members:['lead_bom']},
  {id:'g_lead',name:'หัวหน้าทุกแผนก',    dept:null,      members:['lead_gr','lead_crm','lead_mkt','lead_hr','lead_fin','lead_bc','lead_a123','lead_axb','lead_bom']},
];
const groupById=id=>GROUPS.find(g=>g.id===id);

const STATUS = {
  todo :{t:'ยังไม่เริ่ม',c:'#b7c0d0'},
  doing:{t:'กำลังทำ',   c:'#2f8fe6'},
  review:{t:'รอตรวจ',   c:'#e8971b'},
  block:{t:'ติดปัญหา',  c:'#e2445c'},
  done :{t:'เสร็จ',     c:'#00a878'},
};
const PRIO = {high:{t:'สูง',c:'#e2445c'},mid:{t:'กลาง',c:'#e8971b'},low:{t:'ต่ำ',c:'#00a878'}};

const TASKS = [
  {id:'T-1042',dept:'GRAPHIC',title:'ออกแบบแบนเนอร์โปรฯ ฝากครั้งแรก 3XBET',creator:'lead_mkt',assignee:'a',status:'doing',prio:'high',start:'08-05',due:'08-08',spent:4,ontime:true,tags:['แบนเนอร์','โปรโมชั่น'],sop:'SOP-GR',
    desc:'ทำแบนเนอร์เว็บ + ภาพบรอดแคสต์ไลน์/เทเลแกรม ตามบรีฟทีมการตลาด',sub:[{t:'ดราฟต์ v1',who:'a',st:'done'},{t:'รีทัชภาพหลัก',who:'f',st:'doing'}]},
  {id:'T-1039',dept:'GRAPHIC',title:'ตัดต่อวิดีโอรีวิวลูกค้า 30 วินาที',creator:'lead_gr',assignee:'f',status:'review',prio:'mid',start:'08-04',due:'08-07',spent:6,ontime:true,tags:['วิดีโอ'],sop:'SOP-GR',desc:'ตัดต่อคลิปสั้นลง Social',sub:[]},
  {id:'T-1055',dept:'CRM',title:'โทรติดตามลูกค้าใหม่รอบเช้า (ลิสต์ 80 ราย)',creator:'lead_crm',assignee:'b',status:'doing',prio:'high',start:'08-07',due:'08-07',spent:2,ontime:true,tags:['Realtime','โทรออก'],sop:'SOP-CRM',desc:'โทรหาลูกค้าสมัครใหม่ แนะนำโปรฯ และกระตุ้นการฝากครั้งแรก',sub:[]},
  {id:'T-1051',dept:'CRM',title:'ดึงลูกค้าหายกลับ (Win-back) กลุ่มเงียบ 14 วัน',creator:'boss',assignee:'lead_crm',status:'doing',prio:'high',start:'08-06',due:'08-09',spent:3,ontime:true,tags:['Retention','แคมเปญ'],sop:'SOP-CRM',desc:'ทำแคมเปญโทร+ข้อความดึงลูกค้าที่ไม่เล่นเกิน 14 วัน',sub:[{t:'แบ่งกลุ่มลูกค้า',who:'b',st:'done'},{t:'ร่างสคริปต์โทร',who:'e',st:'review'}]},
  {id:'T-1060',dept:'MKT',title:'วางแผนคอนเทนต์สัปดาห์หน้า (X / VK / Telegram)',creator:'lead_mkt',assignee:'c',status:'doing',prio:'mid',start:'08-06',due:'08-08',spent:2.5,ontime:true,tags:['คอนเทนต์','แพลน'],sop:'SOP-MKT',desc:'คัดหัวข้อคอนเทนต์ + ปฏิทินโพสต์ 3 แพลตฟอร์ม',sub:[]},
  {id:'T-1058',dept:'MKT',title:'สรุปวิเคราะห์ Engagement แคมเปญสัปดาห์นี้',creator:'boss',assignee:'lead_mkt',status:'review',prio:'mid',start:'08-05',due:'08-07',spent:3,ontime:true,tags:['วิเคราะห์','รายงาน'],sop:'SOP-MKT',desc:'ดึง Data → คลีน Excel → สรุปผล → เขียนรายงาน',sub:[]},
  {id:'T-1071',dept:'FIN',title:'อนุมัติรายการเบิกจ่ายประจำวัน',creator:'boss',assignee:'d',status:'doing',prio:'high',start:'08-07',due:'08-07',spent:0.7,ontime:true,tags:['เบิกจ่าย'],sop:'SOP-FIN',desc:'พิจารณา/อนุมัติยอดเบิก แล้วโอน — มีบอทช่วยดึงข้อมูล',sub:[]},
  {id:'T-1066',dept:'FIN',title:'จัดทำสรุปยอดกระแสเงินสดรายเดือน (ก.ค.)',creator:'lead_crm',assignee:'d',status:'block',prio:'high',start:'08-03',due:'08-06',spent:8,ontime:false,tags:['สรุปเดือน','กระทบยอด'],sop:'SOP-FIN',desc:'ลงยอดเงินกระแส + กระทบยอด — ติดปัญหายอดไม่ตรง 2 รายการ',sub:[]},
  {id:'T-1080',dept:'QC',title:'ตรวจคุณภาพการตอบแชทกะดึก',creator:'lead_crm',assignee:'e',status:'doing',prio:'mid',start:'08-07',due:'08-07',spent:1.5,ontime:true,tags:['QC','แชท'],sop:'SOP-QC',desc:'สุ่มตรวจแชท จับเคสตอบล่าช้า สรุปคะแนนคุณภาพ',sub:[]},
  {id:'T-1081',dept:'QC',title:'จัดหา/สั่งบัญชีกับนายหน้า (รอบสัปดาห์)',creator:'boss',assignee:'d',status:'todo',prio:'mid',start:'08-08',due:'08-10',spent:0,ontime:true,tags:['BC','บัญชี'],sop:'SOP-QC',desc:'คุยนายหน้า สั่งบัญชี ตรวจสอบหน้าเว็บ',sub:[]},
  {id:'T-1090',dept:'ADMIN',title:'สรุปเคสค้างข้ามวัน + ส่งต่อทีมที่เกี่ยวข้อง',creator:'boss',assignee:'lead_crm',status:'done',prio:'mid',start:'08-06',due:'08-06',spent:1,ontime:true,tags:['เคส','ประสานงาน'],sop:'SOP-ADMIN',
    desc:'รวบรวมเคสที่ยังไม่ปิด แจกจ่ายทีม',solution:'พบว่าเคสค้างส่วนใหญ่เกิดจากลูกค้าส่งสลิปไม่ชัด → แก้โดยตั้งข้อความอัตโนมัติขอสลิปใหม่ทันที ลดเคสค้างลง 60%',sub:[]},
  {id:'T-1030',dept:'GRAPHIC',title:'แก้ไฟล์ส่งออกผิดสเปกช่อง Telegram',creator:'lead_gr',assignee:'a',status:'done',prio:'low',start:'08-04',due:'08-05',spent:1,ontime:true,tags:['ไฟล์','แก้ไข'],sop:'SOP-GR',
    desc:'ไฟล์ที่ส่งออกความละเอียดไม่ตรงข้อกำหนด',solution:'ตั้ง Preset การ Export ต่อช่องทาง (เว็บ/ไลน์/เทเลแกรม) ไว้ใน Photoshop เป็นเทมเพลตกลาง ป้องกันส่งผิดสเปกซ้ำ',sub:[]},
  {id:'T-1024',dept:'ADMIN',title:'ตอบแชทลูกค้ากะบ่าย + ปิดเคสด่วน',creator:'lead_crm',assignee:'e',status:'done',prio:'low',start:'08-05',due:'08-05',spent:5,ontime:true,tags:['แชท','เคส'],sop:'SOP-ADMIN',desc:'ดูแลแชทลูกค้าและปิดเคส',sub:[]},
  {id:'T-1018',dept:'MKT',title:'ปล่อยแคมเปญโบนัสวันหยุด',creator:'lead_mkt',assignee:'c',status:'done',prio:'mid',start:'08-02',due:'08-04',spent:6,ontime:false,tags:['แคมเปญ'],sop:'SOP-MKT',desc:'จัดแคมเปญโบนัส',sub:[]},
  {id:'T-1101',dept:'HR',title:'สรุปเงินเดือน/วันลา/สวัสดิการรอบเดือน ส.ค.',creator:'boss',assignee:'lead_hr',status:'doing',prio:'high',start:'08-05',due:'08-09',spent:3,ontime:true,tags:['Payroll','สวัสดิการ'],sop:'SOP-HR',desc:'ตรวจความถูกต้องเงินเดือน วันลา และสวัสดิการก่อนปิดรอบ',sub:[{t:'ดึงข้อมูลจาก OMBOG',who:'hr1',st:'done'},{t:'ตรวจทานรายการ',who:'lead_hr',st:'doing'}]},
  {id:'T-1102',dept:'HR',title:'ประกาศรับสมัคร + นัดสัมภาษณ์ตำแหน่งกราฟิก',creator:'lead_hr',assignee:'hr1',status:'todo',prio:'mid',start:'08-08',due:'08-12',spent:0,ontime:true,tags:['Recruitment'],sop:'SOP-HR',desc:'ลงประกาศ คัดใบสมัคร และนัดสัมภาษณ์ตามแผนอัตรากำลัง',sub:[]},
  {id:'T-1103',dept:'BO',title:'รีเช็คสถานะบัญชีหน้าเว็บทั้ง 9 เว็บ',creator:'boss',assignee:'lead_bc',status:'doing',prio:'high',start:'08-06',due:'08-08',spent:2,ontime:true,tags:['บัญชี','รีเช็ค'],sop:'SOP-BC',desc:'ตรวจสถานะบัญชีให้ตรงกับจริงและอัปเดตชีตให้เป็นปัจจุบัน',sub:[{t:'ตรวจเว็บชุด A',who:'bc1',st:'done'},{t:'ตรวจเว็บชุด B',who:'d',st:'doing'}]},
  {id:'T-1104',dept:'BO',title:'ติดตามบัญชีมีปัญหา + ประสานนายหน้า',creator:'lead_bc',assignee:'bc1',status:'block',prio:'high',start:'08-04',due:'08-07',spent:4,ontime:false,tags:['บัญชี','นายหน้า'],sop:'SOP-BC',desc:'ติดตามเคสบัญชีติดปัญหาให้ได้ความคืบหน้า — ติดที่นายหน้ายังไม่ตอบกลับ',sub:[]},
  {id:'T-1105',dept:'BO',title:'ตรวจรับบัญชีใหม่ก่อนส่งส่วนกลาง (รอบสัปดาห์)',creator:'lead_bc',assignee:'d',status:'done',prio:'mid',start:'08-04',due:'08-05',spent:2,ontime:true,tags:['บัญชีใหม่'],sop:'SOP-BC',
    desc:'ตรวจข้อมูลบัญชีใหม่ให้ครบก่อนส่ง',solution:'ทำเช็กลิสต์ 6 จุดก่อนรับบัญชีใหม่ (ชื่อ/เลขบัญชี/สถานะ/เอกสาร/ผู้ดูแล/เว็บ) ลดบัญชีตีกลับจากส่วนกลางเหลือ 0',sub:[]},
  {id:'T-1110',dept:'AUD123',title:'ตรวจเทียบ STM กับรายงานระบบ 123 (รอบวัน)',creator:'boss',assignee:'lead_a123',status:'doing',prio:'high',start:'08-07',due:'08-08',spent:3,ontime:true,tags:['STM','Reconcile'],sop:'SOP-A123',desc:'ตรวจฝาก-ถอนธนาคารปกติ/PM เทียบ STM กับรายงานระบบ 123/BO ให้ครบ',sub:[{t:'จัดเรียงไฟล์ STM',who:'a123s',st:'done'},{t:'เทียบยอด/เวลา/ธนาคาร',who:'lead_a123',st:'doing'}]},
  {id:'T-1111',dept:'AUD123',title:'ติดตามไฟล์ชี้แจงยอดผิดปกติ + ลงความเสียหาย',creator:'lead_a123',assignee:'a123s',status:'todo',prio:'mid',start:'08-08',due:'08-11',spent:0,ontime:true,tags:['Exception','ความเสียหาย'],sop:'SOP-A123',desc:'ส่งเคสยอดไม่ตรงให้ชี้แจง ตรวจหลักฐาน และบันทึกความเสียหายเข้ารายงานเดือน',sub:[]},
  {id:'T-1112',dept:'AUDXB',title:'ตรวจเทียบ STM กับ BO/หน้าหลังบ้านระบบ XB (รอบวัน)',creator:'boss',assignee:'lead_axb',status:'doing',prio:'high',start:'08-07',due:'08-08',spent:2.5,ontime:true,tags:['STM','Reconcile'],sop:'SOP-AXB',desc:'ตรวจฝาก-ถอนเทียบ STM กับ BO/หน้าหลังบ้าน XB ให้ถูกต้องครบถ้วน',sub:[]},
  {id:'T-1113',dept:'AUDXB',title:'สรุปยอดความเสียหายประจำเดือน (ระบบ XB)',creator:'boss',assignee:'lead_axb',status:'review',prio:'mid',start:'08-05',due:'08-07',spent:4,ontime:true,tags:['รายงานเดือน'],sop:'SOP-AXB',desc:'รวบรวมรายการความเสียหายที่ตรวจพบ จัดหมวด และสรุปเข้ารายงานประจำเดือน',sub:[]},
];

/* KPI สำหรับโหมด local development เท่านั้น; เมื่อเชื่อม Production ระบบจะล้างชุดนี้
   แล้วโหลด kpi_definitions และ kpi_results ที่ผู้ใช้มีสิทธิ์เห็นจาก Supabase
   ประเภท A (มี tgt/w): กรอก Actual (%) รายเดือน → คำนวณ Achievement/คะแนน/ระดับอัตโนมัติ
     tgt = เป้าหมาย (%), w = น้ำหนัก, ac = ผลจริง (%) [ค่าตัวอย่าง แก้ได้]
   ประเภท B (ตัวอย่างเดิม CRM/MKT/ADMIN): ยังไม่มีไฟล์จริง ใช้ค่าตัวอย่าง */
const KPI = {
  PROG:[
    {n:'Technical Analysis & Readiness (วิเคราะห์ก่อนพัฒนา)',tg:'≥95%',tgt:95,w:0.15,ac:93},
    {n:'On-time Development Delivery (ส่งงานตาม Due Date)',tg:'≥90%',tgt:90,w:0.20,ac:88},
    {n:'Developer Test & Code Quality (ทดสอบ/รีวิวก่อนส่ง)',tg:'≥95%',tgt:95,w:0.15,ac:94},
    {n:'Bug Resolution within SLA (แก้ Bug ตาม SLA)',tg:'≥90%',tgt:90,w:0.10,ac:89},
    {n:'Release Readiness & Task Closure (ปิดงาน/หลักฐานครบ)',tg:'≥95%',tgt:95,w:0.10,ac:95},
    {n:'Requirement & Handoff Collaboration (ร่วม BA/PO)',tg:'≥95%',tgt:95,w:0.10,ac:93},
    {n:'QA/UAT Collaboration & Defect Response (ร่วม QA/UAT)',tg:'≥90%',tgt:90,w:0.08,ac:90},
    {n:'Deployment & Infrastructure Coordination (ร่วม DevOps)',tg:'≥95%',tgt:95,w:0.05,ac:96},
    {n:'Support / Operation Incident Collaboration (ร่วม Support)',tg:'≥90%',tgt:90,w:0.04,ac:88},
    {n:'Data / Business / Web Integration Accuracy (ร่วม Data/Web)',tg:'≥95%',tgt:95,w:0.03,ac:95}],
  FIN:[
    {n:'ความถูกต้องการเบิกจ่าย/โอนเงิน',tg:'≥99%',tgt:99,w:0.25,ac:98},
    {n:'ความถูกต้องข้อมูลกระแสเงินสด',tg:'≥99%',tgt:99,w:0.25,ac:99},
    {n:'จัดทำสรุปเดือนตรงเวลา',tg:'100%',tgt:100,w:0.20,ac:100},
    {n:'ติดตามชำระบิลค่าระบบตรงเวลา',tg:'≥98%',tgt:98,w:0.15,ac:95},
    {n:'วิเคราะห์ข้อมูลย้อนหลัง 3 เดือน',tg:'100%',tgt:100,w:0.15,ac:100}],
  GRAPHIC:[
    {n:'ส่งงานตรงเวลา (On-time Delivery)',tg:'≥95%',tgt:95,w:0.20,ac:92},
    {n:'ความถูกต้องชิ้นงาน (Artwork Accuracy)',tg:'≥98%',tgt:98,w:0.20,ac:96},
    {n:'อนุมัติภายใน 2 รอบแก้ (First Approval)',tg:'≥90%',tgt:90,w:0.20,ac:85},
    {n:'ไฟล์ส่งออกถูกสเปก (Export Compliance)',tg:'≥98%',tgt:98,w:0.20,ac:99},
    {n:'จัดเก็บไฟล์ครบ (File Archive)',tg:'100%',tgt:100,w:0.20,ac:100}],
  HR:[
    {n:'งานรับสมัคร/สัมภาษณ์ตามแผน (Recruitment)',tg:'≥90%',tgt:90,w:0.20,ac:88},
    {n:'ความถูกต้องเงินเดือน/สวัสดิการ (Payroll)',tg:'≥99%',tgt:99,w:0.20,ac:99},
    {n:'งาน HR เสร็จตรงเวลา (On-time)',tg:'≥95%',tgt:95,w:0.20,ac:90},
    {n:'ประเมินพนักงานครบรอบ (Evaluation)',tg:'100%',tgt:100,w:0.20,ac:100},
    {n:'การใช้งาน/ถูกต้องระบบ OMBOG',tg:'≥80%',tgt:80,w:0.20,ac:72}],
  QC:[
    {n:'ความครบถ้วนของการตรวจสอบแชท (9 เว็บ)',tg:'100%',tgt:100,w:0.25,ac:96},
    {n:'ความถูกต้องของผลตรวจ QC',tg:'≥98%',tgt:98,w:0.25,ac:97},
    {n:'ความถูกต้องของการบันทึกข้อมูล',tg:'≥98%',tgt:98,w:0.20,ac:98},
    {n:'การติดตามและประสานงานเคสผิดปกติ',tg:'≥95%',tgt:95,w:0.15,ac:90},
    {n:'การสรุปและอัปเดตผลตามกำหนด',tg:'≥95%',tgt:95,w:0.15,ac:93}],
  BO:[
    {n:'ความถูกต้องและเป็นปัจจุบันของสถานะบัญชี',tg:'≥98%',tgt:98,w:0.25,ac:94},
    {n:'อัตราการติดตามเคสบัญชีมีปัญหา',tg:'≥95%',tgt:95,w:0.25,ac:88},
    {n:'ความถูกต้องของการตรวจรับบัญชีใหม่',tg:'100%',tgt:100,w:0.20,ac:98},
    {n:'ความครบถ้วนก่อนรับบัญชีกลับเข้าระบบ',tg:'100%',tgt:100,w:0.15,ac:97},
    {n:'งานประจำเดือนและงานสนับสนุนตรงเวลา',tg:'≥95%',tgt:95,w:0.15,ac:92}],
  CRM:[
    {n:'ติดต่อลูกค้าใหม่ครบ (Realtime Contact)',tg:'≥95%',tgt:95,w:0.20,ac:93},
    {n:'ฝากครั้งแรก (First Deposit Conversion)',tg:'≥12%',tgt:12,w:0.20,ac:11},
    {n:'ดึงลูกค้า Inactive กลับ (Reactivation)',tg:'≥10%',tgt:10,w:0.20,ac:9},
    {n:'ติดตามครบรอบ D0/D3/D7/D30 (Follow-up)',tg:'≥95%',tgt:95,w:0.20,ac:94},
    {n:'ข้อมูล/คุณภาพการโทร (Data & Call Quality)',tg:'≥90%',tgt:90,w:0.20,ac:88}],
  MKT:[
    {n:'งานคอนเทนต์/สื่อเสร็จตามแผน (Content Execution)',tg:'≥95%',tgt:95,w:0.20,ac:96},
    {n:'ดำเนินแคมเปญ/Optimize ตามรอบ (Campaign)',tg:'≥95%',tgt:95,w:0.20,ac:94},
    {n:'สรุป/วิเคราะห์ข้อมูลตรงเวลา (Data Analysis)',tg:'≥95%',tgt:95,w:0.20,ac:95},
    {n:'ดูแล Social Media ตามแผน (X/VK/Telegram)',tg:'≥90%',tgt:90,w:0.20,ac:92},
    {n:'นำ AI/Automation มาใช้ (AI Adoption)',tg:'≥80%',tgt:80,w:0.20,ac:70}],
  ADMIN:[
    {n:'คุณภาพบริการ/ตอบแชท (Service & Chat)',tg:'≥95%',tgt:95,w:0.20,ac:94},
    {n:'ความถูกต้องฝาก-ถอน/บัญชี (Accuracy)',tg:'≥99%',tgt:99,w:0.20,ac:99},
    {n:'งานรูทีน/ส่งต่อตรงเวลา (Routine & Handover)',tg:'≥95%',tgt:95,w:0.20,ac:93},
    {n:'ความถูกต้อง Audit/รายงาน (Audit & Report)',tg:'≥98%',tgt:98,w:0.20,ac:97},
    {n:'แจ้ง/ประสานเคสตาม SLA (Escalation)',tg:'≥95%',tgt:95,w:0.20,ac:92}],
  BOM:[
    {n:'ติดตามหน้างานประจำวันครบ (Daily Monitoring)',tg:'≥95%',tgt:95,w:0.20,ac:93},
    {n:'รายงานถูกต้อง/ตรงเวลา (Report Accuracy)',tg:'≥98%',tgt:98,w:0.20,ac:96},
    {n:'จัดการเคสเร่งด่วนตาม SLA (Critical Issue)',tg:'≥95%',tgt:95,w:0.20,ac:90},
    {n:'ติดตาม/ส่งต่องานข้ามทีม (Cross-team)',tg:'≥95%',tgt:95,w:0.20,ac:92},
    {n:'คุมคุณภาพงาน Admin (Quality & Control)',tg:'≥95%',tgt:95,w:0.20,ac:94}],
  KPI:[
    {n:'ออกแบบ/อนุมัติ KPI ครบตามแผน (Design & Approval)',tg:'≥95%',tgt:95,w:0.20,ac:96},
    {n:'ติดตาม/รายงาน KPI ตรงรอบ (Monitoring & Reporting)',tg:'≥95%',tgt:95,w:0.20,ac:95},
    {n:'ความถูกต้องข้อมูล/Dashboard (Data Accuracy)',tg:'≥99%',tgt:99,w:0.20,ac:99},
    {n:'ติดตาม Action Plan/SOP จนจบงาน',tg:'≥95%',tgt:95,w:0.20,ac:93},
    {n:'พัฒนาระบบ KPI/AI & Automation',tg:'≥80%',tgt:80,w:0.20,ac:72}],
  AUD123:[
    {n:'ตรวจบัญชีฝาก-ถอนครบตามแผน (Account Verification)',tg:'≥95%',tgt:95,w:0.20,ac:94},
    {n:'ความถูกต้องการเทียบ STM (Reconciliation)',tg:'≥99%',tgt:99,w:0.20,ac:98},
    {n:'ติดตามยอดผิดปกติ/ไฟล์ชี้แจงตรงเวลา (Exception)',tg:'≥95%',tgt:95,w:0.20,ac:90},
    {n:'บันทึกความเสียหาย/รายงานเดือนถูกต้อง (Damage & Report)',tg:'≥99%',tgt:99,w:0.20,ac:99},
    {n:'วิเคราะห์ความเสี่ยง/AI (Risk Analysis)',tg:'≥80%',tgt:80,w:0.20,ac:74}],
  AUDXB:[
    {n:'ตรวจบัญชีฝาก-ถอนครบตามแผน (Account Verification)',tg:'≥95%',tgt:95,w:0.20,ac:92},
    {n:'ความถูกต้องการเทียบ STM (Reconciliation)',tg:'≥99%',tgt:99,w:0.20,ac:97},
    {n:'ติดตามยอดผิดปกติ/ไฟล์ชี้แจงตรงเวลา (Exception)',tg:'≥95%',tgt:95,w:0.20,ac:93},
    {n:'บันทึกความเสียหาย/รายงานเดือนถูกต้อง (Damage & Report)',tg:'≥99%',tgt:99,w:0.20,ac:98},
    {n:'วิเคราะห์ความเสี่ยง/AI (Risk Analysis)',tg:'≥80%',tgt:80,w:0.20,ac:70}],
};
/* ===== KPI: คำนวณ Achievement จาก Actual/Target แล้วเก็บใน k.pct ===== */
function kpiAch(k){ return k.tgt!=null ? Math.round(k.ac / k.tgt * 100) : k.pct; }
function recalcKPI(){ Object.keys(KPI).forEach(c=>KPI[c].forEach(k=>{ if(k.tgt!=null) k.pct=kpiAch(k); })); }
/* ค่าที่แสดง (Actual) — ตัวชี้วัดจริงแสดงเป็น % */
const acDisp = k => k.ac==null?'ยังไม่มีผลจริง':k.metadata?.unit==='ratio'?`${Math.round(k.ac*10000)/100}%`:k.tgt!=null?k.ac+'%':k.ac;
/* คะแนนรวมแผนก 0–100: มีน้ำหนัก → ถ่วงน้ำหนัก (Achievement เกิน 100 นับที่ 100) ; ไม่มีน้ำหนัก → เฉลี่ยเท่ากัน */
const deptScore = code => { const a=KPI[code]; if(!a)return null;
  if(a.every(k=>k.w!=null)){const total=a.reduce((s,k)=>s+Math.min(k.pct,100*(k.metadata?.achievement_cap||1))*k.w,0);return code==='PROG'?Math.round(total*100)/100:Math.round(total);}
  return Math.round(a.reduce((s,k)=>s+Math.min(k.pct,100),0)/a.length); };
/* เกณฑ์ 5 ระดับ (เทียบ Target): ดีเยี่ยม ≥100 · ดีมาก 95–99.9 · ดี 90–94.9 · พอใช้ 80–89.9 · ต้องปรับปรุง <80 */
const scoreColor = s => s==null?'var(--muted)':s>=95?'var(--green)':s>=80?'var(--amber)':'var(--red)';
const scoreLabel = (s,code) => code==='PROG'?(s==null?'ยังไม่มีผลรับรอง':s>=100?'ยอดเยี่ยม':s>=90?'ดีเยี่ยม':s>=80?'ดีมาก':s>=70?'ดี':s>=60?'พอใช้':'ต้องปรับปรุง'): s==null?'ยังไม่มีผลรับรอง':s>=100?'ดีเยี่ยม':s>=95?'ดีมาก':s>=90?'ดี':s>=80?'พอใช้':'ต้องปรับปรุง';
function kpiLegend(){return `<div class="legend" style="margin-top:10px;padding-top:9px;border-top:1px dashed var(--line-2)">
  <span><span class="kpi-icn" style="width:17px;height:17px;font-size:10px;border-radius:5px;background:var(--green)">✓</span> ดีเยี่ยม ≥100% · ดีมาก 95–99%</span>
  <span><span class="kpi-icn" style="width:17px;height:17px;font-size:10px;border-radius:5px;background:var(--amber)">≈</span> ดี 90–94% · พอใช้ 80–89%</span>
  <span><span class="kpi-icn" style="width:17px;height:17px;font-size:10px;border-radius:5px;background:var(--red)">!</span> ต้องปรับปรุง &lt;80%</span>
  <span class="muted" style="font-size:11px">เทียบ Achievement กับ Target · ใช้เพดานและเกณฑ์ตามเอกสารแต่ละแผนก (Programmer: สูงสุด 120%; คะแนน ≥100 ยอดเยี่ยม / ≥90 ดีเยี่ยม / ≥80 ดีมาก / ≥70 ดี / ≥60 พอใช้)</span></div>`;}
const KPI_TREND = {label:'คะแนน KPI รวมบริษัท (5 สัปดาห์)',pts:[92,90,94,95,99],weeks:['W27','W28','W29','W30','W31']};
const BIZ = {customers:[980,1040,1010,1180,1284], revenue:[620,680,590,740,842], completed:[9,11,10,13,15]};

const SOPS = [
  {id:"SOP-PROG",dept:"PROG",title:"Workflow โปรแกรมเมอร์ (Programmer)",v:"1.0",goal:"กำหนดขอบเขตงานที่ Programmer รับผิดชอบเอง และงานที่ทำร่วมกับส่วนงานอื่น ให้ส่งต่องาน (Handoff) ครบ ลดงานตกหล่นและ Rework",duties:["วิเคราะห์ Technical Requirement + ผลกระทบต่อ Frontend / Backend / Database / API", "ออกแบบ Logic, Data Flow, Validation, Error Handling, Query", "พัฒนา Feature / Change Request / Dashboard / Report / API / Integration / Automation", "แก้ Bug + ปรับปรุง Performance (โหลดข้อมูลมาก, Export, Upload ไฟล์ใหญ่)", "ทำ Developer Test / Unit Test / Integration Test ในส่วนที่พัฒนา", "จัดการ Source Code, Branch, Commit, PR และ Release Note"],steps:["P1 รับ Task ที่พร้อมพัฒนา: ตรวจ Scope, Acceptance Criteria, Priority, Due Date, Dependency (Requirement ไม่ชัด — ห้ามเริ่ม)", "P2 วิเคราะห์ทางเทคนิค: Logic, Database, API, Security, Performance, Edge Case + Estimate / Risk", "P3 ออกแบบ Solution: Data Flow, API Contract, Validation, Error Handling, Schema/Query, วิธี Rollback", "P4 พัฒนา: เขียน Code ตาม Convention, ไม่ Hard-code Secret, ใช้ Config/Environment + Commit/PR", "P5 Developer Test: Happy Path, Error, Null/Empty, Date-Time, Permission, Large Data, Regression", "P6 แก้ปัญหาจากการทดสอบตนเอง: แก้ Defect + ทดสอบซ้ำจนผ่านก่อนส่ง (ห้ามส่งทั้งที่มี Critical defect)", "P7 เตรียมส่งต่องาน (Handoff): อัปเดต Task, วิธีทดสอบ, Test Data, Known Limitation, Commit/PR", "P8 ปิดงานฝั่ง Development: อัปเดต Actual Finish, Root Cause / Rework (ถ้ามี), สถานะ Task (ตรวจย้อนกลับได้)"],tools:["Source Control (Git): Branch / Commit / Pull Request", "Config / Environment Variable (ไม่ Hard-code Secret)", "Task / Issue Tracker + Release Note", "Logging, Smoke Test, Developer/Unit/Integration Test"],issues:["ก่อนส่ง BA/Requester → ระบุประเด็นที่ต้องตัดสินใจ + ผลกระทบ + ทางเลือก (ห้ามถามกว้าง ๆ ไม่มีบริบท)", "ก่อนส่ง QA/UAT → Developer Test ผ่าน + Test Note/Test Data + ระบุ Scope ที่เปลี่ยน + Known Limitation", "ก่อน Deploy → Version/Commit ชัด + Migration/Config/Dependency ครบ + มี Rollback สำหรับ Change สำคัญ", "ก่อนปิด Bug → Reproduce ได้ + Fix ผ่าน Test + ระบุ Root Cause สำหรับ Major/Critical", "Requirement เปลี่ยนหลังเริ่มพัฒนา → เปิด Change Request + ประเมิน Scope/Timeline ใหม่"],ai:["ช่วยวิเคราะห์ Log / Reproduce หา Root Cause ของ Incident", "ตรวจ Code Convention / Secret / Permission เบื้องต้น", "สรุป Release Note / Handoff Package อัตโนมัติ", "แจ้งเตือน Task ใกล้ Due / Bug เกิน SLA / Blocker ที่รอหน่วยงานอื่น", "⚠️ คนตัดสินใจ: Business Rule, Acceptance, การ Deploy Production และ Rollback"]},
  {id:"SOP-KPI",dept:"KPI",title:"Workflow แผนก KPI",v:"1.2",goal:"กำหนด–ติดตาม–วิเคราะห์–แก้ไข–รายงาน KPI ให้เป็นมาตรฐานเดียวกันทั้งองค์กร",duties:["กำหนด KPI ของแต่ละแผนก", "ติดตามผลการดำเนินงาน", "วิเคราะห์ข้อมูลและแนวโน้ม", "ตรวจสอบคุณภาพงานและ SOP", "ประเมินผลการปฏิบัติงาน", "จัดทำ Dashboard / รายงานผู้บริหาร", "พัฒนาระบบ KPI และมาตรฐานการทำงาน", "สนับสนุน AI และ Automation"],steps:["รับนโยบายจากผู้บริหาร: ตรวจ KPI เดิม + เป้าหมาย + ผลที่ผ่านมา แล้วกำหนดแผนดำเนินงาน", "ประชุมแต่ละแผนก: รวบรวม Workflow / หน้าที่ / เป้า / ปัญหา ตรวจความถูกต้องก่อนจัดเก็บ", "ออกแบบ KPI: กำหนด Target, Weight, รอบวัดผล และวิธีคิดคะแนน (หัวหน้า Review → ผู้บริหาร Approve)", "จัดทำ Dashboard: รวบรวม → Clean Data → สร้าง Dashboard → ตรวจสูตร/ช่วงวันที่ → Publish", "ติดตามผล: เทียบ Actual กับ Target วิเคราะห์แนวโน้ม ต่ำกว่าเป้าแจ้งหัวหน้าแผนก", "วิเคราะห์ปัญหา: ตรวจ Workflow / บุคลากร / ระบบ / คุณภาพงาน หา Root Cause (ห้ามสรุปจากตัวเลขอย่างเดียว)", "ติดตามการแก้ไข: สร้าง Action Plan → Owner → Deadline → ติดตาม → ปิดงาน", "รายงานผู้บริหาร: สรุป Dashboard → เสนอ → รับ Feedback → ปรับ KPI/แผน"],tools:["Google Workspace / Sheets / Drive", "Looker Studio, Excel", "Telegram, ChatGPT / AI", "ERP / CRM, HR System, Attendance System"],issues:["กรอกข้อมูลผิด / ลืมอัปเดต → ใช้ Checklist ก่อน Publish ทุกครั้ง", "คำนวณ/ใช้สูตรผิด, ใช้ KPI เวอร์ชันเก่า → ตรวจสูตรและยืนยัน KPI Version ปัจจุบัน", "ข้อมูลซ้ำ/ตกหล่น, ส่งรายงานผิด Version → ตรวจ Source Data และชื่อไฟล์/ผู้รับก่อนส่ง", "ข้อมูลล่าช้า/ไม่ครบ → ระบุผู้รับผิดชอบ + Deadline และติดตามจนครบ"],ai:["ดึง/รวมข้อมูลหลายระบบ + ตรวจข้อมูลผิดปกติ", "แจ้งเตือน KPI ต่ำกว่าเป้า / งานใกล้ Deadline", "สรุปรายงานอัตโนมัติ, Dashboard Real-time, สรุปประชุม", "วิเคราะห์แนวโน้ม KPI, Productivity, ความเสี่ยง", "⚠️ Human Approval: อนุมัติ KPI / คะแนน / สาเหตุ / Action Plan และรายงาน"]},
  {id:"SOP-GR",dept:"GRAPHIC",title:"Workflow กราฟิก",v:"2.0",goal:"ให้งานกราฟิกถูกต้อง ตรง Brief ส่งทันเวลา และรักษามาตรฐานภาพลักษณ์องค์กร",duties:["ออกแบบและผลิตสื่อประชาสัมพันธ์ออนไลน์/ดิจิทัล (Banner, โฆษณา, ข่าว, โปรฯ, ประกาศ)", "ผลิต/ตัดต่อ Video, GIF, Motion Graphic ตามช่องทาง", "ปรับงานให้ตรงอัตลักษณ์องค์กร + เตรียมไฟล์ตามมาตรฐานก่อนเผยแพร่", "สนับสนุนงาน Marketing / Admin + จัดเก็บไฟล์ให้ค้นหาง่าย"],steps:["รับคำขอ: รับ Brief + ไฟล์ประกอบ ตรวจรายละเอียด / Deadline / Logo / ข้อความให้ครบ", "วางแผน: ประเมินเวลา จัด Priority มอบหมายงานและ Timeline", "ออกแบบ: จัด Layout, สี, Typography ตาม Brief / Brand / ช่องทาง", "ตรวจภายใน: คำสะกด / วันที่ / เวลา / Logo / ช่องทางติดต่อ", "ส่งตรวจ: ส่งผู้สั่งงาน รวม Feedback แก้จนได้รับอนุมัติ", "Export & จัดเก็บ: Export ตรงสเปกช่องทาง ตั้งชื่อไฟล์มาตรฐาน เก็บ Drive และปิดงาน"],tools:["Trello (รับงาน / มอบหมาย / ติดตาม)", "Telegram / E-mail (ประสานงาน)", "Adobe Photoshop, Figma", "Freepik, Google Drive"],issues:["Brief ไม่ครบ → หยุดงาน ขอข้อมูลที่ขาด ยืนยัน Brief ก่อนเริ่ม", "ข้อมูลเปลี่ยนหลายครั้ง → รวม Feedback รอบเดียว ยืนยัน Version ล่าสุด", "ไฟล์ Export ผิดขนาด/ความละเอียด → ตรวจ Spec ช่องทาง Export ใหม่ เปิดตรวจก่อนส่ง", "งานไม่ตรง Brand → เทียบ Brand Guideline ปรับสี/ภาพ/Typography", "หาไฟล์เก่าไม่เจอ → ใช้มาตรฐานชื่อไฟล์/โฟลเดอร์ใน Drive"],ai:["ตรวจความครบของ Brief + แจ้งเตือน Deadline", "จัด Priority และติดตามสถานะบน Trello", "สร้าง Draft Artwork / ลบพื้นหลัง / Retouch / Resize", "ช่วยร่าง Caption + สรุป Engagement", "⚠️ คนตัดสินใจ: Concept, Brand, ความสวยงาม และอนุมัติขั้นสุดท้าย"]},
  {id:"SOP-CRM",dept:"CRM",title:"Workflow CRM (Realtime & Retention)",v:"1.1",goal:"ข้อมูลถูกต้อง → โทรถูกกลุ่ม → บันทึกทันที → Follow-up ครบ → สรุป KPI",duties:["ดูแลลูกค้าใหม่ (Real Time): เริ่มใช้งานราบรื่น เน้น First Deposit", "ดูแลลูกค้าเก่าที่หยุดใช้งาน (Inactive): หาสาเหตุและชวนกลับมา (Reactivation)", "บันทึกผลการติดต่อและติดตาม Follow-up ทุกเคส", "สรุป KPI: Contact, Conversion, Deposit, เคสค้าง"],steps:["ดึงรายชื่อ: ดึงข้อมูลตามวันที่ / Scope ที่กำหนด", "Clean Data: ตรวจข้อมูลซ้ำ ชื่อ เบอร์ และสถานะ", "จัด Priority: P1 ยังไม่ฝาก / P2 มีปัญหา / P3 Follow-up / P4 อื่น", "ตรวจก่อนโทร: ดู Activity, ประวัติฝาก, โปรโมชั่น", "โทรลูกค้า: แนะนำตัว → สอบถาม → ช่วยเหลือ → นำเสนอ → สรุป", "บันทึกทันที: ผล / สถานะ / ปัญหา / โปรฯ / วัน Follow-up (จบสายบันทึกทันที)", "ติดตามผล: ตรวจ D0 / D3 / D7 / D30", "สรุป KPI: Contact, Conversion, Deposit และเคสค้าง"],tools:["Yalecom (โทรออก / ติดตามผล)", "Looker (วิเคราะห์ลูกค้า)", "Google Sheets, Excel", "เว็บไซต์ / Agent หลังบ้าน"],issues:["ลูกค้าไม่รับสาย / เบอร์ติดต่อไม่ได้ → บันทึกผล + กำหนด Follow-up", "ข้อมูลไม่ตรงกัน → ตรวจระบบต้นทาง ห้ามเดา", "ยอดฝากไม่ตรง → ตรวจช่วงเวลา + ระบบต้นทาง (ฝากก่อนหรือหลังโทร)", "ปัญหาสมัคร/ฝาก หรือเกินอำนาจ CRM → ช่วยเบื้องต้น + Escalate ทันที"],ai:["ตรวจข้อมูลซ้ำ, จัด Priority", "แจ้งเตือน Follow-up", "สรุป KPI + วิเคราะห์แนวโน้ม", "ตรวจความผิดปกติของข้อมูล", "⚠️ คำแนะนำ AI เรื่องโปรฯ / ประเมินพนักงาน ต้องผ่านผู้รับผิดชอบก่อน"]},
  {id:"SOP-MKT",dept:"MKT",title:"Workflow การตลาด",v:"1.3",goal:"ให้งาน Marketing, Campaign และ Data Analysis มีขั้นตอนเดียวกัน ตรวจสอบง่าย ลดเวลาค้นหา/คัดคอนเทนต์",duties:["Marketing: วางแผนสื่อสารแบรนด์ ดูแล Awareness จัดการคอนเทนต์บน Social Media", "Campaign: กำหนดกลุ่มเป้าหมาย/งบ ตั้งค่าโฆษณา ติดตามผล และ Optimize", "Data Analysis: ดึงข้อมูลจาก Internal BI, Clean ใน Excel, สรุปผลและจัดทำรายงาน"],steps:["Marketing: คัดคอนเทนต์ → ตรวจ Artwork → โพสต์ (FB / Telegram / X / VK) → ตอบ Comment/Inbox", "Campaign: กำหนด Target + Budget → ตั้งค่า Ads → ติดตามรายวัน → Optimize", "Data: ดึง Data → Clean (ตรวจค่าผิดปกติ/ซ้ำ) → สรุปผล → วิเคราะห์และเขียนรายงาน", "ก่อนเผยแพร่: ตรวจข้อความ + Artwork + กลุ่มเป้าหมาย + สิทธิ์การใช้สื่อทุกครั้ง", "งานที่มีผลต่อแบรนด์/งบ ต้องให้ผู้รับผิดชอบอนุมัติก่อน"],tools:["Excel, Google Docs / Drive", "Facebook, Telegram, X, VK", "Internal BI", "AI Studio, ChatGPT, Gemini"],issues:["หาข้อมูลนาน → กำหนด Folder/Source มาตรฐาน + Template", "ใช้เวลาคัดคอนเทนต์นาน → เกณฑ์คัดเลือก + ให้ AI เสนอหัวข้อ (คนอนุมัติ)", "โพสต์/Artwork ผิด → หยุด/แก้ ตรวจ Source ตรวจซ้ำก่อนโพสต์ใหม่", "Campaign ผลต่ำ → ตรวจ Target/Creative/Budget ปรับทีละปัจจัย", "Data ไม่ตรง → ตรวจช่วงเวลา/Filter/Formula/Source ทำ Reconcile ก่อนสรุป"],ai:["คิดหัวข้อ / ร่างคำโฆษณาหลายแบบ", "ช่วยจัดกลุ่มลูกค้าตามพฤติกรรม (Segmentation)", "สรุปแนวโน้ม / ตั้งสมมติฐาน / จัดรูปแบบรายงาน", "ช่วยงานซ้ำ เช่น เตรียมโพสต์ / จัดลำดับงาน", "⚠️ AI = ผู้ช่วยร่างและวิเคราะห์ ไม่ใช่ผู้อนุมัติสุดท้าย (โฆษณา/งบ/เผยแพร่)"]},
  {id:"SOP-FIN",dept:"FIN",title:"Workflow การเงิน",v:"1.0",goal:"ทำให้ขั้นตอนงานการเงินชัดเจน ตรวจสอบง่าย ลดความผิดพลาดจากการลงข้อมูลด้วยมือ",duties:["รับ/ส่งรายการเบิกจ่ายใน Telegram พร้อมหลักฐาน", "พิจารณาอนุมัติยอดเบิกตามขอบเขตอำนาจ + โอนจ่ายและแนบสลิป", "จัดทำเงินสำรองเบิก + รายละเอียดแยกหมวดหมู่", "บันทึกกระแสเงินสด + สรุปเดือน (กำไร/ขาดทุน) + ตรวจบิลค่าระบบ", "วิเคราะห์ข้อมูลย้อนหลัง 3 เดือนร่วมกับทีมบริหารแอดมิน"],steps:["ผู้ขอเบิกส่งรายการ + หลักฐานใน Telegram", "ผู้มีอำนาจพิจารณาความสมเหตุสมผลและอนุมัติ", "การเงินตรวจยอด / ผู้รับ / ช่องทาง / สกุลเงินก่อนโอน", "ทำรายการโอนจ่าย + แนบสลิปในกลุ่ม", "Bot ดึงข้อมูลจากกลุ่มเข้า Google Sheet", "ตรวจข้อมูลใน Sheet ให้ครบและตรงหลักฐาน", "สรุปเดือน: ลงกระแสเงินสด → รวมค่าใช้จ่าย → คำนวณกำไร/ขาดทุน → กระทบยอด (ไม่ตรงห้ามสรุป)", "ติดตามบิลค่าระบบ + วิเคราะห์ย้อนหลัง 3 เดือน"],tools:["Telegram", "Bot ดึงข้อมูล Telegram → Google Sheet", "Google Sheet", "Back office: BO / Agent", "ChatGPT (ช่วยวิเคราะห์ ไม่ใช่ผู้อนุมัติ)"],issues:["ดึงข้อมูลจาก BO/Agent ด้วยมือ อาจสลับยอด → ตรวจเทียบ Source ก่อนบันทึก ใช้ Automation", "ลงกระแสเงินสดไม่ตรงกระเป๋า → ตรวจ Wallet/บัญชีต้นทาง-ปลายทาง Reconcile ทุกวัน", "สรุปเดือนไม่ตรง → หารายการที่หาย/บันทึกผิด ก่อนปิดเดือน"],ai:["บันทึกรายการเบิกจ่ายอัตโนมัติจาก Telegram", "ดึงข้อมูล BO/Agent เข้าตารางสรุปเดือน", "แจ้งเตือนรายการไม่ครบ / ยอดไม่ตรง / บิลใกล้ครบกำหนด", "ช่วยจัดทำสรุปเดือน + เปรียบเทียบย้อนหลัง", "⚠️ คนอนุมัติ: การอนุมัติยอดเบิก, การโอน USDT/USD/เงินสด, การตีความผลสรุปเดือน"]},
  {id:"SOP-QC",dept:"QC",title:"Workflow QC Chat",v:"1.0",goal:"ตรวจคุณภาพการตอบแชทของแอดมินให้ได้มาตรฐาน ลดการตอบล่าช้า / ไม่ตรงคำถาม / ปิดเคสไม่สมบูรณ์",duties:["ตรวจคุณภาพการให้บริการแชทของแอดมินทั้ง 9 เว็บ", "ตรวจการตอบล่าช้า ตอบไม่ตรงคำถาม และการปิดการสนทนา", "บันทึกผลและอัปเดตข้อมูลลง Google Sheets"],steps:["ตรวจสอบแชท: ตรวจทั้ง 9 เว็บ ตั้งแต่ 00.00 น. ถึงปัจจุบัน เน้นตอบช้า / ไม่ตรง / ปิดเคสไม่สมบูรณ์", "บันทึกจุดตรวจ: บันทึกจำนวนแชทและเวลาที่ตรวจไว้เพื่อใช้รอบถัดไป", "พบตอบช้า: สอบถามสาเหตุในกลุ่ม + ระบุผู้รับผิดชอบตามกะ", "รับคำชี้แจง: ตรวจความสมเหตุสมผลของสาเหตุ", "บันทึกผล: ลงชีตรายละเอียดการตอบแชทล่าช้าตามหลักเกณฑ์บริษัท"],tools:["Google Sheets (บันทึกผลตรวจ)", "LINE Official (ตรวจสอบแชท)"],issues:["ตรวจแชทไม่ครบช่วงเวลา → ใช้ Checklist ก่อนปิดรอบ QC", "บันทึกจำนวน/เวลาผิด, ลงชีตผิดช่อง/ผิดวัน → ตรวจซ้ำก่อนปิดรอบ", "ประสานงานแอดมินไม่ครบ ทำให้คำชี้แจงล่าช้า → ติดตามให้ครบ"],ai:["ตรวจจับตอบช้า + แจ้งเตือนเมื่อเกินเกณฑ์", "วิเคราะห์คุณภาพคำตอบ (ตรงคำถาม / ครบ / ปิดสนทนา)", "บันทึกผลอัตโนมัติ + สรุปสถิติรายวัน/สัปดาห์/เดือน", "Dashboard แสดงแนวโน้มปัญหาแบบเรียลไทม์", "⚠️ คนตัดสินใจ: สรุปสาเหตุ, กรณีซับซ้อน, ความสมเหตุสมผลของคำชี้แจง"]},
  {id:"SOP-ADMIN",dept:"ADMIN",title:"Workflow แอดมิน",v:"1.0",goal:"มาตรฐานการรับกะ ตรวจระบบ ดูแลลูกค้า ทำธุรกรรม ประสานงาน และส่งต่องานให้เป็นแนวทางเดียวกัน",duties:["บริการลูกค้า: ตอบ Line / Telegram / Live Chat, แจ้งสถานะ, ติดตามเคส", "ธุรกรรม: ตรวจฝาก-ถอน, รายการมือ, รายการยอดสูง, PM/Payment, ค่าคอม", "ระบบและบัญชี: เช็กลิงก์/ผลิตภัณฑ์, ยอดบัญชี, Statement, Bot/SMS", "ข้อมูล & Audit: ดึงรายงาน, ทำไฟล์ชี้แจง, ส่ง STM/PM, สรุปประจำวัน/เดือน", "ประสานงาน: PM, CRM, BC, SC, HR, Marketing, กราฟิก, Audit, ปกม."],steps:["รับต่องาน: อ่านเคสค้าง ปัญหาระบบ ช่องทางที่ปิด งานรออนุมัติ และสถานะบัญชี", "ตรวจความพร้อม: เช็กเครื่อง / ยอดบัญชี / PM / Payment / ลิงก์ตามรอบ", "ปฏิบัติงาน: ดูแลแชท ตรวจฝาก-ถอน โปรโมชั่น ตามหน้าที่", "ประสานงาน: ส่งข้อมูลผ่านกลุ่ม/ระบบพร้อมหลักฐานครบ", "ติดตาม: อัปเดตสถานะเคสจนจบหรือถึงจุดส่งต่อ", "Final Check: ตรวจผลรายการ ยอดคงเหลือ เอกสาร เคสค้าง", "ส่งต่องาน: สรุปเหตุการณ์ 12 ชั่วโมง/กะ ผู้รับผิดชอบ สถานะ Next action"],tools:["Line / Telegram / Live Chat", "Back office: BO / Agent", "PLANKA (เปิด/ติดตามเคส)", "Google Sheets / Excel, Dropbox, Gmail"],issues:["ทำรายการจากภาพแชท/คำบอกอย่างเดียว → ต้องมีข้อมูลจากระบบ/Statement/Report ที่ตรวจย้อนกลับได้", "รายการเกินวงเงิน/สิทธิ์ → หยุดรายการ รวบรวมหลักฐาน ส่งรอง/หัวหน้า", "ข้อมูลฝาก-ถอน/Statement ไม่ตรง → ห้ามปรับยอดจากการเดา รีเช็คต้นทาง", "บัญชีธนาคารถูกระงับ → ปิดการมองเห็น ลดผลกระทบ แจ้งผู้เกี่ยวข้อง", "PM/Payment ล่าช้า → ตรวจ Report/Callback/Merchant แล้วเปิดเคส Support/ปกม."],ai:["สรุปเคส / ต่องานจาก Telegram", "แจ้งเตือนรายการยอดสูง / เกินวงเงิน", "ดึงข้อมูลหลังบ้านทำ Audit / Statement", "ตรวจความผิดปกติของธุรกรรม", "⚠️ คนตัดสินใจ: อนุมัติวงเงิน, เคสเสี่ยง, การปรับยอด"]},
  {id:"SOP-HR",dept:"HR",title:"Workflow ทรัพยากรบุคคล (HR)",v:"1.0",goal:"ตรวจ → เทียบ → ยืนยัน → ดำเนินการ | ข้อมูลไม่ตรง/ไม่แน่ใจ ให้หยุดตรวจสอบก่อน",duties:["รับสมัคร / คัดกรอง / สัมภาษณ์ / จ้างงาน", "ดูแลค่าตอบแทน: เงินเดือน / สวัสดิการ / วันลา / เงินปันผล", "สื่อสารภายในองค์กร (ประกาศ)", "ประเมินผลพนักงาน (Performance)", "ดูแล/พัฒนาการใช้งานระบบ OMBOG"],steps:["รับสมัคร: ทำประกาศ → รับข้อมูล → คัดกรองเบื้องต้น", "สัมภาษณ์: ผู้ผ่านเกณฑ์สัมภาษณ์โทรศัพท์ ~40–60 นาที + บันทึกผล", "เก็บประวัติ: ตรวจข้อมูล → จัดทำประวัติ → เก็บใน Google Drive", "ค่าตอบแทน: รับสรุปจากหัวหน้าทีม → เทียบ OMBOG → ตรวจเงินเดือน/วันลา/สวัสดิการ → ยืนยันก่อนจ่าย", "ประกาศ: ตรวจข้อเท็จจริง → เรียบเรียง → ตรวจซ้ำ → แจ้งผู้เกี่ยวข้อง", "Performance: รวบรวมข้อมูล → ตรวจ → ประเมิน → ส่งผู้รับผิดชอบ", "พัฒนา OMBOG: เก็บปัญหาหน้างาน → แจ้ง Programmer → ทดสอบหลังแก้"],tools:["OMBOG (ระบบ HR)", "Google Drive", "Check-in / Check-out", "สรุปจากหัวหน้าแต่ละทีม"],issues:["เงินเดือน/วันลา/ปันผลไม่ตรง → หยุดสรุปยอด เทียบ OMBOG + สรุปหัวหน้าทีม แก้แล้วคำนวณใหม่", "เวลาเข้า-ออกผิด → ตรวจ Check-in/out จริง แก้ไขหรือแจ้ง Programmer", "ระบบ Error → เก็บหลักฐาน แจ้ง Programmer ทดสอบหลังแก้", "ประกาศผิด → แก้ข้อมูลต้นทาง ชี้แจงให้ชัดเจน"],ai:["ช่วยร่าง/ตรวจประกาศรับสมัคร", "เทียบข้อมูลค่าตอบแทนหาจุดต่าง", "สรุปข้อมูล Performance", "แจ้งเตือนวันลา / เวลาเข้า-ออกผิดปกติ", "⚠️ กฎ: ห้ามใช้ OMBOG แหล่งเดียวสรุปค่าตอบแทน — คนยืนยันก่อนจ่ายเสมอ"]},
  {id:"SOP-BC",dept:"BO",title:"Workflow Back Office (BC)",v:"1.0",goal:"รีเช็คบัญชีหน้างานให้เป็นปัจจุบัน แก้เคสบัญชีมีปัญหา และประสานนายหน้าจนจบงาน",duties:["รีเช็คบัญชีหน้างาน + อัปเดตสถานะให้เป็นปัจจุบัน", "รับ/แก้เคสบัญชีติดปัญหา (ติดสแกนใบหน้า / ถูกอายัด)", "ประสานและติดตามนายหน้าจนเคสเสร็จ", "ตรวจบัญชีใหม่ก่อนส่งส่วนกลาง + ดูแลเบอร์โทร/งานเบิก", "รีเช็คสถานะบัญชีทั้งหมดช่วงวันที่ 18–20 ของทุกเดือน"],steps:["จัดหานายหน้า: คุยเรื่องบัญชีและราคา", "สั่งบัญชี: ส่งโทรศัพท์ให้นายหน้า", "ติดตาม: สอบถามความคืบหน้าต่อเนื่อง", "ตรวจรับ: เช็กข้อมูลบัญชีและความถูกต้อง", "ส่งส่วนกลาง: ส่งข้อมูลหลังตรวจครบ", "เบิกค่าใช้จ่าย: ทำเบิกค่าบัญชีใหม่", "บันทึก: ลงข้อมูลและสถานะในชีต"],tools:["Google Sheets (ข้อมูลบัญชี / รายเดือน)", "Excel (เบิกค่าโทรศัพท์)"],issues:["อัปเดตสถานะบัญชีในชีตไม่เป็นปัจจุบัน → ใช้ Checklist ก่อนปิดเคส", "ตรวจบัญชีใหม่ไม่ครบก่อนส่งส่วนกลาง → ตรวจให้ครบก่อนส่ง", "รับบัญชีกลับก่อนตรวจว่าปัญหาแก้ครบ → ยืนยันไม่มีประเด็นคงค้างก่อนรับกลับ", "นายหน้าไม่ตอบ/แก้ล่าช้า → ติดตาม + Escalate", "ลืมเติมเงินเบอร์โทรศัพท์ → ใช้แจ้งเตือน"],ai:["ช่วยใส่ข้อมูลและสถานะบัญชี", "เปรียบเทียบระบบกับชีต แจ้งเมื่อข้อมูลไม่ตรง", "เช็กความครบก่อนส่งนายหน้า", "แจ้งเตือนเติมเงินเบอร์ / งานค้างนายหน้า", "⚠️ คนตัดสินใจ: เลือกแนวทางแก้ปัญหาบัญชี, เร่งนายหน้า, ยืนยันผลแก้ไข"]},
  {id:"SOP-A123",dept:"AUD123",title:"Workflow ออดิทระบบ (ส่วนกลาง)",v:"1.0",goal:"ตรวจบัญชีฝาก-ถอน และรวบรวมความเสียหายจากการทำงานของพนักงานทุกบริษัทในเครือ (ระบบ 123)",duties:["ตรวจบัญชีฝาก-ถอนธนาคารปกติและ PM ระบบ 123", "เทียบ STM กับรายงานบัญชี/BO ให้ตรงกัน", "ส่งยอดผิดปกติให้หัวหน้าแอดมินชี้แจงพร้อมหลักฐาน", "ลงความเสียหายในชีตสรุป", "สรุปยอดความเสียหายรายเดือนส่งการเงิน/บุคคล"],steps:["รับไฟล์ประจำวัน: STM, รายงานฝาก-ถอน/BO, ไฟล์ชี้แจง", "ตรวจความครบถ้วน: ถูกบริษัท / ถูกบัญชี / ถูกวันที่ และ Copy ลง Excel ได้", "จัดเรียงข้อมูลใน Excel ให้เวลา/รายการเทียบกันได้", "เปรียบเทียบรายการและยอดรวม STM กับรายงาน", "ตรวจรายการผิดปกติ + หาสาเหตุยอดไม่ตรง", "ส่งกลับให้หัวหน้าแอดมิน/กะชี้แจงพร้อมหลักฐาน", "ลงความเสียหายในชีตสรุป + สรุปประจำเดือน (มี AI ช่วยวิเคราะห์ความเสี่ยง)"],tools:["Excel (เครื่องมือสำคัญที่สุด)", "Word (เอกสารประกอบ)", "PDF (รับ/อ่านหลักฐาน)", "E-mail (รับส่งไฟล์ตรวจสอบ/ชี้แจง)"],issues:["รายการ 23:00–23:59 ของ SCB/GSB อาจปนวันถัดไป → กลับมาตรวจในวันถัดไป", "STM ≠ รายงานฝาก → ค้นหายอดที่หาย / ตรวจเติมผิด / ระบบเบิ้ล / เติมย้อนหลัง", "เทสโอนเข้า-ออก / โยกเงิน / ซื้อเหรียญ → ต้องมีไฟล์ชี้แจง ไม่มีให้ตีกลับ", "อ่านไฟล์ชี้แจงไม่ละเอียด / ลืมลงชีต → หัวหน้าตรวจก่อนส่งการเงิน", "STM/BO ผิดบริษัทหรือไม่ครบ → ขอไฟล์ใหม่ก่อนดำเนินการ"],ai:["ช่วยค้นหายอดไม่ตรง เพิ่มความครอบคลุมการตรวจทุจริต", "วิเคราะห์โอกาส / ช่องโหว่การทุจริต", "วิเคราะห์ความเสี่ยงจากพฤติกรรมฝาก-ถอน", "สรุปความเสียหายรายเดือน/ไตรมาส/ปี พร้อม %", "⚠️ คนอนุมัติ: การสรุปความเสี่ยง ทุจริต และความเสียหาย"],scopeNote:"ใช้คู่มือส่วนกลางเดียว ตรวจทุกระบบตามทะเบียนงาน และระบุระบบ/บริษัทในรายละเอียดแต่ละรายการ"},

  {id:"SOP-BOM",dept:"BOM",title:"Workflow Back Office Management",v:"1.0",goal:"ติดตามภาพรวมหน้างาน ตรวจสอบข้อมูล จัดลำดับความสำคัญ มอบหมาย ตัดสินใจ/อนุมัติ และจัดทำรายงาน",duties:["ควบคุมภาพรวม: ดูแลทีม Admin / สรุปข้อมูล ตรวจคุณภาพ ติดตามข้อผิดพลาดซ้ำ", "ตรวจสอบ/ตัดสินใจ: เคสเกินขอบเขต Admin โดยเฉพาะเคสเสี่ยง/มีผลการเงิน", "วิเคราะห์: ลูกค้า การเงิน โปรโมชั่น ปัญหาหน้างาน ภาระงาน", "ประสานงาน: CRM, การเงิน, BC, IT, Marketing, QC, SC, ปกม.", "รายงาน + วางแผนกำลังคน + พัฒนาทีม (E-Learning)"],steps:["รับข้อมูล: จาก Telegram, รายงานปิดกะ, Google Sheets, เคสที่ส่งเข้ามา", "ตรวจความครบถ้วน: วัน/เวลา / เว็บ / ตัวเลข / หลักฐาน / สถานะ / ผู้รับผิดชอบ", "จัดลำดับความสำคัญ: P1 วิกฤต / P2 สูง / P3 ปกติ / P4 ติดตาม", "มอบหมาย/ประสานงาน: ระบุหัวข้อ / รายละเอียด / Owner / Deadline", "ติดตามความคืบหน้าตามรอบจนเสร็จหรือ Escalate", "ตรวจสอบผล: ยืนยันว่าแก้ไขจริง ข้อมูลถูกต้อง", "ตัดสินใจ/อนุมัติ: เคสเสี่ยง/ผลกระทบสูงพิจารณาร่วมทีมบริหาร", "สรุปและบันทึก: สถานะ/สาเหตุ/ผลกระทบ/วิธีแก้/Next action"],tools:["Telegram (รับปัญหา / ประสานงาน)", "Google Sheets (รายงาน / ล็อกสูตร)", "รายงานหลังบ้าน", "E-Learning, ไฟล์/หลักฐาน"],issues:["สูตร Google Sheets ผิด / คัดลอกยอดผิด → ตรวจสูตรก่อนใช้ตัวเลขรายงาน", "สรุปงานระหว่างกะตกหล่น → สรุปข้อมูลออกจากแชทเป็นระบบ", "ใช้ Priority ไม่เหมือนกัน → ยึดเกณฑ์ P1–P4 เดียวกัน", "ปิดเคสจากคำว่า “แก้แล้ว” โดยยังไม่ทดสอบจริง → ตรวจจริงก่อนปิด", "ข้อมูลสำคัญอยู่แต่ใน Telegram → ย้ายเข้าระบบที่ค้นย้อนหลังได้"],ai:["สรุปงานจาก Telegram + จัดลำดับความสำคัญ", "ดึง/สรุปข้อมูลหลังบ้านเป็น Dashboard กลาง", "ระบบมอบหมายงาน (Owner/Priority/Deadline/Acknowledge/Overdue)", "ตรวจจับความผิดปกติ + Incident Timeline", "⚠️ Human-in-the-loop: อนุมัติการเงิน ประเมินความเสี่ยง ตัดสินสาเหตุ ยืนยันการแก้ไข"]},
];

/* เอกสารกลาง / ระเบียบ */
const DOCS=[{id:'REG-01',title:'ระเบียบการประชุมติดตามผลการดำเนินงานประจำเดือน',en:'Monthly Performance Review Meeting Regulation',owner:'Executive / KPI / Secret',rev:'Rev.00',
 sections:[
  {h:'1. วัตถุประสงค์',items:['ให้ผู้บริหารติดตามผลการดำเนินงานของทุกหน่วยงานอย่างเป็นระบบและต่อเนื่อง','เปรียบเทียบผลจริงกับเป้าหมาย/KPI และระบุประเด็นที่ต้องเร่งแก้ไข','ให้ทุกมติและงานติดตามมีผู้รับผิดชอบ กำหนดเวลา และสถานะที่ชัดเจน','ให้การตัดสินใจของ Executive Board ใช้ข้อมูลชุดเดียวกันและตรวจสอบย้อนหลังได้']},
  {h:'2. ขอบเขตและหน่วยงานที่เข้าร่วม',items:['ใช้กับการประชุมติดตามประจำเดือนของทุกหน่วยงาน จัดลำดับตามโครงสร้าง 4 กลุ่ม: 01 Corporate & Governance / 02 Brand, Content & Marketing / 03 Technology & Customer / 04 Operations & Quality']},
  {h:'3. ความถี่และกำหนดการประชุม',items:['ประชุมอย่างน้อยเดือนละ 1 ครั้ง ภายใน 7 วันทำการแรกของเดือนถัดไป','แจ้งวัน/เวลา/สถานที่-ลิงก์ และ Agenda ล่วงหน้าอย่างน้อย 3 วันทำการ','ทุกหน่วยงานส่ง Monthly Report + KPI ก่อนประชุมอย่างน้อย 1 วันทำการ']},
  {h:'4. ผู้เข้าร่วมและหน้าที่',items:['ประธาน: Executive Board — กำหนดทิศทาง ตัดสินใจ อนุมัติ สั่งการ','ผู้รายงาน: Head/Manager แต่ละทีม — รายงาน KPI/ผลงาน/ปัญหา/Action Plan','KPI Team — รวบรวม/ตรวจสอบข้อมูล สรุป Target vs Actual','ผู้บันทึกการประชุมที่ได้รับมอบหมาย: Agenda, บันทึกมติ, Action List, ติดตาม Due Date']},
  {h:'5. ข้อมูลมาตรฐานที่ทุกฝ่ายต้องรายงาน',items:['KPI/Target ประจำเดือน และผล Actual','ผลงาน/Milestone ที่เสร็จในเดือน','งานค้างจากเดือนก่อนและสถานะล่าสุด','ปัญหา/ความเสี่ยง พร้อมสาเหตุและผลกระทบ','Corrective/Preventive Action','แผนงานและเป้าหมายเดือนถัดไป','เรื่องขอ Support/การตัดสินใจจาก Executive Board']},
  {h:'6. Agenda มาตรฐาน',items:['1) Previous Action','2) KPI Review','3) Performance','4) Problem / Issue','5) Corrective Action','6) Next Month Plan','7) Support Required','8) Management Decision','9) Action Items']},
  {h:'7. กติกาการนำเสนอ',items:['แต่ละทีม 10–15 นาที','เรื่องตามเป้ารายงานย่อ เน้นเวลากับ Yellow/Red หรือเรื่องที่ต้องตัดสินใจ','ข้อมูลต้องมีตัวเลข/หลักฐานรองรับ','ห้ามเล่ากิจกรรมย้อนหลังโดยไม่มีข้อสรุป/Action']},
  {h:'8. ระบบสถานะงาน',items:['Green = เป็นไปตามแผน','Yellow = มีความเสี่ยง ต้องมีแผนแก้ไข','Red = ไม่เป็นไปตามเป้า/เกินกำหนด ต้องระบุสาเหตุ + Owner + Due ใหม่','Completed = เสร็จสิ้น ปิดงานเมื่อมีหลักฐานยืนยัน']},
  {h:'9. การควบคุม Action Item',items:['ทุก Action ต้องมี: Action / Owner / Due Date / Status / Remark','Action ที่ยังไม่ Completed ต้องยกไปติดตามเป็นวาระแรกในเดือนถัดไป','Action ที่เกิน Due ต้องระบุสาเหตุ + กำหนด Due ใหม่ โดยไม่ลบประวัติเดิม','เปลี่ยน Owner/Due ที่มีผลต่อแผนหลัก ต้องได้รับความเห็นชอบจากผู้บังคับบัญชา/ประธาน']},
  {h:'10. การบันทึกและเผยแพร่มติ',items:['ผู้บันทึกการประชุมที่ได้รับมอบหมายจัดทำ Meeting Minutes + Action List ภายใน 1 วันทำการ','ผู้เข้าร่วมตรวจ/แจ้งแก้ไขภายใน 1 วันทำการ','เอกสารฉบับสุดท้ายเป็นข้อมูลอ้างอิงเดือนถัดไป']},
  {h:'11. การขาดประชุมและการมอบหมายแทน',items:['แจ้งผู้จัดประชุมหรือผู้บันทึกการประชุมล่วงหน้า + มอบผู้แทนที่มีข้อมูลเพียงพอ','ไม่ส่งรายงาน/ไม่เข้าประชุมโดยไม่มีผู้แทน บันทึกไว้ใน Minutes']},
  {h:'12. หลักการสรุปการประชุม',items:['ติดตามผล → ระบุปัญหา → ตัดสินใจ → มอบหมาย → ปิดงาน']},
  {h:'13. การอนุมัติใช้ระเบียบ',items:['จัดทำโดย ______ · ตรวจสอบโดย ______ · อนุมัติโดย Executive Board']},
 ]}];

const KB = [
  {id:'KB-08',dept:'ADMIN',title:'ลดเคสค้างจากสลิปไม่ชัด',problem:'ลูกค้าส่งสลิปโอนเงินไม่ชัด ทำให้เคสค้างข้ามวันจำนวนมาก',solution:'ตั้งข้อความอัตโนมัติขอสลิปใหม่ทันทีเมื่อระบบอ่านไม่ออก + เพิ่มตัวอย่างสลิปที่ถูกต้อง ลดเคสค้างลง ~60%',from:'T-1090',tags:['เคส','แชท','automation']},
  {id:'KB-05',dept:'GRAPHIC',title:'กันไฟล์ส่งออกผิดสเปกแต่ละช่องทาง',problem:'ไฟล์ Export ความละเอียด/ขนาดไม่ตรงข้อกำหนดของแต่ละแพลตฟอร์ม',solution:'สร้าง Export Preset ต่อช่องทาง (เว็บ/ไลน์/เทเลแกรม) เป็นเทมเพลตกลางใน Photoshop',from:'T-1030',tags:['ไฟล์','กราฟิก','มาตรฐาน']},
  {id:'KB-03',dept:'FIN',title:'ตรวจยอดกระทบไม่ตรงให้เร็วขึ้น',problem:'สรุปเดือนแล้วยอดกระแสเงินสดไม่ตรงกับ BO',solution:'ให้บอทดึงยอด BO เทียบกับ Google Sheet ทุกสิ้นวัน + ตั้ง flag รายการที่ต่างเกิน 1 บาทให้ตรวจทันที',from:'T-0990',tags:['การเงิน','กระทบยอด']},
  {id:'KB-01',dept:'CRM',title:'สคริปต์โทร Win-back ที่ได้ผล',problem:'ลูกค้าเงียบเกิน 14 วันไม่กลับมาเล่น',solution:'ใช้สคริปต์เปิดด้วยโปรฯ เฉพาะบุคคล + ถามเหตุผลที่หยุด บันทึกกลุ่มเหตุผล เพื่อให้การตลาดทำโปรฯ ตรงกลุ่ม',from:'T-0951',tags:['CRM','retention','สคริปต์']},
];

const ANN = [
  {id:'A1',who:'boss',pin:true,title:'เป้าหมายไตรมาส 3: ยกอัตรา Retention ทั้งบริษัทเป็น 50%',body:'ขอให้ทุกแผนกโฟกัสการรักษาฐานลูกค้า CRM นำทีม Win-back / การตลาดสนับสนุนโปรฯ ตรงกลุ่ม / กราฟิกเตรียมสื่อ',time:'วันนี้ 09:12',from:'08-01',until:'09-30',audience:'ทั้งบริษัท',acks:['a','b','c'],comments:[{who:'lead_mkt',text:'รับทราบครับ ทีมการตลาดจะเตรียมโปรฯ ตรงกลุ่มให้',time:'วันนี้ 09:40'}]},
  {id:'A2',who:'lead_crm',pin:false,title:'ปรับลิสต์โทรรอบเช้าเป็น 80 รายต่อคน',body:'เริ่มพรุ่งนี้ ใช้ลิสต์จากระบบอัตโนมัติ ดูใน บอร์ด CRM',time:'เมื่อวาน 17:40',from:'08-08',until:'',audience:'วีร์, ต้น, จู',audienceIds:['lead_crm','b','e'],acks:['b'],comments:[]},
  {id:'A3',who:'lead_gr',pin:false,title:'ใช้ Export Preset ใหม่ทุกงานส่งออก',body:'อ้างอิงบทความ KB-05 เพื่อกันไฟล์ผิดสเปก',time:'2 วันก่อน',from:'08-04',until:'08-06',audience:'พิมพ์, ฟ้า, เก่ง',audienceIds:['lead_gr','a','f'],acks:['lead_gr','a','f'],comments:[]},
];
let ANN_SEQ=3;

/* แผนผังองค์กร (Company Chart) — โครงสร้างใช้งานจริง 4 กลุ่ม / 14 แผนก */
const ORG=[
  {code:'01',title:'CORPORATE & GOVERNANCE',th:'บริหารและกำกับองค์กร',color:'#2158c8',teams:[
    {name:'Back Office Management',th:'บริหารงานหลังบ้าน · หัวหน้า / ผู้ช่วยหัวหน้า / พนักงาน',dept:'BOM'},
    {name:'การเงิน',th:'Finance · หัวหน้า / พนักงาน',dept:'FIN'},
    {name:'ทรัพยากรบุคคล (HR)',th:'Human Resources · หัวหน้า / ผู้ช่วย / พนักงาน',dept:'HR'},
    {name:'แผนก KPI',th:'KPI Management · หัวหน้า / พนักงาน',dept:'KPI'},
    {name:'Data provider (BC)',th:'งานบัญชีและข้อมูลหลังบ้าน · หัวหน้า / พนักงาน',dept:'BO'},
  ]},
  {code:'02',title:'BRAND, CONTENT & MARKETING',th:'คอนเทนต์และการตลาด',color:'#07835f',teams:[
    {name:'การตลาด',th:'Marketing · หัวหน้า / พนักงาน',dept:'MKT'},
    {name:'กราฟิก',th:'Graphic Production · หัวหน้า / พนักงาน · รายงานผลร่วมกับการตลาด',dept:'GRAPHIC'},
  ]},
  {code:'03',title:'TECHNOLOGY & CUSTOMER',th:'เทคโนโลยีและลูกค้าสัมพันธ์',color:'#c96c08',teams:[
    {name:'โปรแกรมเมอร์',th:'Programmer · หัวหน้า / พนักงาน',dept:'PROG'},
    {name:'ลูกค้าสัมพันธ์ (CRM)',th:'Customer Relationship Management · หัวหน้า / พนักงาน',dept:'CRM'},
    {name:'AI Automation',th:'พัฒนาระบบ AI และงานอัตโนมัติ · ผู้ดูแลระบบ',dept:'AIAUTO'},
  ]},
  {code:'04',title:'OPERATIONS & QUALITY',th:'ปฏิบัติการและคุณภาพ',color:'#7146ba',teams:[
    {name:'SC',th:'งานปฏิบัติการ SC · หัวหน้า / พนักงาน',dept:'SC'},
    {name:'แอดมิน',th:'Admin · บริหารแอดมิน / หัวหน้า / รองและผู้ช่วย / พนักงาน',dept:'ADMIN'},
    {name:'QC Chat',th:'ตรวจสอบคุณภาพแชต · หัวหน้า / พนักงาน',dept:'QC'},
    {name:'ออดิทระบบ (ส่วนกลาง)',th:'Central Audit · หน่วยงานส่วนกลางเดียว · หัวหน้า / พนักงาน',dept:'AUD123'},
  ]},
];
const FEED = [
  {u:'a',ic:'🎨',c:'#e7f2fd',t:'<b>ฟ้า</b> อัปเดต <b>T-1042</b> เป็น กำลังทำ',time:'5 น.ที่แล้ว'},
  {u:'d',ic:'⛔',c:'#fde7ea',t:'<b>โบ๊ท</b> ตั้งค่า <b>T-1066</b> เป็น ติดปัญหา (ยอดไม่ตรง 2 รายการ)',time:'22 น.ที่แล้ว'},
  {u:'lead_crm',ic:'✅',c:'#e6f7f1',t:'<b>วีร์</b> ปิดงาน <b>T-1090</b> + บันทึกลงคลังความรู้',time:'1 ชม.ที่แล้ว'},
  {u:'lead_mkt',ic:'📤',c:'#fff3e0',t:'<b>นัท</b> ส่ง <b>T-1058</b> รอตรวจ',time:'2 ชม.ที่แล้ว'},
  {u:'boss',ic:'📢',c:'#eef2ff',t:'<b>คุณธนกร</b> ประกาศเป้าหมายไตรมาส 3',time:'วันนี้ 09:12'},
];

/* ============================================================
   STATE + HELPERS
============================================================ */
let ROLE='lead', VIEW='dash', BOARD_DEPT='', AUTH_DB_ROLE='staff', ACCESS_PROFILE=null, VISIBLE_DEPTS=[], MANAGE_DEPTS=[];
const ROLE_META={
  staff:{u:'a',dept:'GRAPHIC',label:'พนักงาน — แผนกกราฟิก',home:'myTasks'},
  lead :{u:'lead_gr',dept:'GRAPHIC',label:'หัวหน้างาน — แผนกกราฟิก',home:'dash'},
  exec :{u:'boss',dept:null,label:'ผู้บริหาร',home:'dash'},
};
const NAV = {
  dash:{ic:'i-dash',t:'แดชบอร์ด'}, myTasks:{ic:'i-check',t:'งานของฉัน'}, board:{ic:'i-board',t:'บอร์ดงาน'},
  graphic:{ic:'i-grid',t:'Graphic Production'},
  timeline:{ic:'i-calendar',t:'ไทม์ไลน์'}, kpi:{ic:'i-target',t:'KPI แดชบอร์ด'}, reports:{ic:'i-report',t:'รายงานสรุป'}, monthly:{ic:'i-doc',t:'รายงานประจำเดือน'}, tracker:{ic:'i-clipboard',t:'Action Tracker'},
  org:{ic:'i-org',t:'แผนผังองค์กร'}, users:{ic:'i-users',t:'จัดการพนักงาน'}, sop:{ic:'i-book',t:'คลัง SOP / คู่มือ'}, kb:{ic:'i-bulb',t:'คลังความรู้'}, ann:{ic:'i-megaphone',t:'ประกาศ & อัปเดต'}, talk:{ic:'i-chat',t:'Talk to Data'}, problems:{ic:'i-warning',t:'ศูนย์ปัญหา'}, activity:{ic:'i-clipboard',t:'บันทึกกิจกรรม'},
};
/* helper: SVG line icon */
function sic(id){return `<svg class="svic"><use href="#${id}"></use></svg>`;}
// Filter state
let F={q:'',source:'',dept:'',status:'',prio:'',assignee:'',period:'',dateFrom:'',dateTo:'',reportFrom:'',reportTo:'',group:'dept',sort:'due',dir:1};
let GRAPHIC_JOBS=[],GRAPHIC_PROJECTS=[],GRAPHIC_FILES=[],GRAPHIC_CHECKS=[],GRAPHIC_PEOPLE=[],GRAPHIC_MEMBERS=[],GRAPHIC_JOB_MEMBERS=[],GRAPHIC_READY=false;
let TASK_PROFILES=[],TASKS_READY=false;
let ACCESS_USERS=[],ACCESS_USER_DEPTS=[],ACCESS_USERS_READY=false,ACCESS_USERS_LOADING=false,ACCESS_USER_Q='',ACCESS_USER_LEVEL='';
let IMPLEMENTATION_ACTIONS=[],IMPLEMENTATION_ACTIONS_READY=false,SOP_RECORDS=[];
let GF={tab:'board',project:'',status:'',q:'',person:'',dateFrom:'',dateTo:'',reportFrom:'',reportTo:'',freshness:'current'};
const GP_COLUMN_PAGE_SIZE=30;
let GP_VISIBLE_LIMITS={};
let REPORT_EDITS={};      // แก้ไขข้อความรายงาน (persisted)
let CARRIED=[];           // taskId ที่ยกไปเดือนถัดไป (persisted)
let TRACK_MONTH='09', TRACK_GROUP='', TRACK_DEPT='', TRACK_LEVEL='';  // ตัวกรอง Action Tracker
let REP_MONTH='08', REP_GROUP='', REP_DEPT='';  // ตัวกรองรายงานประจำเดือน

const nf=n=>Number(n).toLocaleString('th-TH');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ORG_TIMEZONE='Asia/Bangkok';
function sourceBadge(kind,label,detail=''){return `<div class="source-row"><span class="source-badge ${kind}">● ${esc(label)}</span>${detail?`<span class="source-note">${esc(detail)}</span>`:''}</div>`;}
function isExecutiveRole(){return ['exec','admin'].includes(AUTH_DB_ROLE);}
function currentDept(){return ACCESS_PROFILE?.department_code||ROLE_META[ROLE]?.dept||'';}
function visibleDepartmentCodes(){
  if(isExecutiveRole())return DEPTS.map(d=>d.code);
  return [...new Set([currentDept(),...VISIBLE_DEPTS].filter(Boolean))];
}
function canViewDept(code){return !!ACCESS_PROFILE&&(isExecutiveRole()||visibleDepartmentCodes().includes(code));}
function canAdminAccess(){return ['exec','admin'].includes(AUTH_DB_ROLE);}
/* เทมเพลตวันที่ไทย: รองรับทั้ง YYYY-MM-DD และ MM-DD (ปีปัจจุบัน) */
const THMON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THDAY=['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
function fmtDate(mmdd,withYear){
  if(!mmdd)return '-';const p=String(mmdd).split('-').map(Number),full=p.length===3;
  const y=full?p[0]:Number(TODAY_ISO?.slice(0,4)||new Date().getFullYear()),m=full?p[1]:p[0],d=full?p[2]:p[1],dt=new Date(y,m-1,d);
  return THDAY[dt.getDay()]+' '+d+' '+THMON[m-1]+(withYear?' '+String(y+543).slice(-2):'');
}
const normSp=s=>(s||'').replace(/\s+/g,' ').trim();
/* ระยะเวลาดำเนินการ (SLA) */
const DFROM=s=>{const p=String(s||'').split('-').map(Number),y=Number(TODAY_ISO?.slice(0,4)||new Date().getFullYear());return p.length===3?new Date(p[0],p[1]-1,p[2]):new Date(y,p[0]-1,p[1]);};
const dateISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addFrom=(s,n)=>{const d=DFROM(s);d.setDate(d.getDate()+n);return dateISO(d);};
const slaUnitTxt=un=>un==='hr'?'ชม.':'วัน';
const slaOf=t=>t.sla||{n:Math.max(1,Math.round((DFROM(t.due)-DFROM(t.start))/86400000)),unit:'day'};
const slaText=t=>{const s=slaOf(t);return s.n+' '+slaUnitTxt(s.unit);};
const slaOverdue=t=>{if(t.status==='done')return false;const s=slaOf(t);if(s.unit!=='day')return false;return addFrom(t.start,s.n)<TODAY_ISO;};
function bangkokTodayISO(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ORG_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(p=>p.type===t)?.value;return `${get('year')}-${get('month')}-${get('day')}`;}
const TODAY_ISO=bangkokTodayISO(),TODAY_MMDD=TODAY_ISO.slice(5);
function annStatus(a){const from=d2(a.from),until=d2(a.until);if(until&&until<TODAY_ISO)return{t:'หมดอายุ',c:'var(--gray)'};if(from&&from>TODAY_ISO)return{t:'ยังไม่เริ่ม',c:'var(--amber)'};return{t:'กำลังใช้',c:'var(--green)'};}
function av(id,cls='mini'){const x=u(id);return `<span class="${cls}" style="background:${x.c}">${x.s}</span>`;}
const statusPill=s=>`<span class="pill" style="background:${STATUS[s].c}">${STATUS[s].t}</span>`;
const prioPill=p=>`<span class="pill" style="background:${PRIO[p].c}">${PRIO[p].t}</span>`;
const deptPill=c=>`<span class="pill" style="background:${deptColor(c)}">${deptName(c)}</span>`;
const shortName=id=>u(id).n.split(' (')[0];

