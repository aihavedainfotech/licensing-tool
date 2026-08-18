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
    <aside className="w-64 flex flex-col h-screen shrink-0 sticky top-0 left-0 overflow-y-auto" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #efebe4' }}>
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f7eee6', color: '#ba6017' }}>
          <BookOpen size={22} strokeWidth={2.5} />
        </div>
        <span className="font-black text-[15px] leading-tight" style={{ color: '#31231a' }}>
          HCM Document<br />Intelligence
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 flex flex-col gap-1.5">
        <button onClick={() => navigate('/upload')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[14px] transition-colors" style={{ background: '#f9efe6', color: '#c16722' }}>
          <Home size={18} strokeWidth={2.5} />
          Uploads
        </button>
        <button onClick={() => navigate('/help')} className="flex items-center w-full text-left gap-3 px-4 py-3 rounded-xl font-bold text-[14px] transition-colors hover:bg-black/5" style={{ color: '#31231a' }}>
          <HelpCircle size={18} />
          Help
        </button>
        <button onClick={() => navigate('/templates')} className="flex items-center w-full text-left gap-3 px-4 py-3 rounded-xl font-bold text-[14px] transition-colors hover:bg-black/5" style={{ color: '#31231a' }}>
          <LayoutTemplate size={18} />
          Templates
        </button>
        <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[14px] transition-colors hover:bg-black/5" style={{ color: '#31231a' }}>
          <LineChart size={18} />
          Insights
        </a>
        <button onClick={() => navigate('/config')} className="flex items-center w-full text-left gap-3 px-4 py-3 rounded-xl font-bold text-[14px] transition-colors hover:bg-black/5" style={{ color: '#31231a' }}>
          <Settings size={18} />
          Settings
        </button>
      </nav>

      {/* AI Analysis Card */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#fdfbf7', border: '1px solid #efebe4' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: 'transparent' }}>
            <span className="text-lg" style={{ color: '#ba6017' }}>✨</span>
          </div>
          <h4 className="font-bold text-[14px] mb-1" style={{ color: '#31231a' }}>AI Analysis</h4>
          <p className="text-[12px] font-medium leading-relaxed" style={{ color: '#6d5f53' }}>
            Powered by advanced<br/>AI for accurate<br/>insights.
          </p>
        </div>
      </div>

      {/* Secure & Private */}
      <div className="p-4 flex items-center gap-3" style={{ borderTop: '1px solid #efebe4' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f7eee6', color: '#7a5a3a' }}>
          <ShieldCheck size={20} strokeWidth={2} />
        </div>
        <div>
          <h4 className="font-bold text-[13px]" style={{ color: '#31231a' }}>Secure & Private</h4>
          <p className="text-[11px] font-medium" style={{ color: '#6d5f53' }}>Your data is encrypted<br/>and protected</p>
        </div>
      </div>
    </aside>
  )
}
