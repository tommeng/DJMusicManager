import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import StatusBadge from './StatusBadge'
import CopyButton from './CopyButton'
import StatChip from './StatChip'

function formatDuration(ms) {
  if (!ms) return '--'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export default function ComparePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('missing')
  const [copiedId, setCopiedId] = useState(null)

  const runCompare = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setData(null)
    setCopiedId(null)
    try {
      const r = await fetch('/api/spotify/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_url: url.trim() }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.detail || 'Failed to compare')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = data?.results.filter(r => {
    if (filter === 'all') return true
    if (filter === 'missing') return r.match === null
    if (filter === 'uncertain') return r.match?.status === 'uncertain'
    if (filter === 'match') return r.match?.status === 'match'
    return true
  }) || []

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-2 border-b border-border px-5 py-3.5">
        <Input
          type="text"
          placeholder="Paste a Spotify playlist URL (e.g. https://open.spotify.com/playlist/…)"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runCompare()}
          disabled={loading}
        />
        <Button onClick={runCompare} disabled={loading || !url.trim()}>
          {loading ? 'Comparing…' : 'Compare'}
        </Button>
      </div>

      {error && (
        <div className="border-b border-border px-5 py-3 text-sm text-destructive">
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <>
          <div className="shrink-0 border-b border-border px-5 py-3.5">
            <div className="mb-2.5 text-sm">
              <strong className="mr-2 font-semibold">{data.playlist.name}</strong>
              {data.playlist.owner && (
                <span className="text-xs text-muted-foreground">by {data.playlist.owner}</span>
              )}
              <span className="text-xs text-muted-foreground">{data.playlist.track_count} tracks</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatChip tone="missing" active={filter === 'missing'} count={data.summary.missing} label="missing" onClick={() => setFilter('missing')} />
              <StatChip tone="uncertain" active={filter === 'uncertain'} count={data.summary.uncertain} label="uncertain" onClick={() => setFilter('uncertain')} />
              <StatChip tone="match" active={filter === 'match'} count={data.summary.match} label="in library" onClick={() => setFilter('match')} />
              <StatChip tone="all" active={filter === 'all'} count={data.summary.total} label="total" onClick={() => setFilter('all')} />
            </div>
          </div>

          {filteredResults.length === 0 ? (
            <div className="p-10 text-sm text-muted-foreground">
              {filter === 'missing' && <p>Nothing missing — every track in this playlist is already in your library.</p>}
              {filter === 'uncertain' && <p>No uncertain matches.</p>}
              {filter === 'match' && <p>No matched tracks.</p>}
              {filter === 'all' && <p>Playlist is empty.</p>}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Spotify Track</TableHead>
                    <TableHead>Match in Library</TableHead>
                    <TableHead className="w-16 text-right">Score</TableHead>
                    <TableHead className="w-16 text-right">Dur</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((r, i) => (
                    <TableRow key={r.track.id || i}>
                      <TableCell className="align-top">
                        <StatusBadge status={r.match?.status || 'missing'} />
                      </TableCell>
                      <TableCell className="max-w-0 align-top">
                        <a
                          className="group/link flex items-center gap-1 truncate text-foreground/90 hover:text-[#1db954]"
                          href={r.track.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Spotify"
                        >
                          <span className="truncate">{r.track.title}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
                        </a>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {r.track.artist}
                          {r.track.album && <> · <span className="text-muted-foreground/60">{r.track.album}</span></>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0 align-top">
                        {r.match ? (
                          <>
                            <div className="truncate text-foreground/90">{r.match.local_track.title}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{r.match.local_track.artist}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums text-muted-foreground">
                        {r.match ? `${r.match.score}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums text-muted-foreground">
                        {formatDuration(r.track.duration_ms)}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <CopyButton
                          text={`${r.track.title} ${r.track.artist}`}
                          isCopied={copiedId === r.track.id}
                          onCopy={() => setCopiedId(r.track.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="p-10 text-sm text-muted-foreground">
          <p>Paste any public Spotify playlist URL above to compare it against your Rekordbox library — your own, someone else's, or a Spotify editorial playlist. No login needed.</p>
          <p className="mt-2 text-muted-foreground/60">
            Fuzzy matching is used to handle small differences in titles, featured artist tags, remix labels, etc.
          </p>
        </div>
      )}
    </main>
  )
}
