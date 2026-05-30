"""Tests for the shared fuzzy matcher. Run: python -m pytest (from backend/)."""
import matching
from matching import normalize, match_tracks


def t(title, artist):
    return {"title": title, "artist": artist}


# --- normalize ---------------------------------------------------------------

def test_normalize_lowercases_and_trims():
    assert normalize("  Hello World  ") == "hello world"


def test_normalize_strips_feat():
    assert normalize("Stay (feat. Justin Bieber)") == "stay"
    assert normalize("One Dance ft. Wizkid") == "one dance"


def test_normalize_strips_version_qualifiers():
    assert normalize("Song (Extended Mix)") == "song"
    assert normalize("Song (Remastered 2011)") == "song"
    assert normalize("Touch (HH Clean Intro)") == "touch"


def test_normalize_strips_trailing_dash_qualifier():
    assert normalize("Levels - Radio Edit") == "levels"


def test_normalize_empty_input():
    assert normalize("") == ""
    assert normalize(None) == ""


# --- match_tracks: classification --------------------------------------------

def test_exact_match_is_in_library():
    local = [t("Blinding Lights", "The Weeknd")]
    res = match_tracks([t("Blinding Lights", "The Weeknd")], local)
    assert res["summary"]["match"] == 1
    assert res["results"][0]["match"]["status"] == "match"
    assert res["results"][0]["match"]["score"] >= matching.MATCH_THRESHOLD


def test_match_ignores_feat_and_version_tags():
    local = [t("Stay", "The Kid LAROI")]
    chart = [t("Stay (feat. Justin Bieber) - Radio Edit", "The Kid LAROI")]
    res = match_tracks(chart, local)
    assert res["results"][0]["match"]["status"] == "match"


def test_completely_different_track_is_missing():
    local = [t("Blinding Lights", "The Weeknd")]
    res = match_tracks([t("Clair de Lune", "Claude Debussy")], local)
    assert res["summary"]["missing"] == 1
    assert res["results"][0]["match"] is None


def test_wrong_artist_same_title_does_not_match():
    # Both title and artist must score well; title alone is not enough.
    local = [t("Forever", "Drake")]
    res = match_tracks([t("Forever", "Chris Brown")], local)
    assert res["results"][0]["match"] is None or \
        res["results"][0]["match"]["status"] != "match"


# --- match_tracks: edge cases ------------------------------------------------

def test_empty_local_library_marks_all_missing():
    res = match_tracks([t("Anything", "Anyone")], [])
    assert res["summary"] == {"total": 1, "match": 0, "uncertain": 0, "missing": 1}


def test_empty_chart_returns_empty():
    res = match_tracks([], [t("Blinding Lights", "The Weeknd")])
    assert res["summary"]["total"] == 0
    assert res["results"] == []


def test_summary_counts_sum_to_total():
    local = [t("Blinding Lights", "The Weeknd"), t("Stay", "The Kid LAROI")]
    chart = [
        t("Blinding Lights", "The Weeknd"),      # match
        t("Clair de Lune", "Claude Debussy"),    # missing
    ]
    s = match_tracks(chart, local)["summary"]
    assert s["match"] + s["uncertain"] + s["missing"] == s["total"] == 2
