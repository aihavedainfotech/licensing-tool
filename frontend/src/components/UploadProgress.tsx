interface UploadProgressProps {
  progress: number
  uploadedBytes: number
  totalBytes: number
  speedBps: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatSpeed(bps: number): string {
  if (bps === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bps) / Math.log(k))
  return parseFloat((bps / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatEta(remaining: number, bps: number): string {
  if (!bps || !remaining) return '—'
  const seconds = remaining / bps
  if (seconds < 60) return `${Math.round(seconds)}s`
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  return `${min}m ${sec}s`
}

export default function UploadProgress({
  progress,
  uploadedBytes,
  totalBytes,
  speedBps,
}: UploadProgressProps) {
  const remaining = totalBytes - uploadedBytes
  const pct = Math.min(progress, 100)

  // Build block bar (20 blocks)
  const totalBlocks = 20
  const filledBlocks = Math.round((pct / 100) * totalBlocks)
  const blockBar = Array.from({ length: totalBlocks }, (_, i) => i < filledBlocks)

  return (
    <div className="flex flex-col gap-3">
      {/* Percentage + label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: '#475569' }}>
          Uploading...
        </span>
        <span className="text-sm font-700" style={{ color: '#1d6fa4', fontWeight: 700 }}>
          {pct}%
        </span>
      </div>

      {/* Smooth progress bar */}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Block bar */}
      <div className="flex gap-0.5">
        {blockBar.map((filled, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-sm transition-all duration-300"
            style={{
              background: filled
                ? `hsl(${200 + (i / totalBlocks) * 25}, 75%, ${45 + (i / totalBlocks) * 15}%)`
                : '#e2e8f0',
            }}
          />
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <span style={{ color: '#94a3b8' }}>Transferred</span>
          <span className="font-semibold" style={{ color: '#1a2b4a' }}>
            {formatBytes(uploadedBytes)}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '10px' }}>
            / {formatBytes(totalBytes)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ color: '#94a3b8' }}>Speed</span>
          <span className="font-semibold" style={{ color: '#1a2b4a' }}>
            {formatSpeed(speedBps)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ color: '#94a3b8' }}>ETA</span>
          <span className="font-semibold" style={{ color: '#1a2b4a' }}>
            {formatEta(remaining, speedBps)}
          </span>
        </div>
      </div>
    </div>
  )
}
