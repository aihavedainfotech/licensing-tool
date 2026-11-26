import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, Bell, ChevronDown, Users, FileText, ShieldCheck, Cloud, ArrowUp, Folder, Heart, Sparkles, CheckCircle2, UserCheck, ArrowRight } from 'lucide-react'
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
    title: 'SAAS Service usage metric',
    description: 'Upload your SAAS service usage metric (.xlsx, .pdf)',
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
  const navigate = useNavigate()
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

      <main className="flex-1 flex flex-col px-4 sm:px-12 py-10 max-w-[1200px] mx-auto w-full overflow-y-auto" style={{ backgroundColor: 'var(--bg, #F4F6FA)' }}>
        
        {/* Top Header - Admin */}
        <div className="absolute top-8 right-8 flex items-center gap-4">
          <button className="text-slate-600 hover:text-slate-900 transition-colors">
            <Bell size={20} style={{ color: 'var(--ink, #0F1B2D)' }} />
          </button>
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--acc, #1D4ED8)' }}>
              A
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--ink, #0F1B2D)' }}>Admin</span>
            <ChevronDown size={16} style={{ color: 'var(--mut, #586377)' }} />
          </div>
        </div>

        {/* Page Header */}
        <div className="mb-8 mt-4 text-center mx-auto">
          <h1 className="text-3xl sm:text-[38px] font-black tracking-tight leading-tight mb-4"
            style={{ color: 'var(--ink, #0F1B2D)' }}>
            Licensing Optimizer Tool
          </h1>
          <p className="text-[16px] max-w-[500px] mx-auto leading-relaxed font-medium" style={{ color: 'var(--mut, #586377)' }}>
            Upload your HCM documents for AI-powered analysis.<br />
            Large files are fully supported — no size limits.
          </p>
        </div>

        {/* Format Info Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {[
            { fmt: 'PDF', color: '#dc2626', icon: '📄' },
            { fmt: 'DOCX', color: '#2563eb', icon: '📄' },
            { fmt: 'XLSX', color: '#16a34a', icon: '📊' },
            { fmt: 'CSV', color: '#475569', icon: '📊' }
          ].map(({ fmt, color, icon }) => (
            <span key={fmt}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold tracking-wide flex items-center gap-2"
              style={{ background: 'var(--card, #ffffff)', color: 'var(--ink, #0F1B2D)', border: '1px solid var(--line, #E1E6EE)', boxShadow: '0 1px 2px rgba(15,27,45,0.05)' }}>
              <span className="text-sm opacity-100" style={{ color }}>{icon}</span>
              {fmt}
            </span>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold ml-2"
            style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)', border: '1px solid var(--line, #E1E6EE)' }}>
            <Info size={14} className="opacity-90" />
            Large file support enabled
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full flex flex-col lg:flex-row gap-12 items-start justify-center">
          
          {/* Upload Container (Left) */}
          <div className="w-full max-w-[600px]">
            <h2 className="text-[18px] font-black mb-1" style={{ color: 'var(--ink, #0F1B2D)' }}>Upload Your Documents</h2>
            <p className="text-[13px] mb-6 font-medium" style={{ color: 'var(--mut, #586377)' }}>All three documents are required for complete analysis.</p>

            <div className="relative pl-6">
              {/* Connecting Vertical Line */}
              <div className="absolute left-[39px] top-6 bottom-[140px] w-px border-l border-dashed" style={{ borderColor: 'var(--line, #E1E6EE)' }} />
              
              <div className="flex flex-col gap-5 relative">
                {CARDS.map((card, i) => (
                  <div key={i} className="flex gap-4 relative">
                    {/* Step Number */}
                    <div className="flex flex-col items-center z-10 pt-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-sm" style={{ background: 'var(--acc, #1D4ED8)' }}>
                        0{i + 1}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 bg-white rounded-2xl flex items-center p-3" style={{ border: '1px solid var(--line, #E1E6EE)', boxShadow: '0 2px 8px rgba(15,27,45,0.04)' }}>
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ml-1 mr-2" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)' }}>
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
                ))}
              </div>

              {/* Analyze Button */}
              <div className="mt-8 ml-12">
                <AnalyzeButton uploadedCount={uploadedCount} />
              </div>

              {/* User Audit Section */}
              <div 
                onClick={() => navigate('/user-audit')}
                className="mt-6 ml-12 p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-md hover:border-[var(--acc)]/50 group flex items-center justify-between"
                style={{ background: 'var(--card, #ffffff)', border: '1px solid var(--line, #E1E6EE)' }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)' }}>
                    <UserCheck size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-[14px]" style={{ color: 'var(--ink, #0F1B2D)' }}>User Audit & Activity Intelligence</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--gb, #E4F5EA)', color: 'var(--gt, #0E6B38)', border: '1px solid var(--line, #E1E6EE)' }}>Live Oracle API</span>
                    </div>
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--mut, #586377)' }}>
                      Audit creation dates, email, roles & activity status (Yes/No) from Demo Instance.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[13px] transition-all group-hover:translate-x-1" style={{ color: 'var(--acct, #1B3FA8)', background: 'var(--soft, #F0F3F8)' }}>
                  <span>Open Audit</span>
                  <ArrowRight size={15} />
                </div>
              </div>

            </div>
          </div>

          {/* Instructions Panel (Right) */}
          <div className="w-full flex-1 min-w-[320px] rounded-3xl p-8 mt-10 relative overflow-hidden" style={{ background: 'var(--card, #ffffff)', border: '1px solid var(--line, #E1E6EE)' }}>
            <h3 className="text-[16px] font-black mb-6 flex items-center gap-2" style={{ color: 'var(--ink, #0F1B2D)' }}>
              <div className="rounded-full flex items-center justify-center p-[2px]" style={{ border: '2px solid var(--acc, #1D4ED8)' }}>
                <Info size={16} style={{ color: 'var(--acc, #1D4ED8)' }} />
              </div>
              Upload Guide
            </h3>
            
            <div className="space-y-6">
              <div className="pb-6" style={{ borderBottom: '1px solid var(--line, #E1E6EE)' }}>
                <h4 className="text-[14px] font-bold mb-1.5" style={{ color: 'var(--ink, #0F1B2D)' }}>1. Users & Roles</h4>
                <p className="text-[13px] leading-relaxed font-medium" style={{ color: 'var(--mut, #586377)' }}>
                  Upload an <span className="font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>.xlsx</span> or <span className="font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>.xls</span> file containing your complete list of active employees, their roles, and privileges.
                </p>
              </div>
              
              <div className="pb-6" style={{ borderBottom: '1px solid var(--line, #E1E6EE)' }}>
                <h4 className="text-[14px] font-bold mb-1.5" style={{ color: 'var(--ink, #0F1B2D)' }}>2. SAAS Service usage metric</h4>
                <p className="text-[13px] leading-relaxed font-medium" style={{ color: 'var(--mut, #586377)' }}>
                  Upload your SAAS service usage metric or overall license summary sheet.<br/>
                  Supported formats: <span className="font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>.xlsx, .xls, .pdf</span>.
                </p>
              </div>
              
              <div>
                <h4 className="text-[14px] font-bold mb-1.5" style={{ color: 'var(--ink, #0F1B2D)' }}>3. User Active Status</h4>
                <p className="text-[13px] leading-relaxed font-medium" style={{ color: 'var(--mut, #586377)' }}>
                  Upload an <span className="font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>.xlsx</span> or <span className="font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>.xls</span> file that defines which users are active, suspended, or inactive.<br/><br/>
                  This is crucial for accurate cost calculation.
                </p>
              </div>
            </div>

            {/* Illustration Area */}
            <div className="mt-14 h-[200px] flex justify-center items-end relative opacity-90">
              
              {/* Sparkles Background */}
              <Sparkles size={20} className="absolute top-4 left-10 opacity-60 text-[#3B6CF0]" />
              <Sparkles size={16} className="absolute bottom-12 left-4 opacity-40 text-[#3B6CF0]" />
              <Sparkles size={24} className="absolute top-0 right-16 opacity-50 text-[#3B6CF0]" />
              <Sparkles size={18} className="absolute bottom-16 right-6 opacity-60 text-[#3B6CF0]" />

              {/* Connecting Lines */}
              <div className="absolute top-[60px] left-1/2 -translate-x-1/2 w-px h-12 border-l-2 border-dashed" style={{ borderColor: 'var(--line, #E1E6EE)' }} />
              <div className="absolute top-[130px] left-1/2 -translate-x-1/2 w-32 h-px border-t-2 border-dashed" style={{ borderColor: 'var(--line, #E1E6EE)' }} />

              {/* Cloud (Top Center) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center z-20">
                <Cloud size={85} style={{ color: 'var(--acc, #1D4ED8)', fill: 'var(--acc, #1D4ED8)' }} />
                <ArrowUp size={28} className="absolute" style={{ color: '#ffffff', strokeWidth: 3, marginTop: 5 }} />
              </div>

              {/* Left File (XLSX) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-[90px] z-10 flex flex-col items-center">
                <FileText size={65} style={{ color: 'var(--line, #E1E6EE)', fill: 'var(--soft, #F0F3F8)' }} />
                <span className="absolute bottom-2 px-2 py-0.5 rounded text-[9px] font-bold shadow-sm" style={{ background: '#388e3c', color: 'white' }}>XLSX</span>
              </div>

              {/* Right File (PDF) */}
              <div className="absolute bottom-6 left-1/2 translate-x-[40px] z-10 flex flex-col items-center">
                <FileText size={55} style={{ color: '#e6d5c3', fill: '#f4eee8' }} />
                <span className="absolute bottom-2 -right-4 px-2 py-0.5 rounded text-[9px] font-bold shadow-sm" style={{ background: '#d32f2f', color: 'white' }}>PDF</span>
              </div>

              {/* Center Folder */}
              <div className="absolute bottom-0 left-1/2 -translate-x-[20px] z-30 flex items-center justify-center">
                <Folder size={85} style={{ color: '#a69076', fill: '#a69076' }} />
                <Heart size={16} className="absolute mt-2" style={{ color: '#ffffff', fill: '#ffffff' }} />
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
