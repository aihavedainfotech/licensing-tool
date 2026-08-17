import { 
  BookOpen, 
  Home, 
  Clock, 
  LayoutTemplate, 
  LineChart, 
  Settings,
  ShieldCheck,
  Triangle,
  HelpCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col h-screen shrink-0 sticky top-0 left-0 overflow-y-auto">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eef6fb', color: '#1d6fa4' }}>
          <BookOpen size={22} strokeWidth={2.5} />
        </div>
        <span className="font-bold text-sm leading-tight text-slate-800">
          HCM Document<br />Intelligence
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 flex flex-col gap-1.5">
        <button onClick={() => navigate('/upload')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-200 text-slate-900 font-bold text-sm transition-colors">
          <Home size={18} strokeWidth={2.5} className="text-blue-700" />
          Uploads
        </button>
        <button onClick={() => navigate('/help')} className="flex items-center w-full text-left gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
          <HelpCircle size={18} />
          Help
        </button>
        <button onClick={() => navigate('/templates')} className="flex items-center w-full text-left gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
          <LayoutTemplate size={18} />
          Templates
        </button>
        <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
          <LineChart size={18} />
          Insights
        </a>
        <button onClick={() => navigate('/config')} className="flex items-center w-full text-left gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
          <Settings size={18} />
          Settings
        </button>
      </nav>

      {/* AI Analysis Card */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <Triangle size={16} className="text-blue-600" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm mb-1">AI Analysis</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Powered by advanced<br/>AI for accurate<br/>insights.
          </p>
        </div>
      </div>

      {/* Secure & Private */}
      <div className="p-4 border-t border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eef6fb', color: '#1d6fa4' }}>
          <ShieldCheck size={20} strokeWidth={2} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-xs">Secure & Private</h4>
          <p className="text-[11px] text-slate-500">Your data is encrypted</p>
        </div>
      </div>
    </aside>
  )
}
