import { useState, useEffect } from 'react'
import { Disc3, Library, GitCompareArrows, Flame } from 'lucide-react'
import PlaylistPanel from './components/PlaylistPanel'
import TrackPanel from './components/TrackPanel'
import ComparePage from './components/ComparePage'
import TopTracksPage from './components/TopTracksPage'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border bg-sidebar/60 px-5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Disc3 className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">DJ Music Manager</span>
        </div>
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="library"><Library className="size-3.5" /> Library</TabsTrigger>
            <TabsTrigger value="compare"><GitCompareArrows className="size-3.5" /> Compare</TabsTrigger>
            <TabsTrigger value="top100"><Flame className="size-3.5" /> Top 100</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {view === 'library' && (
          <>
            {loading && (
              <div className="p-10 text-sm text-muted-foreground">Loading library…</div>
            )}
            {error && (
              <div className="max-w-xl p-10 text-sm leading-relaxed">
                <strong className="mb-2 block text-[15px] text-destructive">
                  Could not load Rekordbox library
                </strong>
                <p className="mb-1.5 text-muted-foreground">{error}</p>
                <p className="mt-4 rounded-md border-l-2 border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
                  Make sure Rekordbox is <strong>closed</strong> (the database is locked while it's
                  running), then restart the backend. If the encryption key is missing, run{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                    python -m pyrekordbox download-key
                  </code>{' '}
                  once from the backend venv.
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
        {view === 'top100' && <TopTracksPage />}
      </div>
    </div>
  )
}

export default App
