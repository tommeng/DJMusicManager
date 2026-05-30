import { useState, useEffect } from 'react'
import PlaylistPanel from './components/PlaylistPanel'
import TrackPanel from './components/TrackPanel'
import ComparePage from './components/ComparePage'
import './App.css'

function App() {
  const [view, setView] = useState('library')
  const [tree, setTree] = useState([])
  const [selected, setSelected] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const isSearching = searchQuery.trim().length > 0

  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)

  useEffect(() => {
    fetch('/api/playlists')
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.detail || 'Failed to load library')
        return data
      })
      .then(data => {
        setTree(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(data => {
          setSearchResults(data)
          setSearching(false)
        })
        .catch(err => {
          console.error(err)
          setSearching(false)
        })
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const refreshLibrary = async () => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const r = await fetch('/api/library/refresh', { method: 'POST' })
      const json = await r.json()
      if (!r.ok) throw new Error(json.detail || 'Refresh failed')
      const treeRes = await fetch('/api/playlists')
      const treeJson = await treeRes.json()
      if (!treeRes.ok) throw new Error(treeJson.detail || 'Failed to load playlists')
      setTree(treeJson)
      setSelected(null)
      setTracks([])
    } catch (e) {
      setRefreshError(e.message)
    } finally {
      setRefreshing(false)
    }
  }

  const selectPlaylist = (playlist) => {
    setSearchQuery('')
    setSelected(playlist)
    setTracks([])
    fetch(`/api/playlists/${playlist.id}/tracks`)
      .then(r => r.json())
      .then(setTracks)
      .catch(console.error)
  }

  const renderTrackPanel = () => {
    if (isSearching) {
      const q = searchQuery.trim()
      const subtitle = searching ? 'Searching…' : `${searchResults.length} matches`
      return (
        <TrackPanel
          title={`Search: "${q}"`}
          subtitle={subtitle}
          tracks={searchResults}
        />
      )
    }
    return <TrackPanel title={selected?.name} tracks={tracks} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>DJ Music Manager</h1>
        <nav className="app-nav">
          <button
            className={view === 'library' ? 'active' : ''}
            onClick={() => setView('library')}
          >Library</button>
          <button
            className={view === 'compare' ? 'active' : ''}
            onClick={() => setView('compare')}
          >Compare</button>
        </nav>
      </header>
      <div className="app-body">
        {view === 'library' && (
          <>
            {loading && <div className="status">Loading library...</div>}
            {error && (
              <div className="status error">
                <strong>Could not load Rekordbox library</strong>
                <p>{error}</p>
                <p className="hint">
                  Make sure Rekordbox is <strong>closed</strong> (the database is locked while it's running),
                  then restart the backend. If the encryption key is missing, run{' '}
                  <code>python -m pyrekordbox download-key</code> once from the backend venv.
                </p>
              </div>
            )}
            {!loading && !error && (
              <>
                <PlaylistPanel
                  tree={tree}
                  selected={selected}
                  onSelect={selectPlaylist}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onRefresh={refreshLibrary}
                  refreshing={refreshing}
                  refreshError={refreshError}
                />
                {renderTrackPanel()}
              </>
            )}
          </>
        )}
        {view === 'compare' && <ComparePage />}
      </div>
    </div>
  )
}

export default App
