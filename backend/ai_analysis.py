"""AI playlist analysis — option 1: compute stats in Python, then ask Claude
for a natural-language genre/vibe writeup.

Reads ANTHROPIC_API_KEY from the environment (loaded from backend/.env by
main.py). The track list never leaves the machine except in the single
analysis request sent to the Claude API.
"""

import json
import os
from collections import Counter
from typing import Optional

import anthropic

MODEL = "claude-sonnet-4-6"

# Keep the prompt small even for huge playlists: aggregate everything in
# Python and only send a representative track sample to the model.
MAX_SAMPLE_TRACKS = 60

ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "vibe": {
            "type": "string",
            "description": "2-3 sentence description of the overall mood and feel of the playlist.",
        },
        "genres": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Primary genres/subgenres present, most prominent first (max 6).",
        },
        "energy": {
            "type": "string",
            "enum": ["low", "medium", "high", "varied"],
            "description": "Overall energy level inferred from BPM, genre, and track selection.",
        },
        "best_for": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Settings or moments this playlist suits (e.g. 'warm-up set', 'peak time', 'after-hours'). Max 4.",
        },
        "notable_tracks": {
            "type": "array",
            "items": {"type": "string"},
            "description": "2-4 tracks (\"Title — Artist\") that capture the playlist's character.",
        },
    },
    "required": ["vibe", "genres", "energy", "best_for", "notable_tracks"],
    "additionalProperties": False,
}


def _parse_bpm(raw) -> Optional[float]:
    try:
        v = float(raw)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def compute_stats(tracks: list[dict]) -> dict:
    """Deterministic aggregates over the playlist — computed locally, not by the LLM."""
    bpms = [b for b in (_parse_bpm(t.get("bpm")) for t in tracks) if b is not None]
    genres = Counter(t["genre"] for t in tracks if t.get("genre"))
    keys = Counter(t["key"] for t in tracks if t.get("key"))

    bpm_stats = None
    if bpms:
        bpm_stats = {
            "min": round(min(bpms)),
            "max": round(max(bpms)),
            "avg": round(sum(bpms) / len(bpms)),
        }

    return {
        "track_count": len(tracks),
        "bpm": bpm_stats,
        "top_genres": genres.most_common(8),
        "top_keys": keys.most_common(6),
    }


def _format_track(t: dict) -> str:
    line = f"{t.get('title', '')} — {t.get('artist', '')}"
    if t.get("genre"):
        line += f" [{t['genre']}]"
    if t.get("bpm"):
        line += f" {t['bpm']}bpm"
    return line


def _build_prompt(name: str, stats: dict, tracks: list[dict]) -> str:
    sample = tracks[:MAX_SAMPLE_TRACKS]
    lines = [_format_track(t) for t in sample]
    more = len(tracks) - len(sample)
    sample_block = "\n".join(lines) + (f"\n…and {more} more tracks" if more > 0 else "")

    return (
        f"Analyze this DJ playlist named \"{name}\".\n\n"
        f"Aggregate stats (computed from the full {stats['track_count']}-track playlist):\n"
        f"{json.dumps(stats, indent=2)}\n\n"
        f"Representative tracks:\n{sample_block}\n\n"
        "Describe the playlist's genre mix and overall vibe. Ground your answer in "
        "the stats and tracks above; do not invent tracks that aren't listed."
    )


def analyze(name: str, tracks: list[dict]) -> dict:
    """Return an AI genre/vibe analysis plus the locally-computed stats.

    Raises ValueError on empty input or a missing API key so the caller can
    surface a clean 4xx.
    """
    if not tracks:
        raise ValueError("Playlist has no tracks to analyze.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env to enable AI analysis."
        )

    stats = compute_stats(tracks)
    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": _build_prompt(name or "Untitled", stats, tracks)}],
        output_config={"format": {"type": "json_schema", "schema": ANALYSIS_SCHEMA}},
    )
    # output_config.format guarantees the first text block is valid JSON for the schema.
    text = next(b.text for b in response.content if b.type == "text")
    analysis = json.loads(text)

    return {"stats": stats, "analysis": analysis}
