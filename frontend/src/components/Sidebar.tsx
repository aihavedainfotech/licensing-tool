import { 
  Home, 
  LayoutTemplate, 
  Settings,
  ShieldCheck,
  HelpCircle,
  UserCheck,
  ShieldAlert,
  Sparkles,
  BarChart3
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  const isUploadActive = currentPath === '/upload' || currentPath === '/'
  const isHelpActive = currentPath.startsWith('/help')
  const isTemplatesActive = currentPath.startsWith('/templates')
  const isUserAuditActive = currentPath.startsWith('/user-audit')
  const isConflictsActive = currentPath.startsWith('/conflicts')
  const isConfigActive = currentPath.startsWith('/config')
  const isResultsActive = currentPath.startsWith('/results')

  return (
    <aside className="sb w-[232px] flex flex-col h-screen shrink-0 sticky top-0 left-0 overflow-y-auto z-20">
      {/* Brand Logo */}
      <div 
        className="logo flex items-center gap-2.5 cursor-pointer select-none"
        onClick={() => navigate('/upload')}
      >
        <div className="lg shrink-0">L</div>
        <span className="text-[15px] font-bold tracking-tight text-white leading-[1.2]">
          Licensing<br />Optimizer Tool
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-1 py-1 flex flex-col gap-1">
        <button 
          onClick={() => navigate('/upload')} 
          className={`nav w-full text-left cursor-pointer ${isUploadActive ? 'on' : ''}`}
        >
          <Home size={18} className="shrink-0" />
          <span>Uploads</span>
        </button>

        <button 
          onClick={() => navigate('/help')} 
          className={`nav w-full text-left cursor-pointer ${isHelpActive ? 'on' : ''}`}
        >
          <HelpCircle size={18} className="shrink-0" />
          <span>Help</span>
        </button>

        <button 
          onClick={() => navigate('/templates')} 
          className={`nav w-full text-left cursor-pointer ${isTemplatesActive ? 'on' : ''}`}
        >
          <LayoutTemplate size={18} className="shrink-0" />
          <span>Templates</span>
        </button>

        <button 
          onClick={() => navigate('/user-audit')} 
          className={`nav w-full text-left cursor-pointer ${isUserAuditActive ? 'on' : ''}`}
        >
          <UserCheck size={18} className="shrink-0" />
          <span>User Audit</span>
        </button>

        <button 
          onClick={() => navigate('/conflicts')} 
          className={`nav w-full text-left cursor-pointer ${isConflictsActive ? 'on' : ''}`}
        >
          <ShieldAlert size={18} className="shrink-0" />
          <span>Functional Conflicts</span>
        </button>

        {isResultsActive && (
          <button 
            onClick={() => navigate('/results')} 
            className="nav on w-full text-left cursor-pointer"
          >
            <BarChart3 size={18} className="shrink-0" />
            <span>Analysis Results</span>
          </button>
        )}

        <button 
          onClick={() => navigate('/config')} 
          className={`nav w-full text-left cursor-pointer ${isConfigActive ? 'on' : ''}`}
        >
          <Settings size={18} className="shrink-0" />
          <span>Settings</span>
        </button>
      </nav>

      {/* AI Analysis Card */}
      <div className="px-1 mt-auto mb-3">
        <button 
          onClick={() => {
            if (isConflictsActive || isUserAuditActive) {
              const el = document.getElementById('aib');
              if (el) el.click();
            } else {
              navigate('/user-audit');
            }
          }}
          className="ai w-full text-left cursor-pointer"
        >
          <b className="flex items-center gap-1.5 text-[13px]">
            <Sparkles size={14} className="text-[#9DB8FF]" />
            AI Analysis
          </b>
          <span>Tap for workforce insights</span>
        </button>
      </div>

      {/* Secure & Private Footer */}
      <div className="pt-3 px-2 border-t border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/10 text-[#9DB8FF] flex items-center justify-center shrink-0">
          <ShieldCheck size={16} />
        </div>
        <div className="min-w-0">
          <h4 className="text-[12px] font-semibold text-white leading-tight">Secure & Private</h4>
          <p className="text-[10px] text-[#A9B7D0] truncate">Enterprise Cloud Protected</p>
        </div>
      </div>
    </aside>
  )
}
