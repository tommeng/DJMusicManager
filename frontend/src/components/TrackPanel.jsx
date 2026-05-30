function formatDuration(seconds) {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TrackPanel({ title, subtitle, tracks, emptyMessage }) {
  if (!title) {
    return (
      <main className="track-panel empty">
        <p>{emptyMessage || 'Select a playlist'}</p>
      </main>
    )
  }

  return (
    <main className="track-panel">
      <div className="track-panel-header">
        <h2>{title}</h2>
        <span className="track-count">{subtitle ?? `${tracks.length} tracks`}</span>
      </div>
      <div className="track-table-container">
        <table>
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-title">Title</th>
              <th className="col-artist">Artist</th>
              <th className="col-bpm">BPM</th>
              <th className="col-key">Key</th>
              <th className="col-duration">Duration</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, i) => (
              <tr key={`${track.id}-${i}`}>
                <td className="col-num">{i + 1}</td>
                <td className="col-title">{track.title}</td>
                <td className="col-artist">{track.artist}</td>
                <td className="col-bpm">
                  {track.bpm ? parseFloat(track.bpm).toFixed(1) : '--'}
                </td>
                <td className="col-key">{track.key || '--'}</td>
                <td className="col-duration">{formatDuration(track.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

export default TrackPanel
