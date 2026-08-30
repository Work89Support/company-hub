#!/usr/bin/env python3
"""Prepare bounded, idempotent Graphic Production payloads from Trello JSON exports."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


URL_RE = re.compile(r"https?://[^\s\])>\"]+")


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def best_preview(rows: Any) -> str:
    previews = rows if isinstance(rows, list) else []
    usable = [row for row in previews if isinstance(row, dict) and text(row.get("url"))]
    if not usable:
        return ""
    return text(max(usable, key=lambda row: (row.get("width") or 0) * (row.get("height") or 0)).get("url"))


def action_card_id(action: dict[str, Any]) -> str:
    data = action.get("data") if isinstance(action.get("data"), dict) else {}
    card = data.get("card") if isinstance(data.get("card"), dict) else {}
    return text(card.get("id") or data.get("idCard"))


def event_type_and_note(action: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    action_type = text(action.get("type")) or "activity"
    data = action.get("data") if isinstance(action.get("data"), dict) else {}
    payload: dict[str, Any] = {"action_type": action_type}
    board = data.get("board") if isinstance(data.get("board"), dict) else {}
    list_row = data.get("list") if isinstance(data.get("list"), dict) else {}
    if board:
        payload["board_name"] = text(board.get("name"))
    if list_row:
        payload["list_name"] = text(list_row.get("name"))
    if action_type == "commentCard":
        note = text(data.get("text"))
        payload["links"] = sorted(set(URL_RE.findall(note)))
        return "trello_comment", note, payload
    before = data.get("listBefore") if isinstance(data.get("listBefore"), dict) else {}
    after = data.get("listAfter") if isinstance(data.get("listAfter"), dict) else {}
    if action_type == "updateCard" and before and after:
        payload["from_list"] = text(before.get("name"))
        payload["to_list"] = text(after.get("name"))
        return "trello_status_changed", f"{payload['from_list']} → {payload['to_list']}", payload
    old = data.get("old") if isinstance(data.get("old"), dict) else {}
    if old:
        payload["changed_fields"] = sorted(old.keys())
    event_type = "trello_" + re.sub(r"(?<!^)(?=[A-Z])", "_", action_type).lower()
    card = data.get("card") if isinstance(data.get("card"), dict) else {}
    note = text(card.get("name") or list_row.get("name") or action_type)
    return event_type[:120], note[:2000], payload


def prepare(paths: list[Path]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    members: dict[str, dict[str, Any]] = {}
    cards: dict[str, dict[str, Any]] = {}
    actions: dict[str, dict[str, Any]] = {}
    board_names: list[str] = []

    for path in paths:
        board = json.loads(path.read_text(encoding="utf-8"))
        board_names.append(text(board.get("name")))
        for member in board.get("members") or []:
            member_id = text(member.get("id"))
            if not member_id:
                continue
            members[member_id] = {
                "trello_member_id": member_id,
                "username": text(member.get("username")),
                "full_name": text(member.get("fullName")),
                "avatar_url": text(member.get("avatarUrl")),
                "email": "",
                "source_payload": {
                    "initials": text(member.get("initials")),
                    "url": text(member.get("url")),
                    "member_type": text(member.get("memberType")),
                },
            }

        open_ids: set[str] = set()
        for card in board.get("cards") or []:
            if bool(card.get("closed")):
                continue
            card_id = text(card.get("id"))
            if not card_id:
                continue
            open_ids.add(card_id)
            attachments: list[dict[str, Any]] = []
            attachment_by_id: dict[str, dict[str, Any]] = {}
            for attachment in card.get("attachments") or []:
                source_id = text(attachment.get("id"))
                if not source_id or not text(attachment.get("url")):
                    continue
                normalized = {
                    "source_id": source_id,
                    "name": text(attachment.get("name")) or "ไฟล์จาก Trello",
                    "url": text(attachment.get("url")),
                    "preview_url": best_preview(attachment.get("previews")),
                    "mime_type": text(attachment.get("mimeType")),
                    "size_bytes": attachment.get("bytes") if isinstance(attachment.get("bytes"), int) else None,
                }
                attachments.append(normalized)
                attachment_by_id[source_id] = normalized

            cover = card.get("cover") if isinstance(card.get("cover"), dict) else {}
            cover_url = best_preview(cover.get("scaled"))
            cover_id = text(card.get("idAttachmentCover") or cover.get("idAttachment"))
            if not cover_url and cover_id in attachment_by_id:
                cover_url = text(attachment_by_id[cover_id].get("preview_url") or attachment_by_id[cover_id].get("url"))
            cards[card_id] = {
                "trello_card_id": card_id,
                "cover_url": cover_url,
                "cover_color": text(cover.get("color")),
                "trello_position": card.get("pos"),
                "trello_last_activity_at": text(card.get("dateLastActivity")),
                "due_complete": bool(card.get("dueComplete")),
                "member_ids": [text(value) for value in card.get("idMembers") or [] if text(value)],
                "attachments": attachments,
                "card_patch": {
                    "idMembers": card.get("idMembers") or [],
                    "idAttachmentCover": cover_id,
                    "cover": cover,
                    "dateLastActivity": text(card.get("dateLastActivity")),
                    "dueComplete": bool(card.get("dueComplete")),
                    "pos": card.get("pos"),
                },
            }

        for action in board.get("actions") or []:
            action_id = text(action.get("id"))
            card_id = action_card_id(action)
            if not action_id or card_id not in open_ids:
                continue
            creator = action.get("memberCreator") if isinstance(action.get("memberCreator"), dict) else {}
            creator_id = text(creator.get("id"))
            if creator_id:
                previous = members.get(creator_id, {})
                members[creator_id] = {
                    "trello_member_id": creator_id,
                    "username": text(creator.get("username")) or previous.get("username", ""),
                    "full_name": text(creator.get("fullName")) or previous.get("full_name", ""),
                    "avatar_url": text(creator.get("avatarUrl")) or previous.get("avatar_url", ""),
                    "email": previous.get("email", ""),
                    "source_payload": previous.get("source_payload", {}),
                }
            event_type, note, payload = event_type_and_note(action)
            actions[action_id] = {
                "source_id": action_id,
                "trello_card_id": card_id,
                "event_type": event_type,
                "note": note,
                "created_at": text(action.get("date")),
                "trello_member_id": creator_id,
                "username": text(creator.get("username")),
                "author_name": text(creator.get("fullName")),
                "author_avatar_url": text(creator.get("avatarUrl")),
                "payload": payload,
            }

    payloads = {
        "members": sorted(members.values(), key=lambda row: (row["full_name"].lower(), row["trello_member_id"])),
        "cards": sorted(cards.values(), key=lambda row: row["trello_card_id"]),
        "actions": sorted(actions.values(), key=lambda row: (row["created_at"], row["source_id"])),
    }
    summary = {
        "boards": len(paths),
        "board_names": board_names,
        "members": len(payloads["members"]),
        "cards": len(payloads["cards"]),
        "attachments": sum(len(row["attachments"]) for row in payloads["cards"]),
        "covers": sum(bool(row["cover_url"] or row["cover_color"]) for row in payloads["cards"]),
        "member_links": sum(len(row["member_ids"]) for row in payloads["cards"]),
        "actions": len(payloads["actions"]),
        "comments": sum(row["event_type"] == "trello_comment" for row in payloads["actions"]),
        "status_moves": sum(row["event_type"] == "trello_status_changed" for row in payloads["actions"]),
    }
    return payloads, summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", action="append", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    payloads, summary = prepare(args.input)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in payloads.items():
        (args.output_dir / f"trello-{name}.json").write_text(
            json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    (args.output_dir / "trello-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
