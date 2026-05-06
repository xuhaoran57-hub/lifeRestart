from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "anhui-2025-undergrad"
SOURCE_PATH = DATA_DIR / "anhui_2025_undergraduate_scores.json"
OUT_PATH = DATA_DIR / "anhui_2025_undergraduate_scores_slim.json"


def has_cooperation(row: dict) -> bool:
    return any("中外合作" in str(value) for value in row.values() if value is not None)


def count_value(row: dict) -> int:
    value = row.get("投档人数")
    return value if isinstance(value, int) else -1


def normalized_school_name(row: dict) -> str:
    name = str(row.get("院校名称") or "").strip()
    return name.rstrip("：:·.。；;、，, ")


def tie_key(row: dict) -> tuple[int, int, int, int, int]:
    score = row.get("投档最低分")
    rank = row.get("最低分名次")
    page = row.get("页码")
    line = row.get("页内行号")
    return (
        count_value(row),
        -(score if isinstance(score, int) else 10**9),
        -(rank if isinstance(rank, int) else 10**9),
        -(page if isinstance(page, int) else 10**9),
        -(line if isinstance(line, int) else 10**9),
    )


def slim_subject_row(row: dict) -> dict:
    return {
        "院校代码": row.get("院校代码"),
        "院校专业组": row.get("院校专业组"),
        "投档人数": row.get("投档人数"),
        "投档最低分": row.get("投档最低分"),
        "最低分名次": row.get("最低分名次"),
        "来源图片": row.get("来源图片"),
        "页码": row.get("页码"),
        "页内行号": row.get("页内行号"),
    }


def canonical_names_by_code(rows: list[dict]) -> dict[str, str]:
    grouped: dict[str, dict[str, dict[str, float]]] = defaultdict(dict)
    for row in rows:
        code = row.get("院校代码") or ""
        name = normalized_school_name(row)
        if not code or not name:
            continue

        item = grouped[code].setdefault(
            name,
            {"count": 0, "enrollment": 0, "confidence": 0.0},
        )
        item["count"] += 1
        item["enrollment"] += max(count_value(row), 0)
        confidence = row.get("校名置信度")
        if isinstance(confidence, (int, float)):
            item["confidence"] += confidence

    canonical = {}
    for code, names in grouped.items():
        canonical[code] = max(
            names,
            key=lambda name: (
                names[name]["count"],
                names[name]["confidence"],
                names[name]["enrollment"],
                -len(name),
            ),
        )
    return canonical


def build_slim_payload(source: dict) -> dict:
    rows = source["detailRows"]
    excluded = [row for row in rows if has_cooperation(row)]
    eligible = [row for row in rows if not has_cooperation(row)]
    canonical_names = canonical_names_by_code(eligible)
    name_variants_by_code = defaultdict(set)
    for row in eligible:
        code = row.get("院校代码") or ""
        name = normalized_school_name(row)
        if code and name:
            name_variants_by_code[code].add(name)

    selected_by_subject: dict[tuple[str, str], dict] = {}
    for row in eligible:
        code = row.get("院校代码") or ""
        subject = row.get("科类") or ""
        if not code or subject not in ("历史类", "物理类"):
            continue

        key = (code, subject)
        current = selected_by_subject.get(key)
        if current is None or tie_key(row) > tie_key(current):
            selected_by_subject[key] = row

    universities: dict[str, dict] = {}
    for (code, subject), row in selected_by_subject.items():
        item = universities.setdefault(
            code,
            {
                "院校代码": code,
                "院校名称": canonical_names.get(code, normalized_school_name(row)),
                "历史类": None,
                "物理类": None,
            },
        )
        item[subject] = slim_subject_row(row)

    metadata = source.get("metadata", {})
    return {
        "metadata": {
            "sourceFile": SOURCE_PATH.name,
            "sourceName": metadata.get("sourceName"),
            "sourceUrls": metadata.get("sourceUrls"),
            "publishedAt": metadata.get("publishedAt"),
            "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "rules": [
                "去除合作办学记录",
                "按院校代码和科类分组",
                "同一院校代码只输出一所学校，名称取该代码下出现频率最高的识别结果",
                "每组保留投档人数最多的专业组；投档人数相同则优先保留投档最低分更低、最低分名次更低的一条",
            ],
            "originalDetailRowCount": len(rows),
            "excludedCooperationRowCount": len(excluded),
            "eligibleDetailRowCount": len(eligible),
            "selectedLineCount": len(selected_by_subject),
            "dedupedByCode": True,
            "sameCodeNameVariantCount": sum(
                1 for names in name_variants_by_code.values() if len(names) > 1
            ),
            "universityCount": len(universities),
        },
        "universities": [universities[code] for code in sorted(universities)],
    }


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    payload = build_slim_payload(source)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT_PATH}")
    print(json.dumps(payload["metadata"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
