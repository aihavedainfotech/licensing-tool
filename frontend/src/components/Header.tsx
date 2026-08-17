import { BarChart3, Settings, User } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import AnimatedLogo from './AnimatedLogo'

interface HeaderProps {
  variant?: 'landing' | 'upload'
}

export default function Header({ variant = 'landing' }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <header className="w-full px-8 py-4 flex items-center justify-between"
      style={{ borderBottom: '1px solid rgba(219,234,254,0.6)' }}>
      {/* Left — Brand */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => navigate('/')}
      >
        {/* New animated logo */}
        <AnimatedLogo size={40} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-oracle-red uppercase">Oracle HCM</span>
          </div>
          <h1 className="text-[15px] font-700 leading-tight text-navy"
            style={{ fontWeight: 700, color: '#1a2b4a', letterSpacing: '-0.01em' }}>
            HCM Intelligent Analytics
          </h1>
        </div>
      </div>

      {/* Right — Badges + icons */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: '#e8f4fc', color: '#1d6fa4' }}>
          <BarChart3 size={12} />
          AI Analytics
        </span>
        <span className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: '#eef2f8', color: '#1a2b4a' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
          </svg>
          Licence Intelligence
        </span>

        {/* Nav pill */}
        {variant === 'upload' && (
          <button
            onClick={() => navigate('/')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-brand-blue hover:bg-brand-pale transition-all duration-200"
          >
            ← Home
          </button>
        )}

        {/* Upload indicator */}
        {location.pathname === '/upload' && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: '#f0fdf4', color: '#10b981' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Upload Ready
          </div>
        )}

        <button onClick={() => navigate('/config')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
          <Settings size={16} />
        </button>
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
          style={{ background: 'linear-gradient(135deg, #1d6fa4, #00b4d8)' }}>
          <User size={14} />
        </button>
      </div>
    </header>
  )
}
