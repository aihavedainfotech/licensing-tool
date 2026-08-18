import { useCallback, useRef, useState } from 'react'
import {
  Upload, FileText, CheckCircle2, X, AlertCircle,
  RotateCcw, XCircle
} from 'lucide-react'

// ── Config ─────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────
type CardState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error'

interface FileInfo {
  file: File
  name: string
  size: number
  type: string
  s3Key?: string
}

interface UploadCardProps {
  index: number
  title: string
  description?: string
  onFileChange: (index: number, file: File | null, s3Key?: string) => void
  existingFiles: (File | null)[]
  acceptedTypes?: string[]
  acceptedExts?: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────
const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.ms-excel',
]
const DEFAULT_ACCEPTED_EXT = ['.pdf', '.docx', '.xlsx', '.csv']

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function validateFile(
  file: File,
  existingFiles: (File | null)[],
  currentIndex: number,
  allowedTypes: string[],
  allowedExts: string[]
): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
    return `Unsupported file type. Please upload ${allowedExts.join(', ').toUpperCase()}.`
  }
  const duplicate = existingFiles.some(
    (f, i) => i !== currentIndex && f && f.name === file.name && f.size === file.size,
  )
  if (duplicate) {
    return 'This file has already been added.'
  }
  return null
}

// ── Component ──────────────────────────────────────────────────────────────
export default function UploadCard({ 
  index, title, description, onFileChange, existingFiles,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  acceptedExts = DEFAULT_ACCEPTED_EXT
}: UploadCardProps) {
  const [cardState, setCardState] = useState<CardState>('idle')
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const xhrRef    = useRef<XMLHttpRequest | null>(null)

  // ── S3 upload ─────────────────────────────────────
  async function uploadToS3(file: File) {
    setCardState('uploading')
    setProgress(0)

    try {
      const resp = await fetch(`${SERVER_URL}/api/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Server error' }))
        throw new Error(err.error || `Server responded ${resp.status}`)
      }

      const { uploadUrl, s3Key } = await resp.json()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`S3 returned status ${xhr.status}.`))
        })

        xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')))

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.send(file)
      })

      setProgress(100)
      setCardState('success')
      setFileInfo(prev => prev ? { ...prev, s3Key } : prev)
      onFileChange(index, file, s3Key)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      if (msg.includes('cancelled')) return
      setErrorMsg(msg)
      setCardState('error')
    }
  }

  function processFile(file: File) {
    const err = validateFile(file, existingFiles, index, acceptedTypes, acceptedExts)
    if (err) {
      setErrorMsg(err)
      setCardState('error')
      return
    }
    setErrorMsg(null)
    setFileInfo({ file, name: file.name, size: file.size, type: file.type })
    uploadToS3(file)
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (cardState === 'idle') setCardState('dragging')
  }, [cardState])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (cardState === 'dragging') setCardState('idle')
  }, [cardState])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (cardState === 'dragging') setCardState('idle')
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [existingFiles, cardState])

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function cancelUpload() {
    xhrRef.current?.abort()
    xhrRef.current = null
    setCardState('idle')
    setProgress(0)
    setFileInfo(null)
    onFileChange(index, null)
  }

  function removeFile() {
    setCardState('idle')
    setProgress(0)
    setFileInfo(null)
    setErrorMsg(null)
    onFileChange(index, null)
  }

  return (
    <div 
      className={`w-full flex items-center justify-between p-2 rounded-xl transition-colors ${cardState === 'dragging' ? 'bg-blue-50' : 'bg-transparent'}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex-1 min-w-0 pr-4 pl-2">
        {cardState === 'idle' || cardState === 'dragging' ? (
          <>
            <h3 className="font-bold text-[16px]" style={{ color: '#31231a' }}>{title}</h3>
            <p className="text-[13px] mt-0.5 font-medium" style={{ color: '#6d5f53' }}>{description}</p>
          </>
        ) : cardState === 'uploading' ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-[15px] text-slate-800">{fileInfo?.name}</h3>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : cardState === 'success' ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-[15px] text-slate-800 truncate">{fileInfo?.name}</h3>
              <p className="text-[13px] text-slate-500 mt-0.5">{fileInfo ? formatBytes(fileInfo.size) : ''}</p>
            </div>
          </div>
        ) : cardState === 'error' ? (
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-[15px] text-red-600 truncate">Upload Failed</h3>
              <p className="text-[13px] text-red-400 mt-0.5 truncate">{errorMsg}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-shrink-0 pr-2">
        {(cardState === 'idle' || cardState === 'dragging' || cardState === 'error') && (
          <button 
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-bold transition-colors hover:bg-black/5"
            style={{ border: '1px solid #efebe4', color: '#31231a' }}
          >
            <Upload size={16} style={{ color: '#6d5f53' }} /> Choose File
          </button>
        )}
        {cardState === 'uploading' && (
          <button onClick={cancelUpload} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <XCircle size={20} />
          </button>
        )}
        {cardState === 'success' && (
          <button onClick={removeFile} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptedExts.join(',')}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
