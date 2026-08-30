-- Reconcile Thai short-year activity dates before the 1 Sep 2026 go-live.
-- 1) Correct rows that were parsed as 2069.
-- 2) Recover 14 Admin X5 rows whose source used DD-MM-69.

update public.daily_activities
set activity_date=make_date(2026,extract(month from activity_date)::integer,extract(day from activity_date)::integer),
    completed_date=case when completed_date is not null and extract(year from completed_date)=2069
      then make_date(2026,extract(month from completed_date)::integer,extract(day from completed_date)::integer)
      else completed_date end,
    data_quality_flags=(select coalesce(array_agg(distinct flag),'{}'::text[])
      from unnest(array_remove(data_quality_flags,'unexpected_year')||array['corrected_date']) flag),
    updated_at=now(),synced_at=now()
where source='Google Sheets Team Sync'
  and extract(year from activity_date)=2069;

with recovered(source_row,activity_date,employee_name,activity,category,start_time,end_time,
  source_start_raw,source_end_raw,status,worksite,source_date_raw,data_quality_flags) as (values
  (223,date '2026-08-23','อาร์ม','ส่งเคสยอดฝาก PM CP เนื่องจากลุึกค้าฝากมาไม่เข้า','แก้ปัญหา / เคส (Issue)',time '00:00',time '01:00','0.00','1.00','เสร็จ (Completed)','FR8','23-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (224,date '2026-08-23','อาร์ม','สรุปปัญหาประจำวันก่อนออกงาน','งานประจำ (Routine)',time '07:50',time '08:15','7.50','8.15','เสร็จ (Completed)','FR8','23-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (225,date '2026-08-23','หนุ่ม','รับเขียว+เติมมือ+ตอบเเชท+ส่งเคส','งานประจำ (Routine)',time '20:20',time '08:20','20.20','8.20','เสร็จ (Completed)','FR8','23-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (226,date '2026-08-23','หนุ่ม','ตอบแชท /เติมมือ/แนบสลิปให้ลูกค้า','งานประจำ (Routine)',time '20:20',time '08:20','20.20','8.20','เสร็จ (Completed)','FR8','23-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (227,date '2026-08-23','หนุ่ม','รับเขียว/เติมมือ/ตอบเเชท','งานประจำ (Routine)',time '20:20',time '08:20','20.20','8.20','เสร็จ (Completed)','FR8','23-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (337,date '2026-08-23','หนุ่ม','ตอบแชท /เติมมือ/แนบสลิปให้ลูกค้า','งานประจำ (Routine)',time '20:20',time '08:20','20.20','8.20','กำลังทำ (In Progress)','FR8','23-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (338,date '2026-08-24','หนุ่ม','รับเขียว/เติมมือ/ตอบเเชท','งานประจำ (Routine)',time '20:20',time '08:20','20.20','8.20','กำลังทำ (In Progress)','FR8','24-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (441,date '2026-08-25','อาร์ม','อัพเดตยอด PM ประจำวัน','งานประจำ (Routine)',time '00:00',time '00:05','0.00','0.05','เสร็จ (Completed)','FR8','25-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (442,date '2026-08-25','อาร์ม','อัพเดตยอด PM ประจำวัน','งานประจำ (Routine)',time '07:25',time '07:30','7.25','7.30','เสร็จ (Completed)','FR8','25-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (443,date '2026-08-25','อาร์ม','สรุปปัญหาประจำวันก่อนออกงาน','งานประจำ (Routine)',time '07:50',time '08:15','7.50','8.15','เสร็จ (Completed)','FR8','25-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (502,date '2026-08-26','อาร์ม','เติมโปรคืนยอดเสียประจำเดือน 3%','งานประจำ (Routine)',time '01:00',time '08:15','01.00','08-15','เสร็จ (Completed)','FR8','26-08-69',array['corrected_date','start_thai_decimal_time','end_corrected_separator']),
  (503,date '2026-08-26','อาร์ม','อัพเดตยอด PM ประจำวัน','งานประจำ (Routine)',time '00:00',time '00:05','0.00','0.05','เสร็จ (Completed)','FR8','26-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (504,date '2026-08-26','อาร์ม','อัพเดตยอด PM ประจำวัน','งานประจำ (Routine)',time '07:25',time '07:30','7.25','7.30','เสร็จ (Completed)','FR8','26-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time']),
  (505,date '2026-08-26','อาร์ม','สรุปปัญหาประจำวันก่อนออกงาน','งานประจำ (Routine)',time '07:50',time '08:15','7.50','8.15','เสร็จ (Completed)','FR8','26-08-69',array['corrected_date','start_thai_decimal_time','end_thai_decimal_time'])
)
insert into public.daily_activities(
  source_key,department_code,department_label,group_code,activity_date,employee_name,
  activity,category,start_time,end_time,duration_minutes,status,time_flag,source,
  source_start_raw,source_end_raw,result_note,worksite,operational_issue,
  source_document_id,source_sheet,source_row,source_hash,source_date_raw,
  data_quality_flags,sync_batch,sync_status,is_active,synced_at
)
select
  'gs-v1-1QhBdwdbUp-a9364ad455-'||source_row,'ADMIN','แอดมิน (Admin)','04',activity_date,
  employee_name,activity,category,start_time,end_time,
  case when end_time>=start_time then extract(epoch from (end_time-start_time))/60
       else (extract(epoch from (end_time-start_time))/60)+1440 end,
  status,case when end_time<start_time then 'overnight' else 'ok' end,
  'Google Sheets Team Sync',source_start_raw,source_end_raw,'',worksite,'',
  '1QhBdwdbUpohnnzMD_zCfgEcyJAj454Ufnn2PFQmzjkg','แอดมิน (Admin) X5',source_row,
  md5(source_row::text||activity||activity_date::text),source_date_raw,data_quality_flags,
  '2026-08-30-go-live-reconcile','active',true,now()
from recovered
on conflict(source_key) do update set
  activity_date=excluded.activity_date,employee_name=excluded.employee_name,
  activity=excluded.activity,category=excluded.category,start_time=excluded.start_time,
  end_time=excluded.end_time,duration_minutes=excluded.duration_minutes,status=excluded.status,
  time_flag=excluded.time_flag,source_start_raw=excluded.source_start_raw,
  source_end_raw=excluded.source_end_raw,source_date_raw=excluded.source_date_raw,
  data_quality_flags=excluded.data_quality_flags,sync_batch=excluded.sync_batch,
  sync_status='active',is_active=true,synced_at=now();

insert into public.activity_sync_runs(batch_key,active_rows,stale_rows,summary)
select '2026-08-30-go-live-reconcile',count(*),0,
  jsonb_build_object('purpose','Recover DD-MM-69 rows and correct 2069 dates','expected_active_rows',2856)
from public.daily_activities where is_active and source='Google Sheets Team Sync'
on conflict(batch_key) do update set active_rows=excluded.active_rows,summary=excluded.summary,created_at=now();
