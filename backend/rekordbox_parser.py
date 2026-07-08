import os
from typing import Optional

from pyrekordbox import Rekordbox6Database


class RekordboxLibrary:
    """Reads the Rekordbox 6+ master.db directly via pyrekordbox.

    Rekordbox must be CLOSED while the app reads the database, otherwise
    the file is locked.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        self._db: Optional[Rekordbox6Database] = None
        self._tree: list = []
        self._tracks_by_playlist: dict = {}
        self._names_by_id: dict = {}
        self._all_tracks: list = []
        self.loaded = False
        self.error: Optional[str] = None

    def load(self):
        try:
            self._db = (
                Rekordbox6Database(path=self.db_path)
                if self.db_path
                else Rekordbox6Database()
            )
        except Exception as e:
            raise RuntimeError(f"Could not open Rekordbox database: {e}") from e

        self._tracks_by_playlist = {}
        self._names_by_id = {}
        nodes: dict = {}

        for item in self._db.get_playlist():
            attr = int(item.Attribute or 0)
            if attr not in (0, 1):
                continue

            node = {
                "id": str(item.ID),
                "name": item.Name or "(unnamed)",
                "parent_id": str(item.ParentID) if item.ParentID else None,
                "type": "folder" if attr == 1 else "playlist",
                "children": [],
            }

            if node["type"] == "playlist":
                songs = list(item.Songs) if item.Songs else []
                node["track_count"] = len(songs)
                self._tracks_by_playlist[node["id"]] = [
                    t for t in (self._extract_track(s.Content) for s in songs) if t
                ]

            self._names_by_id[node["id"]] = node["name"]
            nodes[node["id"]] = node

        roots: list = []
        for node in nodes.values():
            pid = node["parent_id"]
            if pid and pid in nodes:
                nodes[pid]["children"].append(node)
            else:
                roots.append(node)

        _sort_tree(roots)
        self._tree = roots

        self._all_tracks = [
            t for t in (self._extract_track(c) for c in self._db.get_content()) if t
        ]

        self.loaded = True

    def _extract_track(self, content):
        if content is None:
            return None
        bpm_raw = content.BPM
        bpm = bpm_raw / 100 if bpm_raw else None
        return {
            "id": str(content.ID),
            "title": content.Title or "",
            "artist": content.ArtistName or "",
            "album": content.AlbumName or "",
            "bpm": f"{bpm:.2f}" if bpm else "",
            "key": content.KeyName or "",
            "duration": int(content.Length) if content.Length else None,
            "genre": content.GenreName or "",
            "comments": content.Commnt or "",
            "path": content.FolderPath or "",
        }

    def broken_tracks(self):
        """Tracks whose audio file is missing. Two kinds:
        - "no_file": Rekordbox has no path for the track at all.
        - "file_missing": a path is stored but nothing exists there on disk.
        """
        out = []
        for t in self._all_tracks:
            path = t.get("path") or ""
            if not path:
                reason = "no_file"
            elif not os.path.exists(path):
                reason = "file_missing"
            else:
                continue
            out.append({**t, "broken_reason": reason})
        return out

    @property
    def tree(self):
        return self._tree

    @property
    def all_tracks(self):
        return self._all_tracks

    def get_playlist_tracks(self, playlist_id: str):
        return self._tracks_by_playlist.get(playlist_id)

    def playlist_name(self, playlist_id: str):
        return self._names_by_id.get(playlist_id, "Untitled")


def _sort_tree(items):
    items.sort(key=lambda x: x["name"].lower())
    for item in items:
        if item.get("children"):
            _sort_tree(item["children"])
