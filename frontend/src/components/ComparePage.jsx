import { useState, useEffect } from 'react'

function formatDuration(ms) {
  if (!ms) return '--'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function StatusBadge({ status }) {
  if (status === 'match')     return <span className="badge ok">✓ Match</span>
  if (status === 'uncertain') return <span className="badge warn">? Uncertain</span>
  return <span className="badge miss">✗ Missing</span>
}

function CopyButton({ text, isCopied, onCopy }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      onCopy()
    } catch (e) {
      console.error('Copy failed', e)
    }
  }
  return (
    <button className={`copy-btn ${isCopied ? 'copied' : ''}`} onClick={copy} title={`Copy: ${text}`}>
      {isCopied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function ComparePage() {
  const [authStatus, setAuthStatus] = useState({ configured: false, authenticated: false })
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('missing')
  const [copiedId, setCopiedId] = useState(null)

  const refreshAuth = () => {
    fetch('/api/status').then(r => r.json()).then(s => {
      setAuthStatus({
        configured: s.spotify_configured,
        authenticated: s.spotify_authenticated,
      })
    })
  }

  useEffect(() => {
    refreshAuth()
    // Handle redirect from /callback
    const params = new URLSearchParams(window.location.search)
    if (params.get('spotify_connected') || params.get('spotify_error')) {
      if (params.get('spotify_error')) {
        setError(`Spotify auth failed: ${params.get('spotify_error')}`)
      }
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const connect = async () => {
    const r = await fetch('/api/spotify/auth-url')
    const { url } = await r.json()
    window.location.href = url
  }

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

  if (!authStatus.configured) {
    return (
      <main className="compare-page">
        <div className="status error">
          <strong>Spotify credentials missing</strong>
          <p className="hint">
            Add <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code> to{' '}
            <code>backend/.env</code> and restart the backend.
          </p>
        </div>
      </main>
    )
  }

  if (!authStatus.authenticated) {
    return (
      <main className="compare-page">
        <div className="connect-spotify">
          <h2>Connect Spotify</h2>
          <p className="muted">
            Spotify requires a one-time login to access playlist contents. You'll be redirected to
            Spotify, then back to this app once you authorize.
          </p>
          {error && <div className="status error" style={{padding:0, marginBottom:16}}>{error}</div>}
          <button className="primary" onClick={connect}>Connect Spotify</button>
        </div>
      </main>
    )
  }

  return (
    <main className="compare-page">
      <div className="compare-input">
        <input
          type="text"
          placeholder="Paste a Spotify playlist URL (e.g. https://open.spotify.com/playlist/...)"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runCompare()}
          disabled={loading}
        />
        <button onClick={runCompare} disabled={loading || !url.trim()}>
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {error && <div className="status error"><strong>Error:</strong> {error}</div>}

      {data && (
        <>
          <div className="compare-summary">
            <div className="summary-title">
              <strong>{data.playlist.name}</strong>
              <span className="muted">by {data.playlist.owner}</span>
            </div>
            <div className="summary-stats">
              <button className={`stat miss ${filter==='missing'?'active':''}`} onClick={()=>setFilter('missing')}>
                <span className="stat-n">{data.summary.missing}</span> missing
              </button>
              <button className={`stat warn ${filter==='uncertain'?'active':''}`} onClick={()=>setFilter('uncertain')}>
                <span className="stat-n">{data.summary.uncertain}</span> uncertain
              </button>
              <button className={`stat ok ${filter==='match'?'active':''}`} onClick={()=>setFilter('match')}>
                <span className="stat-n">{data.summary.match}</span> in library
              </button>
              <button className={`stat ${filter==='all'?'active':''}`} onClick={()=>setFilter('all')}>
                <span className="stat-n">{data.summary.total}</span> total
              </button>
            </div>
          </div>

          {filteredResults.length === 0 && (
            <div className="compare-empty">
              {filter === 'missing' && <p>Nothing missing — every track in this playlist is already in your library.</p>}
              {filter === 'uncertain' && <p>No uncertain matches.</p>}
              {filter === 'match' && <p>No matched tracks.</p>}
              {filter === 'all' && <p>Playlist is empty.</p>}
            </div>
          )}
          {filteredResults.length > 0 && (
          <div className="compare-table-container">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="col-status">Status</th>
                  <th>Spotify Track</th>
                  <th>Match in Library</th>
                  <th className="col-score">Score</th>
                  <th className="col-dur">Dur</th>
                  <th className="col-copy"></th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, i) => (
                  <tr key={r.spotify.id || i}>
                    <td className="col-status">
                      <StatusBadge status={r.match?.status || 'missing'} />
                    </td>
                    <td>
                      <a
                        className="track-title-link"
                        href={r.spotify.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Spotify"
                      >
                        {r.spotify.title}
                      </a>
                      <div className="track-meta">
                        {r.spotify.artist}
                        {r.spotify.album && <> · <span className="album">{r.spotify.album}</span></>}
                      </div>
                    </td>
                    <td>
                      {r.match ? (
                        <>
                          <div className="track-title">{r.match.local_track.title}</div>
                          <div className="track-meta">{r.match.local_track.artist}</div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="col-score">
                      {r.match ? `${r.match.score}%` : '—'}
                    </td>
                    <td className="col-dur">{formatDuration(r.spotify.duration_ms)}</td>
                    <td className="col-copy">
                      <CopyButton
                        text={`${r.spotify.title} ${r.spotify.artist}`}
                        isCopied={copiedId === r.spotify.id}
                        onCopy={() => setCopiedId(r.spotify.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="compare-empty">
          <p>Paste a public Spotify playlist URL above to compare it against your Rekordbox library.</p>
          <p className="muted">Fuzzy matching is used to handle small differences in titles, featured artist tags, remix labels, etc.</p>
        </div>
      )}
    </main>
  )
}
