import { useState } from 'react'

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
        className={`tree-row ${isFolder ? 'folder' : 'playlist'} ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={handleClick}
      >
        <span className="tree-icon">
          {isFolder ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="tree-name">{node.name}</span>
        {!isFolder && (
          <span className="tree-count">{node.track_count}</span>
        )}
      </div>
      {isFolder && expanded && hasChildren && (
        node.children.map(child => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))
      )}
    </>
  )
}

function PlaylistPanel({ tree, selected, onSelect, searchQuery, onSearchChange, onRefresh, refreshing, refreshError }) {
  return (
    <aside className="playlist-panel">
      <div className="playlist-panel-search">
        <input
          type="text"
          placeholder="Search library..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => onSearchChange('')}
            title="Clear search"
          >×</button>
        )}
      </div>
      <div className="playlist-panel-header">
        <span>Playlists</span>
        <button
          className="refresh-btn"
          onClick={onRefresh}
          disabled={refreshing}
          title={refreshError || 'Reload from Rekordbox (close Rekordbox first)'}
        >
          {refreshing ? '…' : '↻'}
        </button>
      </div>
      {refreshError && (
        <div className="refresh-error" title={refreshError}>{refreshError}</div>
      )}
      <div className="tree">
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
