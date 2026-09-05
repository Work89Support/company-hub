"""Prepare a reviewable roster; never creates credentials or merges identities."""
import argparse
import collections
import csv
import hashlib
import json
import unicodedata
from pathlib import Path

DEPARTMENTS = {'BOM':'ทีมบริหาร','FIN':'การเงิน','AUD123':'ออดิท 123','AUDXB':'ออดิท XB','HR':'ทรัพยากรบุคคล','MKT':'การตลาด','PROG':'โปรแกรมเมอร์','CRM':'ลูกค้าสัมพันธ์','ADMIN':'แอดมิน','QC':'ตรวจสอบคุณภาพ','BO':'Back Office','KPI':'KPI','SECRET':'เลขานุการ','GRAPHIC':'กราฟิก'}
SHARED = {'ทุกคน','all','hr','buki grace','บอส แก๋ม'}

def prepare(activities, members):
    people = {}
    for row in activities:
        name = str(row.get('employee_name') or '').strip()
        if not name:
            continue
        key = (row['department_code'], name)
        person = people.setdefault(key, {'rows':0,'sheets':set(),'member_ids':set()})
        person['rows'] += 1
        person['sheets'].add(row['source_sheet'])
    for member in members:
        name = (member.get('fullName') or member.get('username') or '').strip()
        if name:
            people.setdefault(('GRAPHIC',name),{'rows':0,'sheets':set(),'member_ids':set()})['member_ids'].add(member['id'])
    candidates=[]
    for (department,name),info in sorted(people.items()):
        reasons=[]
        if name.casefold() in SHARED or '/' in name:
            reasons.append('ชื่อกลุ่มหรือหลายคน ต้องระบุเจ้าของบัญชี')
        # Flag obvious variants for review; do not silently merge them.
        normalized=lambda s: ''.join(c for c in unicodedata.normalize('NFKC',s).casefold() if not unicodedata.category(c).startswith(('S','Z')))
        variants=[n for d,n in people if d==department and n!=name and normalized(n)==normalized(name)]
        if variants:
            reasons.append('รูปชื่อใกล้เคียง: '+', '.join(variants))
        candidates.append({'account_key':hashlib.sha256((department+'\x1f'+name).encode()).hexdigest()[:24],
          'source_name':name,'department_code':department,'display_name':f'{name} ({DEPARTMENTS.get(department,department)})',
          'activity_count':info['rows'],'source_sheets':' | '.join(sorted(info['sheets'])),
          'trello_member_ids':' | '.join(sorted(info['member_ids'])),'email':'',
          'review_status':'review_identity' if reasons else 'awaiting_login_method',
          'review_notes':' | '.join(reasons),'role':'staff'})
    return candidates

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--activities',type=Path,required=True);parser.add_argument('--trello',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    rows=prepare(json.loads(args.activities.read_text()),json.loads(args.trello.read_text()).get('members',[]))
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'team-account-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
    with (args.output/'team-account-candidates.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else ['account_key','source_name','department_code','display_name','review_status']);writer.writeheader();writer.writerows(rows)
    print(json.dumps({'candidates':len(rows),'review_required':sum(r['review_status']=='review_identity' for r in rows),'by_department':dict(collections.Counter(r['department_code'] for r in rows))},ensure_ascii=False))
