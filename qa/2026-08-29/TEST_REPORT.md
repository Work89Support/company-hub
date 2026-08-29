# รายงานผลทดสอบ Company Hub

วันที่ทดสอบ: 29 สิงหาคม 2026  
สภาพแวดล้อม: Production — GitHub Pages  
URL: https://work89support.github.io/company-hub/prototype/index.html?cutover=f42cb3e-2  
เวอร์ชัน: `f42cb3e`  
บัญชีทดสอบ: `work.ltd89@gmail.com` — ผู้ดูแลระบบ  
ผลรวม: **ผ่านแบบมีเงื่อนไข (PASS WITH CONDITIONS)**

## 1. ขอบเขตการทดสอบ

ทดสอบหน้าใช้งานหลักครบ 16/16 หน้า ได้แก่ Dashboard, Board, Graphic Production, Timeline, Problems, Daily Activity, KPI, Executive Report, Monthly Report, Action Tracker, Organization Chart, SOP, Knowledge Base, Announcements, Talk to Data และ Access Control รวมถึง Desktop 1440×900 และ Mobile 390×844

การทดสอบเป็นแบบไม่แก้ไขข้อมูล Production: ทดสอบการเปิดหน้า, ค้นหา, กรอง, เปิดรายละเอียด, validation, export, popup, responsive และการแสดงข้อมูล แต่ไม่กดบันทึก/ลบ/เปลี่ยนสิทธิ์/ยกงานค้าง/นำเข้าไฟล์จริง

## 2. ยอดจริงที่ตรวจพบ

| ชุดข้อมูล | ยอดที่ระบบแสดง | ผลตรวจ |
|---|---:|---|
| กิจกรรมประจำวัน | 2,341 รายการ | ผ่าน — ตรงกับข้อมูลนำเข้า |
| พนักงานในกิจกรรม | 93 คน | ผ่าน |
| ชั่วโมงรวม | 5,669.2 ชั่วโมง | ผ่าน |
| กิจกรรมสถานะเสร็จ | 2,106 รายการ | ผ่าน |
| เวลาไม่ครบ | 143 รายการ | มีข้อมูลจริง แต่ไม่รวมใน KPI “ต้องตรวจเวลา” |
| ข้ามวัน | 123 รายการ | ผ่าน |
| เวลาน่าสงสัย | 3 รายการ | ผ่าน — ตัวกรองได้ 3 แถว |
| งดนับทั้งวัน | 35 รายการ | ผ่าน |
| ต้องตรวจเวลาทั้งหมดตามความหมายทางธุรกิจ | **304 รายการ** | ควรเป็น 143 + 123 + 3 + 35 |
| ปัญหาหน้างาน Admin | 110 เคส | ผ่าน |
| ปัญหา Open / Resolved | 18 / 92 | ผ่าน — อัตราแก้ไข 84% |
| ปัญหา Critical + High | 46 เคส | ผ่าน |
| ปัญหาที่มีแนวทางแก้แล้ว | 48 เคส | ผ่าน |
| ปัญหาที่ยังไม่มีแนวทางแก้ | 62 เคส | ต้องเร่งเติมข้อมูล |
| งาน Graphic | 1,806 งาน | ผ่าน — โหลดครบ |
| Trello projects | 9 โครงการ | ผ่าน |
| งาน Graphic Active / Review / Overdue | 74 / 31 / 5 | ผ่านตามข้อมูลที่นำเข้า |
| ผู้ใช้ใน Access Control | 1 บัญชี | ผ่านตามฐานปัจจุบัน แต่ยังทดสอบ RBAC จริงหลายบทบาทไม่ได้ |

ยอด Dashboard องค์กรที่แสดงเป็น KPI 97/100, งาน 14, เสร็จ 3, ติดปัญหา 1 และเกินกำหนด 11 เป็นชุดข้อมูล Workspace/ตัวอย่าง ไม่ใช่ยอดเดียวกับข้อมูลกิจกรรม 2,341 รายการหรือ Graphic 1,806 งาน จึงควรติดป้ายแหล่งข้อมูลให้ชัดเจน

## 3. ผลทดสอบรายฟังก์ชัน

| โมดูล | สิ่งที่ทดสอบ | ผล |
|---|---|---|
| Dashboard | KPI, cards, quick navigation, responsive | ผ่าน |
| Board | แสดง 14 งาน, ค้นหา `3XBET`, กรอง ADMIN ได้ 2 งาน, Export CSV, เปิดฟอร์มสร้างงาน | ผ่าน |
| Graphic Production | Overview, Monthly, Projects, Kanban, ค้นหา `ริชเมนู` ได้ 104 งาน, เปิดรายละเอียด, validation ฟอร์ม, Trello import modal | ผ่านแบบมีข้อควรปรับปรุงด้านประสิทธิภาพ/คุณภาพข้อมูล |
| Timeline | เปิดหน้าและแสดงข้อมูล | ผ่าน |
| Problems | KPI, ตาราง 110 เคส, Open 18, ค้นหา `12PAY` ได้ 7 เคสภายใต้ตัวกรอง Open, เปิดรายละเอียด Root cause/Solution/Prevention | ผ่าน |
| Daily Activity | KPI, แสดง 1,000 จาก 2,341, ตัวกรองเวลาน่าสงสัย 3, ค้นหา `G AUDIT` ได้ 58 | ผ่านแบบมีข้อผิดพลาดด้านนิยาม KPI |
| KPI | เปิดหน้าและแสดงข้อมูล | ผ่าน |
| Executive Report | ช่วงเวลา, ปุ่ม PDF/Excel, Auto-send | แสดงผลผ่าน; Auto-send ยังเป็นสาธิต |
| Monthly Report | Word export, CSV 43 บรรทัด, ส่งเข้าประชุม | Export ผ่าน; ส่งเข้าประชุมยังเป็นสาธิต |
| Action Tracker | 14 แถว, Red 11, Completed 3, Excel export 14 บรรทัด | ผ่าน |
| Organization Chart | เปิดหน้าและแสดงโครงสร้าง | ผ่าน |
| SOP | 15 เอกสาร, เปิดรายละเอียดเอกสาร | ผ่าน |
| Knowledge Base | 4 บทความ, เปิดรายละเอียด | ผ่าน |
| Announcements | 3 ประกาศ, feed, เปิดรายละเอียด, ack/reply counts, เปิดฟอร์มใหม่ | ผ่านแบบมีปัญหาการผูกผู้รับกับบัญชีจริง |
| Talk to Data | popup ทุกหน้า, ถามยอดกิจกรรม ได้ 2,341 รายการ/93 คน/5,669.2 ชม. | ผ่านตามกฎที่เขียนไว้ |
| Access Control | โหลดผู้ใช้, เปิด modal กำหนด role/แผนก/visibility | UI ผ่าน; ยังไม่ผ่านการพิสูจน์ RLS หลายบัญชี |
| Mobile | hamburger menu, นำทาง Dashboard, layout 390×844 | ผ่าน |

ไม่พบหน้าแครชหรือ JavaScript error ที่ทำให้หยุดใช้งานระหว่างชุดทดสอบ

## 4. จุดที่พบและควรปรับปรุง

### P1 — ควรแก้ก่อนใช้เป็นข้อมูลตัดสินใจเต็มรูปแบบ

1. **KPI “ต้องตรวจเวลา” แสดง 161 แต่เคสที่ต้องตรวจจริงมี 304**  
   ตัวเลข 161 นับเฉพาะข้ามวัน 123 + น่าสงสัย 3 + งดนับ 35 และตัดเวลาไม่ครบ 143 ออก ควรเปลี่ยน KPI เป็น 304 หรือแยกการ์ด “เวลาไม่ครบ” 143 ให้ชัดเจน

2. **ยังพิสูจน์สิทธิ์จริงหลายบทบาทไม่ได้**  
   ฐานปัจจุบันมี profile จริงเพียงบัญชี admin 1 บัญชี จึงยังยืนยันไม่ได้ว่า Staff เห็นเฉพาะตนเอง, Lead เห็นเฉพาะแผนก และ Executive เห็นทั้งองค์กรตาม RLS จริง จำเป็นต้องมีบัญชีทดสอบอย่างน้อย 4 บัญชีและทำ permission matrix

3. **Graphic Kanban render 1,806 cards พร้อมกัน**  
   ใช้งานได้ แต่ DOM ใหญ่มากและจะช้าลงเมื่อข้อมูลโต ควรใช้ pagination/virtual scrolling และโหลดค่าเริ่มต้นเฉพาะ Active/Review

### P2 — ควรแก้ในรอบถัดไป

4. **ข้อมูลจริงกับข้อมูลตัวอย่างปะปนกัน**  
   Daily Activity, Problems และ Graphic เป็นข้อมูลฐานจริง แต่ Task/KPI/Announcement/KB บางส่วนเป็น workspace seed ควรติด badge “Live”, “Imported”, “Demo” และวันเวลาที่ sync ล่าสุดบนทุก KPI

5. **62 จาก 110 ปัญหายังไม่มี Solution**  
   Dashboard ปัญหาทำงานได้ แต่ยังสร้างคู่มือปฏิบัติงานแบบครบวงจรไม่ได้ ควรบังคับ Owner, Root cause, Corrective action, Preventive action และอนุมัติก่อนเปลี่ยนเป็น Resolved/SOP-ready

6. **Auto-send report และ “ส่งเข้าประชุม” ยังเป็นสาธิต**  
   ปุ่มแสดง toast สำเร็จ แต่ยังไม่มี backend ส่ง Email/Telegram/Calendar จริง ต้องทำ Edge Function/cron, delivery log และ retry

7. **Talk to Data ยังเป็น rule-based บน client**  
   ตอบคำถามที่เตรียมไว้ได้และยอดกิจกรรมตรง แต่ยังไม่ใช่ semantic query แบบ production ควรย้ายไป Edge Function พร้อม JWT/RLS, จำกัดข้อมูลตามสิทธิ์ และมี audit log

8. **คุณภาพข้อมูล Graphic ยังไม่ครบ**  
   หลายงานไม่มี due date/assignee และ revision count เป็น 0 ทำให้ KPI “เสร็จเดือนนี้” และ revision อาจไม่สะท้อน Trello จริง ควรกำหนด mapping และ validation ก่อน import

9. **ผู้รับประกาศไม่ผูกกับบัญชี authenticated จริง**  
   admin เปิดประกาศทั้งบริษัทแล้วระบบแจ้งว่าไม่อยู่ในรายชื่อผู้รับ สะท้อนว่า user ID ของ seed announcement ไม่ตรง profile จริง ต้อง map ผู้รับด้วย profile UUID/department/role

### P3 — คุณภาพและการเข้าถึง

10. Daily Activity วาดตาราง 1,000 แถวพร้อมกัน ควรใช้ server-side pagination/virtualization
11. หน้า Monthly Report ไม่มี `<h1>` ควรเพิ่มเพื่อ accessibility และ screen reader
12. PDF ใช้ native print dialog จึงควรมี manual UAT เพิ่มเพื่อยืนยันชื่อไฟล์, page break และภาษาไทยใน PDF จริง
13. Access Control โหลดประมาณ 3 วินาที ควรมี skeleton, timeout และข้อความ retry ที่ชัดเจน

## 5. สิ่งที่ยังไม่ได้ทดสอบเพื่อป้องกันข้อมูล Production

- การสร้าง/แก้ไข/ลบงานจริง
- การบันทึกสิทธิ์จริงและทดสอบ RLS ข้ามบัญชี
- การ acknowledge/reply/post ประกาศจริง
- การยกงานค้างไปเดือนใหม่
- การอัปโหลด/นำเข้า Trello JSON รอบใหม่
- microphone permission
- การ sign out/reset demo data
- ไฟล์ PDF หลังผู้ใช้ยืนยัน native print dialog

## 6. ข้อเสนอเกณฑ์ก่อน Go-live

1. แก้ KPI เวลาต้องตรวจให้ตรง 304 หรือแยก 143 รายการเวลาไม่ครบ
2. สร้างบัญชีทดสอบ Staff/Lead/Executive/Admin และให้ permission matrix ผ่านทั้งหมด
3. แยก badge แหล่งข้อมูล Live/Imported/Demo พร้อม `last_synced_at`
4. เปลี่ยน Graphic และ Activity เป็น pagination/virtualization
5. ทำ Auto-send/Talk to Data ผ่าน backend และเก็บ audit log
6. เติม Solution/CAPA ให้ปัญหา High/Critical ก่อน แล้วจึงสร้าง SOP

## 7. หลักฐานภาพ

- `01-executive-dashboard.jpg` — Dashboard ผู้บริหาร
- `02-graphic-production.jpg` — Graphic Production จากข้อมูลนำเข้า
- `03-operational-issues-dashboard.jpg` — Dashboard ปัญหาหน้างาน
- `04-daily-activity-dashboard.jpg` — Daily Activity 2,341 รายการ
- `05-talk-to-data-popup.jpg` — Popup Talk to Data พร้อมยอดจริง
- `06-access-control.jpg` — Access Control
- `07-mobile-announcements.jpg` — ประกาศบนมือถือ
- `08-mobile-dashboard.jpg` — Dashboard บนมือถือ

