import { ListMusic } from 'lucide-react'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'

function formatDuration(seconds) {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TrackPanel({ title, subtitle, tracks, emptyMessage }) {
  if (!title) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/50">
        <ListMusic className="size-8" strokeWidth={1.5} />
        <p className="text-sm">{emptyMessage || 'Select a playlist'}</p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2.5 border-b border-border px-5 py-3">
        <h2 className="truncate text-[15px] font-semibold">{title}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {subtitle ?? `${tracks.length} tracks`}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-right">#</TableHead>
              <TableHead className="w-[35%]">Title</TableHead>
              <TableHead className="w-[25%]">Artist</TableHead>
              <TableHead className="w-20 text-right">BPM</TableHead>
              <TableHead className="w-16">Key</TableHead>
              <TableHead className="w-20 text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracks.map((track, i) => (
              <TableRow key={`${track.id}-${i}`}>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground/50">
                  {i + 1}
                </TableCell>
                <TableCell className="max-w-0 truncate font-medium text-foreground/90">
                  {track.title}
                </TableCell>
                <TableCell className="max-w-0 truncate text-muted-foreground">
                  {track.artist}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {track.bpm ? parseFloat(track.bpm).toFixed(1) : '--'}
                </TableCell>
                <TableCell className="text-muted-foreground">{track.key || '--'}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatDuration(track.duration)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}

export default TrackPanel
