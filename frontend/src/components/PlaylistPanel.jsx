import { useState } from 'react'
import {
  Search, X, RefreshCw, ChevronRight, ChevronDown,
  Folder, FolderOpen, ListMusic,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function TreeNode({ node, depth, selectedId, onSelect }) {
  const [expanded, setExpanded] = useState(true)
  const isFolder = node.type === 'folder'
  const hasChildren = node.children && node.children.length > 0
  const isActive = !isFolder && selectedId === node.id

  const handleClick = () => {
    if (isFolder) setExpanded(!expanded)
    else onSelect(node)
  }

  return (
    <>
      <div
        className={cn(
          'group relative flex h-8 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-[13px] text-foreground/80 transition-colors select-none',
          'hover:bg-accent/50',
          isActive && 'bg-primary/15 text-foreground hover:bg-primary/15'
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={handleClick}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
        )}
        <span className="flex w-3.5 shrink-0 items-center justify-center text-muted-foreground/70">
          {isFolder ? (
            expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />
          ) : null}
        </span>
        <span className={cn('shrink-0', isFolder ? 'text-muted-foreground/70' : 'text-primary/70')}>
          {isFolder ? (
            expanded ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />
          ) : (
            <ListMusic className="size-3.5" />
          )}
        </span>
        <span
          className={cn(
            'flex-1 truncate',
            isFolder && 'font-medium text-muted-foreground'
          )}
        >
          {node.name}
        </span>
        {!isFolder && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
            {node.track_count}
          </span>
        )}
      </div>
      {isFolder && expanded && hasChildren &&
        node.children.map(child => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

function PlaylistPanel({ tree, selected, onSelect, searchQuery, onSearchChange, onRefresh, refreshing, refreshError }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar">
      <div className="relative shrink-0 border-b border-border p-2.5">
        <Search className="pointer-events-none absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          type="text"
          placeholder="Search library…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="h-8 pl-8 pr-7 text-[13px]"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            title="Clear search"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Playlists
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={refreshing}
          title={refreshError || 'Reload from Rekordbox (close Rekordbox first)'}
          className="text-muted-foreground/70"
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {refreshError && (
        <div
          className="shrink-0 truncate border-b border-border bg-destructive/15 px-3 py-2 text-[11px] text-[oklch(0.72_0.19_25)]"
          title={refreshError}
        >
          {refreshError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-1.5">
        {tree.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            selectedId={selected?.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  )
}

export default PlaylistPanel
