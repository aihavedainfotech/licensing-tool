import { useState } from 'react'
import { Info, CheckCircle2, Upload } from 'lucide-react'
import UploadCard from '../components/UploadCard'
import AnalyzeButton from '../components/AnalyzeButton'
import { useFiles } from '../context/FileContext'
import Sidebar from '../components/Sidebar'

const CARDS = [
  {
    title: 'Users & Roles',
    description: 'Upload your users and roles document (.xlsx)',
    acceptedTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    acceptedExts: ['.xlsx', '.xls'],
  },
  {
    title: 'Summary Sheet',
    description: 'Upload your summary sheet (.xlsx, .pdf)',
    acceptedTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/pdf'],
    acceptedExts: ['.xlsx', '.xls', '.pdf'],
  },
  {
    title: 'User Active Status',
    description: 'Upload active status analysis (.xlsx)',
    acceptedTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    acceptedExts: ['.xlsx', '.xls'],
  },
]

export default function UploadPage() {
  const { files, setFile } = useFiles()
  const [toast, setToast] = useState<string | null>(null)

  function handleFileChange(index: number, file: File | null, s3Key?: string) {
    setFile(index, file, s3Key)
    if (file && s3Key) {
      setToast(`"${file.name}" has been securely uploaded and stored in the S3 bucket.`)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const uploadedCount = files.filter(Boolean).length

  return (
    <div className="min-h-screen flex bg-white font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col px-4 sm:px-12 py-10 max-w-[1000px] overflow-y-auto">
        
        {/* Page Header */}
        <div className="mb-8 mt-4 text-center mx-auto">
          <h1 className="text-3xl sm:text-[34px] font-black tracking-tight leading-tight mb-4"
            style={{ color: '#0f172a' }}>
            HCM Document Intelligence
          </h1>
          <p className="text-[15px] max-w-[500px] mx-auto text-slate-500 leading-relaxed">
            Upload your HCM documents for AI-powered analysis.<br />
            Large files are fully supported — no size limits.
          </p>
        </div>

        {/* Format Info Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {['PDF', 'DOCX', 'XLSX', 'CSV'].map((fmt) => (
            <span key={fmt}
              className="px-2.5 py-1 rounded text-[11px] font-bold tracking-wide"
              style={{ background: '#f8fafc', color: '#1d6fa4', border: '1px solid #e2e8f0' }}>
              <span className="text-red-500 mr-1 opacity-70">
                {fmt === 'PDF' && 'pdf-icon'}
                {/* Need actual tiny icons if wanted, but standard text is ok */}
              </span>
              {fmt}
            </span>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium ml-2"
            style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
            <Info size={12} className="opacity-80" />
            Large file support enabled
          </div>
        </div>

        {/* Upload Container */}
        <div className="w-full max-w-[680px] mx-auto">
          <h2 className="text-[17px] font-bold text-slate-800 mb-1">Upload Your Documents</h2>
          <p className="text-xs text-slate-500 mb-6">All three documents are required for complete analysis.</p>

          <div className="relative pl-6">
            {/* Connecting Vertical Line */}
            <div className="absolute left-[39px] top-6 bottom-[140px] w-px border-l-2 border-dashed border-slate-200" />
            
            <div className="flex flex-col gap-5 relative">
              {CARDS.map((card, i) => (
                <div key={i} className="flex gap-4">
                  {/* Step Number */}
                  <div className="flex flex-col items-center z-10 pt-4">
                    <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      0{i + 1}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="flex-1 bg-white border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] rounded-2xl flex items-center p-4">
                    <UploadCard
                      index={i}
                      title={card.title}
                      description={card.description}
                      onFileChange={handleFileChange}
                      existingFiles={files}
                      acceptedTypes={card.acceptedTypes}
                      acceptedExts={card.acceptedExts}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Analyze Button */}
            <div className="mt-8 ml-12">
              <AnalyzeButton uploadedCount={uploadedCount} />
            </div>
            
            <p className="text-xs text-slate-500 text-center ml-12 mt-4 font-medium">
              AI will analyze your documents and generate intelligent insights.
            </p>
          </div>
        </div>

        {/* Bottom Info Cards */}
        <div className="w-full max-w-[680px] mx-auto mt-16 flex gap-4">
          <div className="flex-1 flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Upload size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">AI-Powered Analysis</h4>
              <p className="text-[11px] text-slate-500">Advanced AI for accurate insights</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
              ∞
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Size Limits</h4>
              <p className="text-[11px] text-slate-500">Upload files of any size</p>
            </div>
          </div>
        </div>
      </main>

      {/* Success Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-white rounded-xl shadow-lg border p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{toast}</p>
          </div>
        </div>
      )}
    </div>
  )
}
