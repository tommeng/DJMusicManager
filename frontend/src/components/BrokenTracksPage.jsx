import { useState, useEffect } from 'react'
import { RefreshCw, FileX, Unlink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import StatChip from './StatChip'
import CopyButton from './CopyButton'
import { cn } from '@/lib/utils'

const REASON = {
  file_missing: { label: 'File missing', icon: FileX },
  no_file: { label: 'No file', icon: Unlink },
}

export default function BrokenTracksPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [copiedId, setCopiedId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/library/broken')
      const json = await r.json()
      if (!r.ok) throw new Error(json.detail || 'Failed to scan library')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = data?.tracks.filter(
    t => filter === 'all' || t.broken_reason === filter
  ) || []

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="flex-1 truncate text-xs text-muted-foreground">
          {data
            ? `Scanned ${data.summary.total} tracks — ${data.summary.broken} broken`
            : 'Scanning library…'}
        </span>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          {loading ? 'Scanning…' : 'Rescan'}
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
              <StatChip tone="missing" active={filter === 'file_missing'} count={data.summary.file_missing} label="file missing" onClick={() => setFilter('file_missing')} />
              <StatChip tone="uncertain" active={filter === 'no_file'} count={data.summary.no_file} label="no file" onClick={() => setFilter('no_file')} />
              <StatChip tone="all" active={filter === 'all'} count={data.summary.broken} label="broken" onClick={() => setFilter('all')} />
            </div>
          </div>

          {data.summary.broken === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/60">
              <CheckCircle2 className="size-8" strokeWidth={1.5} />
              <p className="text-sm">No broken tracks — every file is backed on disk.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-sm text-muted-foreground">
              <p>No tracks match the current filter.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 text-right">#</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead>Track</TableHead>
                    <TableHead>File path</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t, i) => {
                    const meta = REASON[t.broken_reason] || REASON.file_missing
                    const Icon = meta.icon
                    return (
                      <TableRow key={`${t.id}-${i}`}>
                        <TableCell className="text-right align-top tabular-nums text-muted-foreground/50">
                          {i + 1}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="destructive">
                            <Icon />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-0 align-top">
                          <div className="truncate font-medium text-foreground/90">{t.title || '(untitled)'}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.artist}</div>
                        </TableCell>
                        <TableCell className="max-w-0 align-top">
                          {t.path ? (
                            <span className="block truncate font-mono text-xs text-muted-foreground" title={t.path}>{t.path}</span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <CopyButton
                            text={t.path || `${t.title} ${t.artist}`}
                            isCopied={copiedId === t.id}
                            onCopy={() => setCopiedId(t.id)}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {!data && loading && (
        <div className="p-10 text-sm text-muted-foreground"><p>Scanning library…</p></div>
      )}
    </main>
  )
}
