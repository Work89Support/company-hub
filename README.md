# Company Hub — ระบบศูนย์รวมงานองค์กร (Prototype)

ระบบแท็กงาน / มอบหมายงาน / ศูนย์รวมความรู้ / วัดผล KPI / คู่มือ SOP สำหรับองค์กร
ธีมน้ำเงิน-ขาว · ฟอนต์ Kanit · รูปแบบอ้างอิง Monday.com

> **สถานะ:** Operational prototype — ล็อกอินและข้อมูล Task/SOP/Knowledge/KPI/Operational Issues
> ใช้ตาราง Supabase แยกตามแผนกแล้ว ส่วน UI และข้อมูลบุคลากรเดิมยังอยู่ในช่วง
> เปลี่ยนผ่านก่อนพัฒนาเป็นระบบเต็มรูปแบบ

> **Security update (18 Aug 2026):** หน้าต้นแบบรับ role จาก Supabase metadata,
> ป้องกันข้อความ XSS, ใช้วันที่จริงตามเวลาไทย, รองรับมือถือ และมี
> optimistic locking. ก่อนใช้งานจริงให้ทำตาม `docs/05-security-and-deployment.md`.

## วิธีเปิดดู
เปิดไฟล์ `prototype/index.html` ด้วยเบราว์เซอร์ได้เลย (ดับเบิลคลิก) — ไม่ต้องติดตั้งอะไร

ใน VS Code แนะนำติดตั้งส่วนขยาย **Live Server** แล้วคลิก "Go Live" เพื่อดูแบบ auto-reload

## สิ่งที่ลองได้ใน Prototype
- **สลับมุมมอง** ที่มุมขวาบน: 👤 พนักงาน / 🧑‍💼 หัวหน้างาน / 👔 ผู้บริหาร — เมนูและแดชบอร์ดจะเปลี่ยนตามระดับ
- คลิกงานในบอร์ด → ดูรายละเอียด, งานย่อย/มอบต่อ, SOP ที่ผูก, ช่องบันทึกวิธีแก้
- **KPI แดชบอร์ด** รายแผนก · **คลัง SOP** · **คลังความรู้** (สร้างจากการปิดงาน)
- **Talk to Data AI** — ถามภาษาธรรมชาติจากทุกหน้า วิเคราะห์ข้อมูลจริงตามสิทธิ์
  สนทนาต่อเนื่อง สรุปความเสี่ยง และเสนอแนวทางดำเนินการ โดยมีคำตอบแบบกฎเป็นระบบสำรอง
- **ศูนย์ปัญหาหน้างาน Admin** — แจ้งเคส ติดตามสถานะ/ผู้รับผิดชอบ/วิธีแก้
  วิเคราะห์สาเหตุ/แนวทางแก้/การเกิดซ้ำ และสร้างร่าง SOP ส่งตรวจได้ โดยเห็นข้อมูล
  ตามสิทธิ์แผนกและ RLS ใน Supabase
- **✨ สร้างงาน (AI)** — สาธิต AI จัดรูปงานให้อ่านง่าย

## โครงสร้างโปรเจกต์
```
company-hub/
├─ README.md
├─ prototype/
│  └─ index.html         ← ตัวอย่างระบบคลิกได้ (self-contained)
├─ docs/
│  ├─ 01-ออกแบบระบบ.md      ← สถาปัตยกรรม, โมดูล, ระดับผู้ใช้, data model
│  ├─ 02-flow-การทำงาน.md   ← Flow + ไดอะแกรม (Mermaid)
│  ├─ 03-kpi-sop.md        ← KPI และ SOP รายแผนก (จากไฟล์จริง)
│  └─ 04-แผนงาน-roadmap.md  ← แผนพัฒนาเป็นระบบจริง
└─ data/
   └─ seed.json           ← ข้อมูลตัวอย่าง (แผนก/งาน/KPI/SOP)
```

## ขั้นตอนถัดไป (ขึ้น GitHub Desktop)
1. เปิด GitHub Desktop → **File → Add Local Repository** → เลือกโฟลเดอร์ `company-hub`
   (ถ้ายังไม่เป็น repo กด **Create a Repository** ที่โฟลเดอร์นี้)
2. ใส่ commit แรก เช่น `feat: prototype + design docs` → **Commit to main**
3. **Publish repository** ขึ้น GitHub (ตั้งเป็น Private ได้)
4. รีวิวร่วมกัน → เริ่มพัฒนา Next.js ตาม `docs/04-แผนงาน-roadmap.md`

## เทคโนโลยีที่วางแผนใช้ตอนสร้างจริง
Next.js (App Router) + TypeScript + Tailwind CSS + Prisma/PostgreSQL + RBAC + AI (RAG จากฐานข้อมูลภายใน)
รายละเอียดใน `docs/01-ออกแบบระบบ.md`

---

## 🚀 เปิดใช้งานผ่านลิงก์ (GitHub Pages)

repo นี้ถูกจัดโครงสร้างให้พร้อมขึ้น **GitHub Pages** แล้ว — เมื่อ Publish ทุกคนในทีมกดลิงก์เข้าใช้ระบบได้ทันที (ไม่ต้องดาวน์โหลดไฟล์)

> ผมได้ทำ `git init` + commit แรกให้เรียบร้อยแล้ว เหลือแค่ **Publish** และ **เปิด Pages** ซึ่งเป็นขั้นที่ต้องใช้บัญชี GitHub ของคุณเอง

### ขั้นที่ 1 — Publish ขึ้น GitHub (ผ่าน GitHub Desktop)
1. เปิด **GitHub Desktop** → **File → Add Local Repository** → เลือกโฟลเดอร์ `company-hub` นี้
   (repo พร้อมแล้ว จะเห็น commit แรกทันที ไม่ต้อง init เอง)
2. กด **Publish repository** (มุมขวาบน) → ตั้งชื่อ เช่น `company-hub`
   - ถ้าอยากให้เข้าถึงผ่านลิงก์สาธารณะ ให้ **เอาเครื่องหมายถูก "Keep this code private" ออก**
     (ถ้าติ๊กเป็น Private ลิงก์ Pages จะเปิดได้เฉพาะแบบ Enterprise เท่านั้น)
3. กด **Publish Repository**

### ขั้นที่ 2 — เปิด GitHub Pages
1. ไปที่หน้า repo บนเว็บ GitHub → **Settings** → เมนูซ้าย **Pages**
2. หัวข้อ **Build and deployment** → **Source: Deploy from a branch**
3. **Branch:** เลือก `main` → **Folder:** `/ (root)` → กด **Save**
4. รอสักครู่ (~1 นาที) รีเฟรชหน้า จะได้ลิงก์รูปแบบ:

   ```
   https://<ชื่อผู้ใช้ GitHub>.github.io/company-hub/
   ```

   เปิดลิงก์นี้ = เข้าระบบ Company Hub ได้เลย (หน้า root จะพาไป prototype อัตโนมัติ)

### อัปเดตระบบภายหลัง
แก้ไฟล์ `prototype/index.html` → ใน GitHub Desktop กด **Commit to main** → **Push origin**
ลิงก์ Pages จะอัปเดตให้เองภายในไม่กี่นาที

> **หมายเหตุ:** GitHub Pages ใช้เสิร์ฟหน้าเว็บ ส่วนข้อมูลกลางอยู่ใน Supabase
> และถูกจำกัดด้วย RLS ตามบทบาท/แผนก ระบบ Production ทำงานแบบ fail-closed:
> หากยืนยันตัวตนหรือเชื่อม Supabase ไม่ได้ จะไม่เปิดข้อมูล local/ตัวอย่าง

### Migration ล่าสุด

ก่อนขึ้นเวอร์ชัน Role/รายงานล่าสุด ให้รันตามลำดับถึง
`supabase/migrations/202608300015_profile_roles_and_reporting.sql` ซึ่งเพิ่มตำแหน่งงาน,
แยก “แผนกที่มองเห็น” ออกจาก “แผนกที่หัวหน้าจัดการ” อย่างชัดเจน,
จำกัด metadata ส่วนกลางไว้เฉพาะผู้บริหาร/Admin และล้าง shared demo state

จากนั้นรัน `supabase/migrations/202609010016_meeting_action_plan.sql` เพื่อเปิดใช้
Action Plan จากมติประชุม, กำหนดเจ้าของ/กำหนดส่ง/หลักฐาน/สถานะ, คุมสิทธิ์ด้วย RLS
และกำหนดให้รายงานของกราฟิกถูกรวมภายใต้การตลาดโดยไม่เปลี่ยนแผนกหลักของพนักงาน
Migration นี้ไม่แก้ตารางหรือกระบวนการนำเข้า Graphic และ Daily Activity เดิม

รัน `supabase/migrations/202609010017_issue_intake_and_source_trace.sql` เพื่อเปิด
หน้ารับแจ้งปัญหาสำหรับพนักงาน, เก็บขอบเขต/จำนวน/มูลค่าผลกระทบ, เวลารับเรื่อง,
เวลาปิดเคส และ Source Trace สำหรับข้อมูลปัญหาเดือนกรกฎาคม–สิงหาคม
โดยไม่เปลี่ยน pipeline นำเข้า Graphic หรือ Daily Activity

รัน `supabase/migrations/202609010018_assignee_task_progress.sql` เพื่อให้ผู้รับงาน
อัปเดตความคืบหน้า ลงเวลา และเสนอวิธีแก้ได้โดยไม่เปิดสิทธิ์แก้ทั้งแผนก หัวหน้ายังคง
เป็นผู้อนุมัติ/ปิดงาน พร้อมย้ายประกาศ การระบุผู้รับ การรับทราบ และความคิดเห็นจาก
หน่วยความจำหน้าเว็บเข้าสู่ตาราง Production ที่ควบคุมด้วย RLS

ข้อมูลปัญหาจริงต้องเก็บนอก public repository แล้วสร้าง SQL แบบ idempotent ด้วย
`scripts/prepare_operational_issue_import.py` สคริปต์จะสร้าง `source_key`, เก็บ
source trace/quality flags, upsert ตาม Issue ID และแยกรายการทดสอบออกก่อนนำเข้า
Production

หลัง Migration 015 ให้ deploy `supabase/functions/invite-company-user` เวอร์ชันล่าสุด
เพื่อให้การสร้างพนักงานจากหน้า Company Hub บันทึกตำแหน่ง, Role, แผนกหลัก,
แผนกที่มองเห็น และแผนกที่จัดการครบชุด

รัน `supabase/migrations/202608210005_operational_issues.sql` และตามด้วย
`supabase/migrations/202608210006_issue_to_sop_workflow.sql` ใน Supabase SQL Editor
หลัง Migration 001–004 เพื่อสร้างทะเบียนปัญหา, การวิเคราะห์ Root cause/การป้องกันซ้ำ
และ workflow สร้างร่าง SOP แบบควบคุมสิทธิ์ ข้อมูลเคสจริงจะนำเข้าฐานข้อมูลโดยตรง
และจะไม่บันทึกไว้ในไฟล์เว็บหรือ migration ที่เผยแพร่บน GitHub Pages

### Graphic Production

รัน `supabase/migrations/202608260007_graphic_production.sql` หลัง Migration 006
เพื่อเปิดโมดูลรับบรีฟ, Kanban 7 ขั้น, งานรายเดือน, Checklist, ไฟล์งาน,
รอบแก้ไข และ Dashboard ของทีมกราฟิก

Company Hub เป็นระบบหลักสำหรับรับบรีฟ มอบหมาย ติดตาม ตรวจงาน และส่งมอบ
สามารถกดดูงานแยกตามทีม/ผู้รับผิดชอบจากหน้า Graphic Production ได้โดยตรง

### เปิดใช้ Talk to Data AI

AI ทำงานใน Supabase Edge Function `talk-to-data` เพื่อไม่เปิดเผย API key ในหน้าเว็บ
และจะคัดข้อมูลตาม Role/แผนกก่อนส่งไปวิเคราะห์ ข้อมูลคำถามและบริบทไม่ถูกเก็บใน
OpenAI Responses API (`store: false`)

1. ตั้ง Secret ใน Supabase Project Settings หรือ CLI โดยไม่ใส่ key ลงใน Git:
   `supabase secrets set OPENAI_API_KEY=<your-key>`
2. เลือกโมเดลได้ด้วย Secret `OPENAI_MODEL` (ค่าเริ่มต้น `gpt-5.4-mini`)
3. Deploy: `supabase functions deploy talk-to-data`
4. ทดสอบด้วยบัญชีจริงแต่ละ Role: staff, lead, exec และ admin

ถ้า Edge Function หรือ AI provider ไม่พร้อม หน้าเว็บจะตอบจากกฎและข้อมูลจริงที่โหลดอยู่
พร้อมติดป้ายว่าเป็นคำตอบสำรอง ผู้ใช้จึงไม่เจอหน้าว่างหรือข้อความที่แต่งขึ้น
