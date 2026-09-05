# การใช้งานตามแผนก

## ทางเข้าที่ชัดเจน

หน้าแรกและหน้างานของฉันมีปุ่มเริ่มงานตามแผนกหลักของบัญชี

- แอดมิน: แจ้งปัญหา → ทะเบียนปัญหา → ข้อมูลที่ต้องเติม
- กราฟิก: บอร์ดงาน → เพิ่มการ์ด/รับบรีฟ → ข้อมูลที่ต้องเติม
- แผนกอื่น: บันทึกกิจกรรมของแผนก → งานที่ได้รับมอบหมาย → ข้อมูลที่ต้องเติม

โหมดง่ายยังมีทางเข้ากิจกรรมและปัญหาตามสิทธิ์เดิม ไม่ต้องเปลี่ยนไปโหมดครบเพื่อทำงานประจำ

## กราฟิก

เปิดบอร์ดการ์ดก่อนภาพรวม ใช้คำจากบอร์ด Trello ที่อ่านมา: งานใหม่ (ยังไม่เริ่มทำ), งานที่กำลังทำ, ส่งงาน (ตรวจสอบ), ดำเนินการแล้ว, งานรายเดือน, งานการตลาด, กำลังแก้ไข

ใช้รหัสสถานะเดิมในฐานข้อมูล จึงยังลากข้ามคอลัมน์และใช้ปุ่มเปลี่ยนสถานะในรายละเอียดได้ตามสิทธิ์เดิม การ์ดแสดงภาพปก สมาชิก กำหนดส่ง จำนวนไฟล์แนบ และ Checklist; เปิดการ์ดด้วย Enter หรือ Space ได้

คอลัมน์เลื่อนแนวนอน หน้าสรุปอยู่ในแท็บภาพรวมแยกจากบอร์ด การย้ายสถานะใน Company Hub ไม่ใช่การเขียนกลับไปยัง Trello และยังไม่รองรับการสร้างคอลัมน์อิสระหรือเรียงการ์ดเองภายในคอลัมน์

## ปัญหาแอดมิน

อ้างอิงชีต [Issues — Problem Management V2](https://docs.google.com/spreadsheets/d/1PWEXVMg-bg-xOBNfAvvrjPl5K6F4Eqvp2B894-1dTI4/edit?gid=1965019074#gid=1965019074) และรายการตัวเลือกในแท็บ Settings/Projects ที่อ่านผ่าน connector เมื่อ 5 กันยายน 2026

หน้าแรกเป็นทะเบียนเรียงคอลัมน์ตามชีต: รหัสเคส วันที่ เวลา โปรเจกต์ ประเภท ปัญหา ความสำคัญ ผู้แจ้ง สถานะ ทีมรับผิดชอบ วิธีแก้ สร้างเมื่อ แก้ไขเมื่อ ปิดเมื่อ และนาทีที่ใช้แก้

- ค้นหาและกรองวันที่ โปรเจกต์ สถานะ ประเภท ความสำคัญ และทีมรับผิดชอบ
- แสดงครั้งละ 50 รายการ ตรึงหัวตารางและรหัสเคส เลื่อนแนวนอนได้
- กดรหัสเคสเพื่อเปิดกระบวนการติดตาม/แก้ไขเดิม
- ฟอร์มใหม่แสดงข้อมูลจำเป็นก่อนข้อมูลเสริม และเลือก Owner ได้ตาม Settings: Admin, IT, Payment, Support, Developer, Marketing, Other
- ระบบเสนอทีมตามประเภท แต่ไม่เปลี่ยนทับเมื่อผู้ใช้เลือกทีมเองแล้ว
- ข้อมูลผลกระทบที่บังคับกรอกอยู่ด้านนอกส่วนพับเก็บ การปิดเคสยังใช้การยืนยันของหัวหน้าตามเดิม
- สรุปและกราฟเดิมยังเปิดได้ในแท็บสรุปและวิเคราะห์

## การตรวจสอบและสถานะ

ทดสอบ DOM: เมนูแยกแผนก ตาราง 15 คอลัมน์ การแบ่งหน้า การกรอง การเปิดเคส การแสดงข้อความจากต้นทางอย่างปลอดภัย การเลือกทีม และข้อมูลจำเป็นที่ไม่ถูกพับซ่อน ผ่านทั้งหมด รวมกับ regression เดิมและชุดทดสอบ native entry/KPI

โค้ดยังอยู่ใน workspace ยังไม่ได้เผยแพร่ Production ชุดนำเข้าข้อมูลและ migration ก่อนหน้ายังรอการอนุมัติที่ automatic approval review ขอไว้ ไม่มีการแก้ Google Sheets ต้นฉบับหรือส่งข้อความให้ทีม

รันทดสอบ DOM ด้วย `DOM_MODULE` ชี้ไปยัง `happy-dom/lib/index.js` แล้วเรียก `node scripts/check-department-workflows.mjs`

## Team board and account preparation (2026-09-05)

Added `prototype/team-board.js` and CSS, loaded after department workflows. Other departments' start panel now opens the team board. Users can select department, person/account and status/person grouping, search and open original work forms. It only consumes work returned by the existing RLS-scoped loaders. Activity refresh also refreshes this view. Each group initially displays 30 cards.

Profile UUIDs distinguish linked users. Legacy names remain separated by exact name and department; no automatic fuzzy identity merge. Linked profiles display the current profile name. Issue owner teams are explicitly labeled as teams. Trello multi-assignee cards can appear in multiple columns but the work total is unique. This adds a view, not a new permission grant or drag-to-reassign operation.

`scripts/prepare_team_accounts.py` generated ignored review manifests at `data/import/2026-09-05/team-account-candidates.{csv,json}` from existing activity and Trello data: 111 candidates, 9 flagged for identity review. These are NOT provisioned accounts; no credentials have been generated. Names such as ทุกคน, HR and combined names require a real owner. Similar spellings are flagged rather than silently merged. Departments with no names do not receive invented users.

Account provisioning, initial credentials, password reset and editable account-name functionality remain pending. Existing authentication requires email; a question was sent asking whether new accounts should use name/department without email or employee emails. Do not fabricate employee email addresses or create shared human accounts. Keep access role and department independent from editable display names; passwords must never be exported to the repository. A username-based flow needs server-side provisioning, first-login enforcement, authenticated/admin reset authorization and corresponding permission tests before live creation.

Validation: `check-team-board.mjs` passes identity separation, renamed profile display, revoked department selection, source routing, multi-assignee counting, pagination and source HTML escaping. Existing 57 prototype checks plus native entry, KPI UI and department workflow checks also pass. New UI remains local and has not been deployed.

2026-09-05 follow-up: ผู้ใช้ยืนยันใช้ชื่อ (แผนก) ไม่ใช้อีเมลบังคับ และเพิ่มอีเมลภายหลังได้ โค้ด account provisioning/reset/rename/contact email เตรียมแล้วตาม `USERNAME_ACCOUNTS.md` แทนข้อ pending login method ด้านบน การ deploy และสร้างบัญชีจริงยังค้าง
