import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import StatusBadge from './StatusBadge'
import CopyButton from './CopyButton'
import StatChip from './StatChip'
import { cn } from '@/lib/utils'

const GENRES = [
  { id: '', label: 'Overall' },
  { id: '18', label: 'Hip-Hop/Rap' },
  { id: '15', label: 'R&B/Soul' },
  { id: '14', label: 'Pop' },
  { id: '17', label: 'Dance' },
  { id: '7', label: 'Electronic' },
  { id: '24', label: 'Reggae' },
  { id: '12', label: 'Latino' },
  { id: '21', label: 'Rock' },
  { id: '6', label: 'Country' },
]

const STATUS_LABELS = { match: 'In library', uncertain: 'Maybe', missing: 'Missing' }

export default function TopTracksPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [libFilter, setLibFilter] = useState('all')
  const [genre, setGenre] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const load = async (genreId = genre) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/top100?genre=${encodeURIComponent(genreId)}`)
      const json = await r.json()
      if (!r.ok) throw new Error(json.detail || 'Failed to load Top 100')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const changeGenre = (g) => {
    setGenre(g)
    load(g)
  }

  const filtered = data?.results.filter(r => {
    if (libFilter === 'all') return true
    if (libFilter === 'missing') return r.match === null
    return r.match?.status === libFilter
  }) || []

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="flex-1 truncate text-xs text-muted-foreground">
          {data ? `${data.source} — ${data.country} · updated daily` : 'Apple Music — Top Songs'}
        </span>
        <Select
          value={genre || 'overall'}
          onValueChange={v => changeGenre(v === 'overall' ? '' : v)}
          disabled={loading}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GENRES.map(g => (
              <SelectItem key={g.id || 'overall'} value={g.id || 'overall'}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          {loading ? 'Loading…' : 'Refresh'}
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
            <div className="flex flex-wrap gap-2">
              <StatChip tone="missing" active={libFilter === 'missing'} count={data.summary.missing} label="missing" onClick={() => setLibFilter('missing')} />
              <StatChip tone="uncertain" active={libFilter === 'uncertain'} count={data.summary.uncertain} label="maybe" onClick={() => setLibFilter('uncertain')} />
              <StatChip tone="match" active={libFilter === 'match'} count={data.summary.match} label="in library" onClick={() => setLibFilter('match')} />
              <StatChip tone="all" active={libFilter === 'all'} count={data.summary.total} label="total" onClick={() => setLibFilter('all')} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-sm text-muted-foreground">
              <p>No tracks match the current filter.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 text-right">#</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Track</TableHead>
                    <TableHead className="w-44">Genre</TableHead>
                    <TableHead>Match in Library</TableHead>
                    <TableHead className="w-16 text-right">Score</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow key={r.track.id || i}>
                      <TableCell className="text-right align-top tabular-nums text-muted-foreground/60">
                        {r.track.rank}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge status={r.match?.status || 'missing'} labels={STATUS_LABELS} />
                      </TableCell>
                      <TableCell className="max-w-0 align-top">
                        <a
                          className="group/link flex items-center gap-1 truncate text-foreground/90 hover:text-[#1db954]"
                          href={r.track.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Apple Music"
                        >
                          <span className="truncate">{r.track.title}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
                        </a>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{r.track.artist}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        {(r.track.genres || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.track.genres.map(g => (
                              <Badge key={g} variant="secondary" className="font-normal">{g}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
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

      {!data && loading && (
        <div className="p-10 text-sm text-muted-foreground"><p>Loading Top 100…</p></div>
      )}
    </main>
  )
}
