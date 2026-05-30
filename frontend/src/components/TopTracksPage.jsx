import { useState, useEffect } from 'react'

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

function StatusBadge({ status }) {
  if (status === 'match')     return <span className="badge ok">✓ In library</span>
  if (status === 'uncertain') return <span className="badge warn">? Maybe</span>
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

  const changeGenre = (e) => {
    const g = e.target.value
    setGenre(g)
    load(g)
  }

  const filtered = data?.results.filter(r => {
    if (libFilter === 'all') return true
    if (libFilter === 'missing') return r.match === null
    return r.match?.status === libFilter
  }) || []

  return (
    <main className="compare-page">
      <div className="compare-input">
        <span className="muted" style={{ flex: 1 }}>
          {data
            ? `${data.source} — ${data.country} · updated daily`
            : 'Apple Music — Top Songs'}
        </span>
        <select className="genre-select" value={genre} onChange={changeGenre} disabled={loading}>
          {GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <button onClick={() => load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="status error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <>
          <div className="compare-summary">
            <div className="summary-stats">
              <button className={`stat miss ${libFilter==='missing'?'active':''}`} onClick={()=>setLibFilter('missing')}>
                <span className="stat-n">{data.summary.missing}</span> missing
              </button>
              <button className={`stat warn ${libFilter==='uncertain'?'active':''}`} onClick={()=>setLibFilter('uncertain')}>
                <span className="stat-n">{data.summary.uncertain}</span> maybe
              </button>
              <button className={`stat ok ${libFilter==='match'?'active':''}`} onClick={()=>setLibFilter('match')}>
                <span className="stat-n">{data.summary.match}</span> in library
              </button>
              <button className={`stat ${libFilter==='all'?'active':''}`} onClick={()=>setLibFilter('all')}>
                <span className="stat-n">{data.summary.total}</span> total
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="compare-empty"><p>No tracks match the current filter.</p></div>
          ) : (
            <div className="compare-table-container">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th className="col-num">#</th>
                    <th className="col-status">Status</th>
                    <th>Track</th>
                    <th>Genre</th>
                    <th>Match in Library</th>
                    <th className="col-score">Score</th>
                    <th className="col-copy"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.track.id || i}>
                      <td className="col-num">{r.track.rank}</td>
                      <td className="col-status"><StatusBadge status={r.match?.status || 'missing'} /></td>
                      <td>
                        <a className="track-title-link" href={r.track.url} target="_blank" rel="noopener noreferrer" title="Open in Apple Music">
                          {r.track.title}
                        </a>
                        <div className="track-meta">{r.track.artist}</div>
                      </td>
                      <td>
                        {(r.track.genres || []).length > 0
                          ? r.track.genres.map(g => <span key={g} className="genre-tag">{g}</span>)
                          : <span className="muted">—</span>}
                      </td>
                      <td>
                        {r.match ? (
                          <>
                            <div className="track-title">{r.match.local_track.title}</div>
                            <div className="track-meta">{r.match.local_track.artist}</div>
                          </>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td className="col-score">{r.match ? `${r.match.score}%` : '—'}</td>
                      <td className="col-copy">
                        <CopyButton
                          text={`${r.track.title} ${r.track.artist}`}
                          isCopied={copiedId === r.track.id}
                          onCopy={() => setCopiedId(r.track.id)}
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

      {!data && loading && <div className="compare-empty"><p>Loading Top 100…</p></div>}
    </main>
  )
}
