import { useState } from 'react'
import { Info, Bell, ChevronDown, Users, FileText, ShieldCheck, Cloud, ArrowUp, Folder, Heart, Sparkles, CheckCircle2, Upload } from 'lucide-react'
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
    icon: <Users size={24} strokeWidth={2} />
  },
  {
    title: 'Summary Sheet',
    description: 'Upload your summary sheet (.xlsx, .pdf)',
    acceptedTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/pdf'],
    acceptedExts: ['.xlsx', '.xls', '.pdf'],
    icon: <FileText size={24} strokeWidth={2} />
  },
  {
    title: 'User Active Status',
    description: 'Upload active status analysis (.xlsx)',
    acceptedTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    acceptedExts: ['.xlsx', '.xls'],
    icon: <ShieldCheck size={24} strokeWidth={2} />
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
    <div className="h-screen w-screen flex overflow-hidden font-sans bg-white text-slate-800">
      <Sidebar />

      <main className="flex-1 flex flex-col px-6 lg:px-12 py-6 lg:py-8 w-full h-screen overflow-hidden justify-between max-w-[1400px] mx-auto bg-white">
        
        {/* Page Header */}
        <div className="mb-4 text-center mx-auto">
          <h1 className="text-3xl lg:text-[36px] font-black tracking-tight leading-tight mb-2 text-slate-900">
            HCM Document Intelligence
          </h1>
          <p className="text-[15px] max-w-[550px] mx-auto leading-relaxed font-medium text-slate-500">
            Upload your HCM documents for AI-powered analysis.<br className="hidden sm:inline" /> Large files supported — no size limits.
          </p>
        </div>

        {/* Format Info Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-6">
          {[
            { fmt: 'PDF', color: '#dc2626', icon: '📄' },
            { fmt: 'DOCX', color: '#2563eb', icon: '📄' },
            { fmt: 'XLSX', color: '#16a34a', icon: '📊' },
            { fmt: 'CSV', color: '#475569', icon: '📊' }
          ].map(({ fmt, color, icon }) => (
            <span key={fmt}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold tracking-wide flex items-center gap-2 bg-white text-slate-700 border border-slate-200 shadow-sm">
              <span className="text-sm opacity-100" style={{ color }}>{icon}</span>
              {fmt}
            </span>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold ml-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Info size={14} className="opacity-90 text-emerald-600" />
            Large file support enabled
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full flex flex-col lg:flex-row gap-8 items-stretch justify-center flex-1 min-h-0 mb-2">
          
          {/* Upload Container (Left) */}
          <div className="w-full lg:w-1/2 max-w-[560px] flex flex-col justify-between">
            <div>
              <h2 className="text-[17px] font-black mb-1 text-slate-900">Upload Your Documents</h2>
              <p className="text-[13px] mb-4 font-medium text-slate-500">All three documents are required for complete analysis.</p>
            </div>

            <div className="relative pl-5 flex-1 flex flex-col justify-between">
              {/* Connecting Vertical Line */}
              <div className="absolute left-[35px] top-6 bottom-[110px] w-px border-l border-dashed border-slate-200" />
              
              <div className="flex flex-col gap-4 relative justify-around flex-1">
                {CARDS.map((card, i) => {
                  const stepBg = i === 0 ? 'bg-blue-600 shadow-blue-200' : i === 1 ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'
                  return (
                    <div key={i} className="flex gap-4 relative items-center">
                      {/* Step Number */}
                      <div className="flex flex-col items-center z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-sm ${stepBg}`}>
                          0{i + 1}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 bg-white rounded-2xl flex items-center p-3.5 border border-slate-200 shadow-sm">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ml-1 mr-3 bg-emerald-50 text-emerald-600">
                          {card.icon}
                        </div>
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
                  )
                })}
              </div>

              {/* Analyze Button */}
              <div className="mt-5 ml-12">
                <AnalyzeButton uploadedCount={uploadedCount} />
              </div>

            </div>
          </div>

          {/* Instructions Panel (Right) */}
          <div className="w-full lg:w-1/2 max-w-[560px] rounded-3xl p-6 lg:p-7 relative overflow-hidden flex flex-col justify-between h-full lg:mt-14 bg-slate-50 border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-[16px] font-black mb-4 flex items-center gap-2 text-slate-900">
                <div className="rounded-full flex items-center justify-center p-[2px] border-2 border-emerald-600 text-emerald-600">
                  <Info size={15} className="text-emerald-600" />
                </div>
                Upload Guide
              </h3>
              
              <div className="space-y-4">
                <div className="pb-3.5 border-b border-slate-200">
                  <h4 className="text-[14px] font-bold mb-1 text-slate-900">1. Users & Roles</h4>
                  <p className="text-[13px] leading-relaxed font-medium text-slate-600">
                    Upload an <span className="font-bold text-slate-900">.xlsx</span> or <span className="font-bold text-slate-900">.xls</span> file containing your complete list of active employees, roles, and privileges.
                  </p>
                </div>
                
                <div className="pb-3.5 border-b border-slate-200">
                  <h4 className="text-[14px] font-bold mb-1 text-slate-900">2. Summary Sheet</h4>
                  <p className="text-[13px] leading-relaxed font-medium text-slate-600">
                    Upload pricing configuration or overall license summary sheet (<span className="font-bold text-slate-900">.xlsx, .xls, .pdf</span>).
                  </p>
                </div>
                
                <div>
                  <h4 className="text-[14px] font-bold mb-1 text-slate-900">3. User Active Status</h4>
                  <p className="text-[13px] leading-relaxed font-medium text-slate-600">
                    Upload an <span className="font-bold text-slate-900">.xlsx</span> or <span className="font-bold text-slate-900">.xls</span> file that defines active, suspended, or inactive users for cost calculation.
                  </p>
                </div>
              </div>
            </div>

            {/* Illustration Area */}
            <div className="mt-4 h-[150px] flex justify-center items-end relative opacity-90">
              
              {/* Sparkles Background */}
              <Sparkles size={18} className="absolute top-2 left-10 opacity-60 text-blue-400 fill-blue-400" />
              <Sparkles size={15} className="absolute bottom-8 left-4 opacity-40 text-blue-400 fill-blue-400" />
              <Sparkles size={20} className="absolute top-0 right-16 opacity-50 text-blue-400 fill-blue-400" />
              <Sparkles size={16} className="absolute bottom-12 right-6 opacity-60 text-blue-400 fill-blue-400" />

              {/* Connecting Lines */}
              <div className="absolute top-[45px] left-1/2 -translate-x-1/2 w-px h-10 border-l-2 border-dashed border-slate-300" />

              {/* Cloud (Top Center) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center z-20">
                <Cloud size={72} className="text-blue-600 fill-blue-600" />
                <ArrowUp size={24} className="absolute text-white stroke-[3] mt-1" />
              </div>

              {/* Left File (XLSX) */}
              <div className="absolute bottom-3 left-1/2 -translate-x-[85px] z-10 flex flex-col items-center">
                <FileText size={54} className="text-slate-300 fill-slate-50" />
                <span className="absolute bottom-1 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm bg-emerald-600 text-white">XLSX</span>
              </div>

              {/* Right File (PDF) */}
              <div className="absolute bottom-4 left-1/2 translate-x-[40px] z-10 flex flex-col items-center">
                <FileText size={46} className="text-slate-300 fill-slate-50" />
                <span className="absolute bottom-1 -right-3 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm bg-red-600 text-white">PDF</span>
              </div>

              {/* Center Folder */}
              <div className="absolute bottom-0 left-1/2 -translate-x-[18px] z-30 flex items-center justify-center">
                <Folder size={72} className="text-indigo-400 fill-indigo-100" />
                <Heart size={14} className="absolute text-indigo-600 fill-indigo-600 mt-1" />
              </div>
              
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
