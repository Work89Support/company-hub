# บัญชีทีม: ชื่อ (แผนก) และอีเมลภายหลัง

สถานะ 2026-09-05: ผู้ใช้อนุมัตินำขึ้นจริงแล้ว ติดตั้ง Migration 023 และ 025 บน Supabase สำเร็จ กฎรหัสครอบคลุม 42 ตาราง เผยแพร่ company-accounts, access-gate, invite-company-user, talk-to-data แล้ว และตรวจ company-accounts ไม่ล็อกอินได้ 401 ขั้นต่อไป publish frontend และสร้างบัญชีจริง

## การใช้งาน

- พนักงานเข้าด้วย `ชื่อ (ชื่อแผนก)` ตามชื่อแผนกจริงในฐานข้อมูล ไม่บังคับมีอีเมล ชื่อเข้าสู่ระบบไม่แยกตัวพิมพ์ใหญ่เล็ก
- บัญชีของฉัน: แก้ชื่อและใส่อีเมลภายหลังได้ อีเมลนี้เป็นข้อมูลติดต่อที่ยังไม่ยืนยัน ไม่รวมบัญชีหรือใช้กู้รหัสอัตโนมัติ การรองรับอีเมลเป็นตัวเชื่อมในอนาคตต้องยืนยันความเป็นเจ้าของก่อน
- เปลี่ยนชื่อแล้วใช้ชื่อใหม่เข้าสู่ระบบ งานและสิทธิ์ผูกกับ profile UUID เดิม หากผู้ดูแลเปลี่ยนแผนก ป้ายชื่อเข้าสู่ระบบเปลี่ยนตามแผนกใหม่ด้วย
- บัญชีทีม (admin/exec): กดดูรายชื่อจากงานในระบบ ตรวจรายการแล้วสร้างชื่อที่ตรวจผ่านได้เป็นชุด หรือสร้างทีละคนได้ ยังรองรับนำเข้าไฟล์รายชื่อ JSON เป็นทางเลือก ระบบตรวจชื่อกับกิจกรรม/Trello จริงและไม่ทับบัญชีที่เชื่อมแล้ว รหัสที่สร้างเป็นชุดเก็บในหน่วยความจำของหน้าเว็บและแสดงให้คัดลอกครั้งเดียวก่อนปิด/รีเฟรช
- บัญชีใหม่เป็น staff เห็นเฉพาะขอบเขตแผนกตาม RLS เดิม ไม่มีสิทธิ์จัดการแผนก บัญชียังต้องได้รับอนุมัติเครื่องตามนโยบายเดิม
- รหัสเริ่มต้นสุ่ม 144 บิต แสดงให้ผู้ดูแลครั้งเดียว อายุ 7 วัน ต้องส่งให้เจ้าของเป็นการส่วนตัว ไม่มีการส่งข้อความอัตโนมัติ ไม่มีรหัสใน Git, CSV หรือฐานข้อมูลแอป
- เจ้าของต้องกรอกรหัสครั้งแรกและตั้งรหัสใหม่ 12–128 ตัวอักษรก่อนเปิดงาน ผู้ดูแลออกรหัสครั้งใหม่ได้ เจ้าของเปลี่ยนรหัสด้วยตนเองได้โดยใช้รหัสปัจจุบัน
- 111 รายชื่อเตรียมไว้แล้ว 9 รายชื่อรอตรวจกลุ่ม/รูปสะกด ไม่สร้างบัญชีรวมแทนทุกคน ไม่คาดเดารวมชื่อคล้ายกัน รายชื่อจริงที่สร้างได้ต้องผ่านการตรวจบัญชีใน Production อีกครั้ง

## ขอบเขตทางเทคนิค

Migration `202609050025_username_accounts.sql` ต้องตาม Migration 020 และ 019 และ schema Trello 011 (รวมถึง migration ที่มีอยู่ก่อนหน้า) ตาราง `company_login_accounts` ไม่เปิดให้ anon/authenticated อ่านหรือเขียนตรง รหัสผ่านจัดการด้วย Supabase Auth Admin API ใน Edge เท่านั้น รูปแบบอีเมลภายในเป็น UUID บนโดเมนสงวน `.invalid` เพื่อใช้ Supabase Auth ไม่ใช่อีเมลพนักงานและไม่มีการส่งเมลไปที่โดเมนนั้น

Edge `company-accounts` ตรวจ JWT กับ Auth จริง บังคับ active profile / admin หรือ exec / device-IP gate ตามคำสั่ง ใช้ตัวนับในฐานข้อมูลจำกัดการลองล็อกอิน ทั้ง IP และชื่อผู้ใช้ การเข้าสู่ระบบแบบอีเมลเดิมยังใช้ Supabase Auth เดิม

ก่อนเปลี่ยนรหัส ล็อกแถวบัญชีและเพิ่ม revision; เปลี่ยน Auth สำเร็จแล้วจึงปลดล็อกและบังคับเข้าสู่ระบบใหม่ การเปลี่ยนรหัสผ่าน Admin API เพิกถอน refresh sessions ตาม implementation ของ Supabase Auth ส่วน JWT เก่าถูกปฏิเสธด้วย credentials_valid_after ที่ตรวจใน PostgREST pre-request, restrictive RLS (รวม Storage/Realtime) และ Edge ทุกตัวในโปรเจกต์ กรณี Auth/DB สำเร็จไม่ครบ ให้ fail closed และผู้ดูแลออกรหัสใหม่หลัง lock timeout 15 นาที ห้ามนำคำขอเก่ากลับมารันเอง

นโยบาย restrictive ถูกเพิ่มให้ตาราง RLS ที่มีอยู่ ณ migration นี้ ตารางใหม่ในอนาคตต้องมี credential guard ด้วย การแก้ display name ไม่เปลี่ยน source_key หรือ profile UUID; อีเมลติดต่อที่ยังไม่ยืนยันซ้ำกันได้และไม่ใช้ตัดสินตัวบุคคล การเปลี่ยนชื่อชนบัญชีอื่นถูกปฏิเสธทั้ง transaction

ไม่มีการแก้ auth.users ด้วย SQL ไม่มี temporary public RPC และไม่ใช้ anon เพื่อเรียก privileged mutation รหัสและ JWT ไม่ถูก log; access_audit บันทึกผู้สร้างบัญชีและผู้ขอ reset โดยไม่มีข้อมูลรหัส

## นำขึ้นระบบและตรวจจริง

1. ตรวจ Migration 025 พร้อม backup แล้ว apply ใน Supabase project `mfvbggjwqgeaoezlgiqo` หลังยืนยันการเปลี่ยนระบบเข้าถึงข้อมูล
2. Deploy `company-accounts` โดย gateway `verify_jwt=false` เพราะ login ทำงานก่อนมี JWT; คำสั่งอื่นทั้งหมดตรวจ token ภายใน handler ห้ามปิดการตรวจ token ในโค้ด
3. Deploy `access-gate`, `invite-company-user`, `talk-to-data` เวอร์ชันที่ตรวจ credential readiness ก่อน publish frontend
4. Publish frontend พร้อม `company-accounts.js` และ modules ที่หน้า index อ้างถึง ห้าม publish frontend ก่อน Edge พร้อม เพราะจะ fail closed
5. ตรวจหนึ่งบัญชีที่ผู้ใช้ยืนยัน: สร้าง → รหัสครั้งแรก → ตั้งรหัส → อนุมัติเครื่อง → เปิดงานตนเอง → แก้ชื่อ/อีเมล → reset → ตรวจรหัสและ session เก่าถูกปฏิเสธ แล้วจึงสร้างรายชื่อที่เหลือที่ไม่กำกวม

การสร้างบัญชีจริงขยายสิทธิ์เข้าถึงข้อมูลองค์กร จึงต้องยืนยัน ณ ขั้นตอนจริงตามนโยบายเครื่องมือเบราว์เซอร์ ก่อนดำเนินการนั้น ไม่เกี่ยวกับ payload import ที่ถูก automatic approval ปฏิเสธก่อนหน้านี้ ซึ่งยังแยกค้างอยู่

## ตรวจสอบในเครื่อง

- `node scripts/check-company-accounts.mjs`: auth/active/staff/admin/device/pending/stale-token/lock sequencing/rate limit ด้วย mocked Auth และ DB
- `PGLITE_MODULE=... node scripts/check-company-accounts-db.mjs`: SQL จริงใน PGlite ตรวจ pre-request และ RLS, anonymous/private table grants, locked/stale requests, email, duplicate names, source owner matching
- `DOM_MODULE=... node scripts/check-company-accounts-ui.mjs`: username/legacy-email login, first-password screen, optional email, rename UUID stability, ambiguous roster disabled

ตรวจชนิดข้อมูลด้วย `deno check` ผ่านทั้ง 4 Edge Functions แล้ว ระหว่างตรวจแก้ compatibility ของ invite-company-user ให้ใช้ jwtClaims ของ SDK และชนิด PromiseLike ของ PostgREST ใน talk-to-data

การทดสอบเหล่านี้ไม่แทน end-to-end บน Supabase Auth จริงหลัง deploy

แหล่งอ้างอิง Auth: https://supabase.com/docs/reference/javascript/auth-admin-createuser และ https://github.com/supabase/auth/blob/master/internal/models/user.go (UpdatePassword เรียก Logout เมื่อ admin เปลี่ยนรหัส)

สำรองก่อนสร้างบัญชี: schema `company_accounts_backup_20260905` ไม่เปิดให้ anon/authenticated เก็บเจ้าของกิจกรรม 6,146 รายการ การเชื่อม Trello และนิยาม Access Gate เดิม
