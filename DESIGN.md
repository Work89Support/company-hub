# Company Hub Design System

เอกสารนี้เป็นเกณฑ์กลางสำหรับหน้าใหม่และการปรับหน้าเดิม เพื่อให้ทั้งระบบใช้ภาษาภาพเดียวกัน

## Foundations

- Font: `Kanit`, fallback `system-ui, sans-serif`
- Type scale: 10, 12, 14, 16, 20, 24, 30 px; ข้อความที่ต้องอ่านห้ามต่ำกว่า 12 px
- Spacing: 4, 8, 12, 16, 24, 32 px
- Radius: 6 px (`sm`), 10 px (`md`), 14 px (`lg`), 20 px (`xl`), 999 px (`pill`)
- Touch target: อย่างน้อย 44×44 px สำหรับ action หลักบนมือถือ
- Focus: outline 3 px ที่มี contrast ชัด ห้ามถอดออกโดยไม่มีสิ่งทดแทน
- Contrast: ข้อความปกติอย่างน้อย 4.5:1; ข้อความใหญ่และขอบ UI อย่างน้อย 3:1

## Semantic colors

ใช้ CSS variables แทนการใส่สีลง component โดยตรง: `--primary`, `--ink`, `--text-secondary`, `--text-tertiary`, `--surface`, `--bg`, `--line`, `--green`, `--amber`, `--red` และ `--blue-*` ใช้กับ brand เท่านั้น

## Components

- Button: `.tbtn`; ใช้ `.primary` ได้ไม่เกินหนึ่งปุ่มต่อพื้นที่งาน; async action ต้องมี disabled, `aria-busy` และข้อความ “กำลัง…”
- Input: `.fin`; label อยู่เหนือช่องเสมอ; error อยู่ใกล้ช่องและผูกด้วย `aria-describedby`
- Card: `.card`; ใช้รัศมี `lg`; หลีกเลี่ยง card ซ้อน card เกินสองชั้น
- Tab/segment: ต้องมี `aria-pressed` หรือ tab semantics และแสดง active ด้วยสีพร้อมขอบ
- Status: `.ux-status`; ใช้เฉพาะ `doing`, `done`, `review`, `block`; ห้ามใช้สีเพียงอย่างเดียวเพื่อสื่อความหมาย
- Modal: `role="dialog"`, `aria-modal="true"`, มีชื่อ, กัก focus, Escape ปิดได้เมื่อไม่ใช่ขั้นตอนบังคับ และคืน focus เมื่อปิด

## Page patterns

- หัวหน้ามี title, คำอธิบายสั้น และ primary action เดียว
- แสดง summary ไม่เกิน 4 รายการก่อนรายละเอียด
- Filter ที่ใช้บ่อยแสดงก่อน; filter ขั้นสูงอยู่ใน disclosure
- Kanban บนมือถือเลื่อนทีละคอลัมน์; ตารางกว้างต้องอยู่ใน scroll container ไม่ทำให้ทั้งหน้าล้น
- Empty/error/loading ต้องบอกสถานะ ผลกระทบ และสิ่งที่ทำต่อได้ โดยไม่แสดง stack trace, migration หรือรายละเอียดภายใน

## Release visual checks

ตรวจ Login, Dashboard, Team Board, Graphic, Activity, Issue, KPI, Announcement และ Form wizard ที่ desktop/mobile, light/dark, keyboard-only และ text zoom 200% ก่อนทุก release
