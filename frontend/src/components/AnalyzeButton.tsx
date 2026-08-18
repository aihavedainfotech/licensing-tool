import { useState } from 'react'
import { ArrowRight, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFiles } from '../context/FileContext'

const SERVER_URL = 'http://localhost:3001'

interface AnalyzeButtonProps {
  uploadedCount: number
}

export default function AnalyzeButton({ uploadedCount }: AnalyzeButtonProps) {
  const [processing, setProcessing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const navigate   = useNavigate()
  const { s3Keys } = useFiles()

  const xlsxKey      = s3Keys[0] ?? null
  const summaryKey   = s3Keys[1] ?? null
  const statusKey    = s3Keys[2] ?? null
  const hasXlsx      = !!xlsxKey
  const isEnabled    = hasXlsx && !processing

  async function handleClick() {
    if (!isEnabled || !xlsxKey) return
    setProcessing(true)
    setError(null)

    try {
      const resp = await fetch(`${SERVER_URL}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xlsxS3Key: xlsxKey, summaryS3Key: summaryKey, statusS3Key: statusKey }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Processing failed' }))
        throw new Error(err.error || `Server error ${resp.status}`)
      }

      setProcessing(false)
      navigate('/results')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Processing failed'
      setError(msg)
      setProcessing(false)
    }
  }

  const allLabel = 'Analyse Document'

  let badgeColor = '#fffbeb'
  let badgeText = '#d97706'
  let badgeBorder = '#fde68a'
  let dotColor = '#fbbf24'
  let badgeMessage = 'Document uploaded — ready to analyse!'

  if (hasXlsx) {
    badgeColor = '#f0fdf4'
    badgeText = '#059669'
    badgeBorder = '#bbf7d0'
    dotColor = '#34d399'
    badgeMessage = `Document uploaded — ready to analyse!`
  } 

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status badge */}
      {uploadedCount > 0 && !processing && !error && (
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold animate-fade-in-up"
          style={{
            background: badgeColor,
            color:      badgeText,
            border:     `1px solid ${badgeBorder}`,
          }}>
          <span className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
          {badgeMessage}
        </div>
      )}

      {/* Main CTA */}
      <button
        onClick={handleClick}
        disabled={!isEnabled}
        className="w-full flex items-center justify-center gap-2 px-10 py-4 rounded-xl text-[16px] font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[#ba6017] hover:bg-[#a65615] shadow-sm"
        style={{ fontSize: '15px', letterSpacing: '0.01em' }}
      >
        {processing ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Analysing your data…</span>
          </>
        ) : (
          <>
            <span>Analyse Documents</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>

      {processing && (
        <div className="flex flex-col items-center gap-3 animate-fade-in-up">
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-1.5 rounded-full"
                style={{ background: `hsl(${200 + i * 8}, 70%, 50%)`, animation: `float ${0.6 + i * 0.1}s ease-in-out ${i * 0.1}s infinite`, height: '20px' }} />
            ))}
          </div>
          <p className="text-xs font-medium" style={{ color: '#64748b' }}>Parsing your XLSX and building licence hierarchy…</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl max-w-sm text-xs animate-fade-in-up"
          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Hint when files are missing */}
      {!hasXlsx && !processing && uploadedCount === 0 && (
        <p className="text-[13px] font-medium text-center" style={{ color: '#6d5f53' }}>
          Upload your XLSX users and roles document to begin
        </p>
      )}
    </div>
  )
}

