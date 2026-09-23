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
import { useNavigate, useLocation } from 'react-router-dom'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  const isNavActive = (path: string) => {
    if (path === '/upload') {
      return currentPath === '/upload' || currentPath === '/'
    }
    return currentPath.startsWith(path)
  }

  const navItems = [
    { label: 'Uploads', path: '/upload', icon: Home },
    { label: 'Help', path: '/help', icon: HelpCircle },
    { label: 'Settings', path: '/config', icon: Settings },
  ]

  return (
    <aside className="w-64 flex flex-col h-screen shrink-0 sticky top-0 left-0 overflow-y-auto bg-white border-r border-slate-100">

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isNavActive(item.path)
          return (
            <button 
              key={item.path}
              onClick={() => navigate(item.path)} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[14px] transition-colors duration-200 bg-transparent text-left ${
                active 
                  ? 'text-emerald-600' 
                  : 'text-blue-600 hover:text-emerald-600 active:text-emerald-600'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} className={active ? 'text-emerald-600' : 'text-blue-600 group-hover:text-emerald-600'} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* AI Analysis Card */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl p-5 shadow-sm bg-white border border-slate-100">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-blue-50 text-blue-600">
            <span className="text-lg">✨</span>
          </div>
          <h4 className="font-bold text-[14px] mb-1 text-blue-600">AI Analysis</h4>
          <p className="text-[12px] font-medium leading-relaxed text-slate-500">
            Powered by advanced<br/>AI for accurate<br/>insights.
          </p>
        </div>
      </div>

      {/* Secure & Private */}
      <div className="p-4 flex items-center gap-3 border-t border-slate-100 bg-white">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
          <ShieldCheck size={20} strokeWidth={2} />
        </div>
        <div>
          <h4 className="font-bold text-[13px] text-blue-600">Secure & Private</h4>
          <p className="text-[11px] font-medium text-slate-500">Your data is encrypted<br/>and protected</p>
        </div>
      </div>
    </aside>
  )
}
