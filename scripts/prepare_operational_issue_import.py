#!/usr/bin/env python3
"""Build an idempotent Supabase import for July/August operational issues.

Source rows stay outside the public repository.  The generated SQL is intended
for a one-time Production run after migrations 016 and 017.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path


TEST_RE = re.compile(r"(?:^|\s)(?:เทสระบบ|ทดสอบระบบ|test)(?:\s|$)", re.I)
TIME_RE = re.compile(r"(?<!\d)([0-2]?\d)[.:]([0-5]\d)(?::([0-5]\d))?")


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def sql_text(value: object) -> str:
    return "'" + str(value or "").replace("'", "''") + "'"


def sql_nullable(value: object) -> str:
    return "null" if value is None or value == "" else sql_text(value)


def sql_num(value: object) -> str:
    return "null" if value is None or value == "" else str(value)


def sql_array(values: list[str]) -> str:
    if not values:
        return "'{}'::text[]"
    return "array[" + ",".join(sql_text(v) for v in values) + "]::text[]"


def parse_thai_date(value: object) -> dt.date | None:
    text = clean(value)
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", text)
    if not match:
        return None
    day, month, year = map(int, match.groups())
    if year < 100:
        year += 2500
    if year > 2400:
        year -= 543
    try:
        return dt.date(year, month, day)
    except ValueError:
        return None


def parse_iso_date(value: object) -> dt.date | None:
    text = clean(value)
    try:
        return dt.date.fromisoformat(text[:10])
    except ValueError:
        return parse_thai_date(text)


def times_in(value: object) -> list[tuple[int, int, int]]:
    found: list[tuple[int, int, int]] = []
    for hour, minute, second in TIME_RE.findall(clean(value)):
        h, m, s = int(hour), int(minute), int(second or 0)
        if h <= 23:
            found.append((h, m, s))
    return found


def occurred_at(day: dt.date, raw_time: object) -> str:
    found = times_in(raw_time)
    hour, minute, second = found[0] if found else (12, 0, 0)
    return f"{day.isoformat()} {hour:02d}:{minute:02d}:{second:02d}+07"


def duration_minutes(raw_duration: object, raw_start: object, raw_reply: object) -> int | None:
    duration = clean(raw_duration)
    duration_times = times_in(duration)
    if len(duration_times) >= 2 and "-" in duration:
        start = duration_times[0][0] * 60 + duration_times[0][1]
        end = duration_times[-1][0] * 60 + duration_times[-1][1]
        return (end - start) % (24 * 60)
    if len(duration_times) == 1 and re.search(r"\d+[.:]\d+", duration):
        return duration_times[0][0] * 60 + duration_times[0][1]
    start_times, reply_times = times_in(raw_start), times_in(raw_reply)
    if start_times and reply_times:
        start = start_times[0][0] * 60 + start_times[0][1]
        end = reply_times[-1][0] * 60 + reply_times[-1][1]
        return (end - start) % (24 * 60)
    return None


def infer_category(problem: str) -> str:
    p = problem.lower()
    if re.search(r"ฝาก|ถอน|สลิป|ยอด|เงิน|payment|callback|api", p):
        return "Payment"
    if re.search(r"ค่าย|เกม|provider|casino|sport|เดิมพัน|ปรับปรุง", p):
        return "Provider"
    if re.search(r"เว็บ|website|หน้าเว็บ|ลิงก์|link", p):
        return "Website"
    if re.search(r"เน็ต|network|cloudflare|server|เซิร์ฟเวอร์", p):
        return "Network"
    return "System"


def meaningful_solution(reply: str) -> str:
    if not reply or reply in {"-", "ตอบทันที"}:
        return ""
    residue = TIME_RE.sub("", reply)
    residue = re.sub(r"\b(?:น\.?|ตอบ|แก้ไข|เวลา|ตั้งแต่|ถึง)\b|[-–:/.,]", " ", residue)
    residue = clean(residue)
    return reply if len(residue) >= 5 else ""


def quality_flags(*, report_time: str, reply: str, team: str, minutes: int | None, day: dt.date | None) -> list[str]:
    flags: list[str] = []
    if not day:
        flags.append("missing_date")
    if not times_in(report_time):
        flags.append("missing_report_time")
    if not clean(reply) or clean(reply) == "-":
        flags.append("missing_resolution_detail")
    if not clean(team):
        flags.append("missing_owner")
    if minutes is None:
        flags.append("missing_resolution_minutes")
    return flags


def july_rows(path: Path, sheet: str, project: str, document_id: str) -> list[dict]:
    values = json.loads(path.read_text(encoding="utf-8"))["values"]
    output: list[dict] = []
    for source_row, row in enumerate(values, start=1):
        row = list(row) + [""] * (7 - len(row))
        raw_date, problem, report_time, reply, duration, team = row[1:7]
        day = parse_thai_date(raw_date)
        problem = clean(problem)
        if not day or not problem or problem == "เรื่อง":
            continue
        report_time, reply, duration, team = map(clean, (report_time, reply, duration, team))
        minutes = duration_minutes(duration, report_time, reply)
        solution = meaningful_solution(reply)
        status = "Resolved" if solution or minutes is not None else "Open"
        source_key = f"gsheet:{document_id}:{sheet}:{source_row}"
        slug = re.sub(r"[^A-Za-z0-9]+", "-", project).strip("-").upper()
        issue_id = f"ISS-202607-{slug}-{source_row:04d}"
        flags = quality_flags(report_time=report_time, reply=reply, team=team, minutes=minutes, day=day)
        raw = {
            "date": clean(raw_date), "problem": problem, "report_time": report_time,
            "reply_or_resolution": reply, "duration": duration, "team": team,
        }
        output.append({
            "id": issue_id, "occurred_at": occurred_at(day, report_time), "project_code": project,
            "category": infer_category(problem), "problem": problem, "priority": "Medium",
            "reporter": "นำเข้าจากรายงานเดือนกรกฎาคม", "status": status, "owner_team": team,
            "solution": solution, "resolution_minutes": minutes, "source": "Google Sheets · กรกฎาคม 2569",
            "solution_type": "permanent" if solution else "unresolved", "resolved_at": None,
            "source_document_id": document_id, "source_sheet": sheet, "source_row": source_row,
            "source_key": source_key, "source_payload": raw, "data_quality_flags": flags,
        })
    return output


def august_rows(path: Path, document_id: str) -> tuple[list[dict], list[str]]:
    values = json.loads(path.read_text(encoding="utf-8"))["values"]
    headers = [clean(v) for v in values[0]]
    output: list[dict] = []
    test_ids: list[str] = []
    for source_row, row in enumerate(values[1:], start=2):
        data = {headers[i]: clean(row[i]) if i < len(row) else "" for i in range(len(headers))}
        issue_id, problem = data.get("Issue ID", ""), data.get("Problem", "")
        day = parse_iso_date(data.get("Date"))
        if not issue_id or not day or not problem:
            continue
        if TEST_RE.search(problem):
            test_ids.append(issue_id)
            continue
        status = data.get("Status") if data.get("Status") in {"Open", "In Progress", "Resolved"} else "Open"
        priority = data.get("Priority") if data.get("Priority") in {"Low", "Medium", "High", "Critical"} else "Medium"
        minutes_text = data.get("Resolution Minutes", "")
        try:
            minutes = float(minutes_text) if minutes_text else None
        except ValueError:
            minutes = None
        owner, solution = data.get("Owner", ""), data.get("Solution", "")
        flags: list[str] = []
        if not owner:
            flags.append("missing_owner")
        if status == "Resolved" and not solution:
            flags.append("resolved_without_solution")
        if minutes is None:
            flags.append("missing_resolution_minutes")
        elif minutes > 1440:
            flags.append("resolution_over_24h_review")
        source_key = f"gsheet:{document_id}:Issues:{source_row}"
        output.append({
            "id": issue_id, "occurred_at": occurred_at(day, data.get("Time")),
            "project_code": data.get("Project") or "ไม่ระบุ", "category": data.get("Category") or infer_category(problem),
            "problem": problem, "priority": priority, "reporter": data.get("Reporter"), "status": status,
            "owner_team": owner, "solution": solution, "resolution_minutes": minutes,
            "source": "Google Sheets · Problem Management V2", "solution_type": "permanent" if solution else "unresolved",
            "resolved_at": f"{day.isoformat()} 12:00:00+07" if status == "Resolved" else None,
            "source_document_id": document_id, "source_sheet": "Issues", "source_row": source_row,
            "source_key": source_key, "source_payload": data, "data_quality_flags": flags,
        })
    return output, test_ids


def render_row(row: dict) -> str:
    payload = json.dumps(row["source_payload"], ensure_ascii=False, separators=(",", ":"))
    fields = [
        sql_text(row["id"]), "'ADMIN'", sql_text(row["occurred_at"]) + "::timestamptz",
        sql_text(row["project_code"]), sql_text(row["category"]), sql_text(row["problem"]),
        sql_text(row["priority"]), sql_text(row["reporter"]), sql_text(row["status"]),
        sql_text(row["owner_team"]), sql_text(row["solution"]), sql_num(row["resolution_minutes"]),
        sql_text(row["source"]), sql_text(row["solution_type"]), sql_nullable(row["resolved_at"]),
        sql_text(row["source_document_id"]), sql_text(row["source_sheet"]), str(row["source_row"]),
        sql_text(row["source_key"]), sql_text(payload) + "::jsonb", sql_array(row["data_quality_flags"]),
    ]
    return "(" + ",".join(fields) + ")"


def build_sql(rows: list[dict], test_ids: list[str]) -> str:
    columns = "id,department_code,occurred_at,project_code,category,problem,priority,reporter,status,owner_team,solution,resolution_minutes,source,solution_type,resolved_at,source_document_id,source_sheet,source_row,source_key,source_payload,data_quality_flags"
    update_cols = [c for c in columns.split(",") if c not in {"id", "department_code"}]
    chunks = [rows[i:i + 75] for i in range(0, len(rows), 75)]
    statements = ["begin;", "-- Remove source rows explicitly identified as tests."]
    if test_ids:
        statements.append("delete from public.operational_issues where id in (" + ",".join(sql_text(i) for i in test_ids) + ");")
    for chunk in chunks:
        statements.append(
            f"insert into public.operational_issues ({columns}) values\n" +
            ",\n".join(render_row(row) for row in chunk) +
            "\non conflict(id) do update set\n  " +
            ",\n  ".join(f"{col}=excluded.{col}" for col in update_cols) + ";"
        )
    statements.extend([
        "commit;",
        "select count(*) as total_issues,",
        "  count(*) filter (where source_document_id='1EcT0zpXcF1M9e-fLMNCJTT59vc-0X3uiNZPzlIDECDI') as july_issues,",
        "  count(*) filter (where source_document_id='1PWEXVMg-bg-xOBNfAvvrjPl5K6F4Eqvp2B894-1dTI4') as august_issues,",
        "  count(*) filter (where status='Open') as open_issues,",
        "  count(*) filter (where status='Resolved') as resolved_issues,",
        "  count(*) filter (where cardinality(data_quality_flags)>0) as needs_review",
        "from public.operational_issues;",
    ])
    return "\n\n".join(statements) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--july-3x", type=Path, required=True)
    parser.add_argument("--july-fr8", type=Path, required=True)
    parser.add_argument("--august", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    july_id = "1EcT0zpXcF1M9e-fLMNCJTT59vc-0X3uiNZPzlIDECDI"
    august_id = "1PWEXVMg-bg-xOBNfAvvrjPl5K6F4Eqvp2B894-1dTI4"
    rows = july_rows(args.july_3x, "3X", "3X", july_id)
    rows += july_rows(args.july_fr8, "FR8", "FR8", july_id)
    august, test_ids = august_rows(args.august, august_id)
    rows += august
    args.output.write_text(build_sql(rows, test_ids), encoding="utf-8")
    digest = hashlib.sha256(args.output.read_bytes()).hexdigest()[:16]
    print(json.dumps({
        "july": sum(1 for r in rows if r["source_document_id"] == july_id),
        "august": len(august), "excluded_tests": test_ids, "total": len(rows),
        "needs_review": sum(bool(r["data_quality_flags"]) for r in rows),
        "sql_sha256": digest,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
