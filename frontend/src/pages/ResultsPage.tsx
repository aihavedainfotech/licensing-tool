import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Users, Shield,
  Layers, AlertTriangle, CheckCircle2, XCircle, Clock,
  Search, Download, Loader2, FileX2, TrendingUp,
  BarChart3, Key, Sparkles, Brain, LayoutTemplate
} from 'lucide-react'
import Header from '../components/Header'
import AnimatedLogo from '../components/AnimatedLogo'
import type { Service, Privilege, Role, Employee, ParseResult } from '../types'

/* utilities */
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}
function fmtCost(n: number) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n}`
}
const RISK_CONFIG = {
  high:   { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#ef4444', label: 'HIGH'   },
  medium: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', dot: '#f59e0b', label: 'MEDIUM' },
  low:    { bg: '#f0fdf4', text: '#059669', border: '#bbf7d0', dot: '#10b981', label: 'LOW'    },
}
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; Icon: React.ElementType }> = {
  active:     { bg: '#ecfdf5', text: '#059669', label: 'Active',   Icon: CheckCircle2 },
  inactive:   { bg: '#fef2f2', text: '#dc2626', label: 'Inactive', Icon: XCircle },
  'on-leave': { bg: '#fffbeb', text: '#d97706', label: 'On Leave', Icon: Clock },
}
const AVATAR_PALETTE = [
  'linear-gradient(135deg,#1d6fa4,#2196f3)',
  'linear-gradient(135deg,#059669,#10b981)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#dc2626,#f87171)',
  'linear-gradient(135deg,#db2777,#f472b6)',
]

function UsageBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const fill = pct >= 95 ? '#ef4444' : pct >= 80 ? '#f97316' : color
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--theme-text-muted)' }}>
        <span><strong style={{ color: 'var(--theme-text-main)' }}>{used.toLocaleString()}</strong> used</span>
        <span style={{ color: pct >= 95 ? '#ef4444' : '#94a3b8' }}>{total > 0 ? `${pct}%` : '—'}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--theme-bg-hover)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: fill }} />
      </div>
    </div>
  )
}

type Crumb = { label: string; icon: React.ReactNode; onClick: () => void }
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 flex-wrap mb-6">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i < crumbs.length - 1 ? (
            <button onClick={c.onClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
              style={{ background: 'var(--theme-blue-bg)', color: 'var(--theme-blue-text)' }}>
              {c.icon} {c.label}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: '#1a2b4a', color: 'white' }}>
              {c.icon} {c.label}
            </span>
          )}
          {i < crumbs.length - 1 && <ChevronRight size={13} style={{ color: 'var(--theme-text-light)' }} />}
        </React.Fragment>
      ))}
    </nav>
  )
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-3  border-t" style={{ borderColor: 'var(--theme-border)' }}>
      <button 
        disabled={page === 1} 
        onClick={() => setPage(page - 1)}
        className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
        style={{ color: 'var(--theme-text-main)', background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)' }}
      >
        Previous
      </button>
      <span className="text-sm font-medium" style={{ color: 'var(--theme-text-muted)' }}>
        Page <strong style={{ color: 'var(--theme-text-main)' }}>{page}</strong> of {totalPages}
      </span>
      <button 
        disabled={page === totalPages} 
        onClick={() => setPage(page + 1)}
        className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
        style={{ color: 'var(--theme-text-main)', background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)' }}
      >
        Next
      </button>
    </div>
  )
}

/* LEVEL 0 - SERVICES */
function ServicesView({ result, onSelectService }: { result: ParseResult; onSelectService: (s: Service) => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => { setPage(1) }, [search]);
  
  const filtered = result.services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.vendor ?? '').toLowerCase().includes(search.toLowerCase())
  );
  
  const totalCost     = result.services.reduce((a, s) => a + s.totalCost, 0)
  const totalLicences = result.services.reduce((a, s) => a + s.licenseCount, 0)
  const totalPrivs    = result.services.reduce((a, s) => a + s.privilegeCount, 0)
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Licence Cost', value: fmtCost(totalCost),   sub: 'across all services',  icon: <Key size={22} />,       bg: 'var(--theme-blue-bg)', fg: 'var(--theme-blue-text)' },
          { label: 'Active Licences',    value: fmtNum(totalLicences), sub: 'unique assignments',   icon: <BarChart3 size={22} />, bg: 'var(--theme-green-bg)', fg: 'var(--theme-green-text)' },
          { label: 'Privilege Types',    value: totalPrivs,            sub: 'across all services',  icon: <Shield size={22} />,   bg: 'var(--theme-purple-bg)', fg: 'var(--theme-purple-text)' },
        ].map((k, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl p-5 border "
            style={{ borderColor: 'var(--theme-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: k.bg, color: k.fg }}>{k.icon}</div>
            <div>
              <p className="text-2xl font-black tracking-tight" style={{ color: 'var(--theme-text-main)' }}>{k.value}</p>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>{k.label}</p>
              <p className="text-xs" style={{ color: 'var(--theme-text-light)' }}>{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border  outline-none" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-main)' }} />
      </div>

      <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-muted)' }}>Service Areas — click to explore</h2>
      
      <div className=" border rounded-xl overflow-hidden" style={{ background: 'var(--theme-bg-card)' }} style={{ borderColor: 'var(--theme-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}>
        <table className="w-full text-left text-sm">
          <thead className="border-b" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}>
            <tr>
              <th className="px-6 py-4 font-semibold">Service Name</th>
              <th className="px-6 py-4 font-semibold text-right">Limit</th>
              <th className="px-6 py-4 font-semibold text-right">Over</th>
              <th className="px-6 py-4 font-semibold text-right">Licences Used</th>
              <th className="px-6 py-4 font-semibold text-right">Total Cost</th>
              <th className="px-6 py-4 font-semibold text-right">Privileges</th>
              <th className="px-6 py-4 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
            {paginated.map(svc => (
              <tr key={svc.id} className="hover: transition-colors cursor-pointer group" onClick={() => onSelectService(svc)}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="font-bold" style={{ color: 'var(--theme-text-main)' }}>{svc.name}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {svc.sku && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-muted)' }}>SKU: {svc.sku}</span>}
                    {svc.vendor && <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{svc.vendor}</div>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-semibold">
                  {svc.subscribedQuantity !== undefined ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: '#ecfdf5', color: '#059669' }}>
                      {svc.subscribedQuantity}
                    </span>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-6 py-4 text-right font-semibold">
                  {svc.overProvisioned > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fef2f2', color: '#dc2626' }}>
                      <AlertTriangle size={10} /> {svc.overProvisioned}
                    </span>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-6 py-4 text-right font-semibold" style={{ color: 'var(--theme-text-main)' }}>
                  {svc.licenseCount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right font-semibold" style={{ color: 'var(--theme-text-main)' }}>
                  {fmtCost(svc.totalCost)}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-muted)' }}>
                    {svc.privilegeCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-slate-300 group-hover:text-blue-500 transition-colors">
                  <ChevronRight size={18} className="inline-block" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} setPage={setPage} />
        )}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No services match your search</p>
        </div>
      )}
    </div>
  )
}

/* LEVEL 1 - PRIVILEGES */
function PrivilegesView({ service, onSelectPrivilege }: { service: Service; onSelectPrivilege: (p: Privilege) => void }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => { setPage(1) }, [search]);
  
  const filtered = service.privileges.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  
  return (
    <div>
      <div className="flex items-center gap-4 p-5 rounded-2xl mb-6 border-2" style={{ background: service.bgGradient, borderColor: `${service.color}33` }}>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black" style={{ color: 'var(--theme-text-main)' }}>{service.name}</h3>
          <div className="flex items-center gap-2 mt-1 mb-1">
            {service.sku && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#ffffff55', color: 'var(--theme-text-main)' }}>SKU: {service.sku}</span>}
            {service.subscribedQuantity !== undefined && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#ecfdf5', color: '#059669' }}>
                Limit: {service.subscribedQuantity}
              </span>
            )}
            {service.overProvisioned > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <AlertTriangle size={12} /> {service.overProvisioned} Over
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{service.vendor ? `${service.vendor} · ` : ''}{service.licenseCount.toLocaleString()} licences · {service.privilegeCount} privileges</p>
        </div>
        <div className="hidden sm:flex flex-col items-end">
          <p className="text-2xl font-black" style={{ color: service.color }}>{fmtCost(service.totalCost)}</p>
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Total Cost</p>
        </div>
      </div>
      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search privileges…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border  outline-none" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-main)' }} />
      </div>
      <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-muted)' }}>Privileges — click to see roles</h2>
      
      <div className=" border rounded-xl overflow-hidden" style={{ background: 'var(--theme-bg-card)' }} style={{ borderColor: 'var(--theme-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}>
        <table className="w-full text-left text-sm">
          <thead className="border-b" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}>
            <tr>
              <th className="px-6 py-4 font-semibold">Privilege</th>
              <th className="px-6 py-4 font-semibold text-right">Cost / user</th>
              <th className="px-6 py-4 font-semibold text-right">Roles</th>
              <th className="px-6 py-4 font-semibold text-center">Risk</th>
              <th className="px-6 py-4 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
            {paginated.map(priv => {
              const rc = RISK_CONFIG[priv.risk]
              return (
                <tr key={priv.id} className="hover: transition-colors cursor-pointer group" onClick={() => onSelectPrivilege(priv)}>
                  <td className="px-6 py-4">
                    <div className="font-bold" style={{ color: 'var(--theme-text-main)' }}>{priv.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{priv.description}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold" style={{ color: 'var(--theme-text-main)' }}>
                    {fmtCost(priv.costPerUser)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-muted)' }}>
                      {priv.roles?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border" style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: rc.dot }} />
                      {rc.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300 group-hover:text-blue-500 transition-colors">
                    <ChevronRight size={18} className="inline-block" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} setPage={setPage} />
        )}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No privileges match your search</p>
        </div>
      )}
    </div>
  )
}

/* AI INSIGHT PANEL */
function AIInsightPanel({ privilegeName, color }: { privilegeName: string, color: string }) {
  const [insight, setInsight] = useState<{ explanation: string, isCostedMessage: string, alternative: string, impact: string, usage?: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setInsight(null);
    setError('');
    
    async function fetchInsight() {
      setLoading(true);
      try {
        const selectedModel = localStorage.getItem('modelSuggest') || 'deepseek-chat';
        const res = await fetch('http://localhost:3001/api/ai-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privilegeName, model: selectedModel })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch AI insight');
        }
        const data = await res.json();
        if (!cancelled) {
          setInsight(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    fetchInsight();
    return () => { cancelled = true; }
  }, [privilegeName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 mb-6 rounded-2xl border-2  relative overflow-hidden" style={{ borderColor: `${color}44` }}>
        {/* Animated background glow */}
        <div className="absolute inset-0 opacity-10 animate-pulse" style={{ background: `radial-gradient(circle at center, ${color}, transparent 70%)` }} />
        
        <div className="relative z-10 flex flex-col items-center animate-bounce mt-2">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg" style={{ background: color, color: 'white' }}>
            <Brain size={32} />
          </div>
        </div>
        
        <h3 className="text-base font-black relative z-10 tracking-wide mb-2" style={{ color: 'var(--theme-text-main)' }}>
          AI is analyzing <span style={{ color }}>{privilegeName}</span>...
        </h3>
        
        <div className="relative z-10 flex flex-col items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
          <p className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Cross-referencing licensing configurations</p>
          <p className="flex items-center gap-2 text-slate-400">Evaluating cost impact & alternative privileges</p>
        </div>
      </div>
    );
  }

  if (error || !insight) return null; // Fallback silently if no data or error

  const renderText = (val: any) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (val.privilege && val.description) return `${val.privilege}: ${val.description}`;
      if (val.name && val.description) return `${val.name}: ${val.description}`;
      return Object.values(val).map(String).join(' - ');
    }
    return String(val);
  }

  return (
    <div className="mb-6 rounded-2xl border-2 overflow-hidden  relative shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: `${color}33` }}>
      <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: color }} />
      
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ background: 'linear-gradient(90deg, #f8fafc, #ffffff)', borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
            <Sparkles size={14} style={{ color }} />
          </div>
          <h3 className="text-sm font-black tracking-wide" style={{ color: 'var(--theme-text-main)' }}>AI Insight</h3>
        </div>
        <div className="flex items-center gap-2">
          {insight.usage && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-muted)' }}>
              Used {insight.usage.total_tokens} Tokens
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-muted)' }}>Powered by {(localStorage.getItem('modelSuggest') || 'deepseek').startsWith('gemini') ? 'Gemini' : 'DeepSeek'}</span>
        </div>
      </div>
      
      <div className="p-5 flex flex-col gap-5">
        <div className="flex gap-3 items-start">
          <div className="mt-1"><Brain size={16} style={{ color: color }} /></div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--theme-text-muted)' }}>Privilege Overview</h4>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-main)' }}>{renderText(insight.explanation)}</p>
          </div>
        </div>
        
        <hr className="border-t border-dashed" style={{ borderColor: 'var(--theme-border)' }} />

        <div className="flex gap-3 items-start">
          <div className="mt-1"><AlertTriangle size={16} style={{ color: '#dc2626' }} /></div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--theme-text-muted)' }}>Cost Alert</h4>
            <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--theme-text-main)' }}>{renderText(insight.isCostedMessage)}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border-2" style={{ background: 'var(--theme-bg-page)', borderColor: 'var(--theme-border)' }}>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'var(--theme-text-muted)' }}>
              <Shield size={12} /> Alternative Suggestion
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-main)' }}>{renderText(insight.alternative)}</p>
          </div>
          <div className="p-4 rounded-xl border-2" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: '#d97706' }}>
              <TrendingUp size={12} /> Business Impact
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: '#92400e' }}>{renderText(insight.impact)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* LEVEL 2 - ROLES */
function RolesView({ privilege, service, onSelectRole }: { privilege: Privilege; service: Service; onSelectRole: (r: Role) => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => { setPage(1) }, [search]);
  
  const roles = privilege.roles || [];
  const filtered = roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const rc = RISK_CONFIG[privilege.risk]
  return (
    <div>
      <div className="flex flex-wrap items-center gap-5 p-5 rounded-2xl mb-6 border-2" style={{ background: service.bgGradient, borderColor: `${service.color}33` }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${service.color}22` }}>
          <Shield size={20} style={{ color: service.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-base font-black" style={{ color: 'var(--theme-text-main)' }}>{privilege.name}</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg border" style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>{rc.label}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{privilege.description}</p>
        </div>
        <div className="flex gap-6">
          {[
            { label: 'Cost / user', value: fmtCost(privilege.costPerUser) },
            { label: 'Total cost',  value: fmtCost(privilege.totalCost)   },
            { label: 'Roles',       value: privilege.roles?.length ?? 0   },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-black" style={{ color: service.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      
      <AIInsightPanel privilegeName={privilege.name} color={service.color} />

      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roles…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border  outline-none" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-main)' }} />
      </div>

      <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-muted)' }}>Roles using this privilege — click to see employees</h2>
      {(!privilege.roles || privilege.roles.length === 0) ? (
        <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
          <Layers size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No roles assigned to this privilege</p>
        </div>
      ) : (
        <div className=" border rounded-xl overflow-hidden" style={{ background: 'var(--theme-bg-card)' }} style={{ borderColor: 'var(--theme-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}>
          <table className="w-full text-left text-sm">
            <thead className="border-b" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}>
              <tr>
                <th className="px-6 py-4 font-semibold">Role Name</th>
                <th className="px-6 py-4 font-semibold text-right">Employees</th>
                <th className="px-6 py-4 font-semibold text-right">Usage</th>
                <th className="px-6 py-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
              {paginated.map(role => {
                const isHot = role.licenseTotal > 0 && role.licenseUsed / role.licenseTotal >= 0.9
                return (
                  <tr key={role.id} className={`hover: transition-colors cursor-pointer group ${isHot ? 'bg-red-50/30' : ''}`} onClick={() => onSelectRole(role)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold" style={{ color: 'var(--theme-text-main)' }}>{role.name}</div>
                        {isHot && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: '#fef2f2', color: '#dc2626' }}>
                            <AlertTriangle size={10} /> Near Limit
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold" style={{ color: 'var(--theme-text-main)' }}>
                      {role.employeeCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 min-w-[150px]">
                      {role.licenseTotal > 0 ? (
                        <UsageBar used={role.licenseUsed} total={role.licenseTotal} color={isHot ? '#ef4444' : service.color} />
                      ) : (
                        <span className="text-slate-400 text-right block">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300 group-hover:text-blue-500 transition-colors">
                      <ChevronRight size={18} className="inline-block" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          )}
        </div>
      )}
      {roles.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No roles match your search</p>
        </div>
      )}
    </div>
  )
}

/* LEVEL 3 - EMPLOYEES */
function EmployeesView({ role, service }: { role: Role; service: Service }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => { setPage(1) }, [search]);
  
  const employees = role.employees ?? []
  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.department ?? '').toLowerCase().includes(search.toLowerCase())
  )
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-5 p-5 rounded-2xl mb-6 border-2" style={{ background: service.bgGradient, borderColor: `${service.color}33` }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${service.color}22` }}>
          <Layers size={20} style={{ color: service.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-black" style={{ color: 'var(--theme-text-main)' }}>{role.name}</h3>
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{role.employeeCount.toLocaleString()} employees assigned · {service.name}</p>
        </div>
        {role.licenseTotal > 0 && (
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
            <TrendingUp size={15} /> {role.licenseUsed} / {role.licenseTotal} licences
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="relative max-w-sm w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border  outline-none" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-main)' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          Showing <strong style={{ color: 'var(--theme-text-main)' }}>{filtered.length}</strong> of {employees.length} employees
        </p>
      </div>
      {employees.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No employee data for this role</p>
        </div>
      ) : (
        <>
          <div className=" border rounded-xl overflow-hidden" style={{ background: 'var(--theme-bg-card)' }} style={{ borderColor: 'var(--theme-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}>
            <table className="w-full text-left text-sm">
              <thead className="border-b" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}>
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
                {paginated.map((emp, i) => {
                  const sc = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.active
                  const avatarGrad = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
                  return (
                    <tr key={emp.id} className="hover: transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                            style={{ background: avatarGrad }}>
                            {emp.avatar || emp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold" style={{ color: 'var(--theme-text-main)' }}>{emp.name}</div>
                            {emp.email && <div className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{emp.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {emp.department ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                            {emp.department}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: sc.bg, color: sc.text }}>
                          <sc.Icon size={12} /> {sc.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <Pagination page={page} totalPages={totalPages} setPage={setPage} />
            )}
          </div>
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-10" style={{ color: 'var(--theme-text-muted)' }}>
              <p className="font-semibold">No employees match your search</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* LOADING */
function LoadingScreen() {
  const steps = ['Connecting to backend…', 'Fetching analysis data…', 'Building licence hierarchy…', 'Almost ready…']
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 700)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: 'var(--theme-blue-bg)' }} />
        <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--theme-blue-text)' }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--theme-text-main)' }}>Loading Analytics</p>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)', minHeight: '1.5rem' }}>{steps[step]}</p>
      </div>
    </div>
  )
}

/* EMPTY */
function EmptyScreen({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: '#fef2f2' }}>
        <FileX2 size={36} style={{ color: '#ef4444' }} />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--theme-text-main)' }}>No Data Available</h2>
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>Upload your Service Catalog and Usage Report to see the licence analytics.</p>
      </div>
      <button onClick={onGoBack} className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
        <ArrowLeft size={15} /> Back to Upload
      </button>
    </div>
  )
}

/* MAIN PAGE */
type Level = 'services' | 'privileges' | 'roles' | 'employees'

import { useTemplate } from '../context/TemplateContext';

export default function ResultsPage() {
  const { activeTemplateId, setActiveTemplateId } = useTemplate();
  const navigate  = useNavigate()
  const [status,  setStatus]  = useState<'loading' | 'ready' | 'empty'>('loading')
  const [result,  setResult]  = useState<ParseResult | null>(null)
  const [level,   setLevel]   = useState<Level>('services')
  const [selSvc,  setSelSvc]  = useState<Service   | null>(null)
  const [selPriv, setSelPriv] = useState<Privilege | null>(null)
  const [selRole, setSelRole] = useState<Role      | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/analysis-results')
        if (!res.ok) throw new Error('Not ready')
        const data = await res.json()
        if (cancelled) return
        if (data?.services?.length > 0) { setResult(data); setStatus('ready') }
        else setStatus('empty')
      } catch { if (!cancelled) setStatus('empty') }
    })()
    return () => { cancelled = true }
  }, [])

  function goServices()             { setLevel('services');  setSelSvc(null); setSelPriv(null); setSelRole(null) }
  function goPrivileges(s: Service) { setSelSvc(s);  setLevel('privileges'); setSelPriv(null); setSelRole(null) }
  function goRoles(p: Privilege)    { setSelPriv(p); setLevel('roles');      setSelRole(null) }
  function goEmployees(r: Role)     { setSelRole(r); setLevel('employees') }

  const crumbs: Crumb[] = [{ label: 'Services', icon: <BarChart3 size={12} />, onClick: goServices }]
  if (selSvc)  crumbs.push({ label: selSvc.name,  icon: <span className="text-xs">{selSvc.icon}</span>, onClick: () => goPrivileges(selSvc) })
  if (selPriv) crumbs.push({ label: selPriv.name, icon: <Shield size={12} />,                           onClick: () => goRoles(selPriv) })
  if (selRole) crumbs.push({ label: selRole.name, icon: <Layers size={12} />,                           onClick: () => {} })

  const pageTitle: Record<Level, string> = {
    services:   'Licence Analytics',
    privileges: `${selSvc?.name ?? ''} — Privileges`,
    roles:      `${selPriv?.name ?? ''} — Roles`,
    employees:  `${selRole?.name ?? ''} — Employees`,
  }

  return (
    <div className={`min-h-screen flex font-sans relative results-page-wrapper layout-${activeTemplateId}`}>
      <div className="relative z-10 w-full flex flex-col min-h-screen">
        <Header variant="upload" />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <button onClick={() => navigate('/upload')} className="flex items-center gap-1.5 text-sm font-semibold mb-3 transition-colors" style={{ color: 'var(--theme-text-muted)' }}>
              <ArrowLeft size={14} /> Back to Upload
            </button>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--theme-text-main)' }}>
              {status === 'loading' ? 'Loading…' : pageTitle[level]}
            </h1>
          </div>
          {status === 'ready' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <LayoutTemplate size={15} style={{ color: 'var(--theme-text-muted)' }} />
                <select 
                  value={activeTemplateId} 
                  onChange={(e) => setActiveTemplateId(e.target.value)}
                  className="text-sm font-semibold bg-transparent outline-none cursor-pointer"
                  style={{ color: 'var(--theme-text-main)' }}
                >
                  <option value="t2">Standard A4</option>
                  <option value="t3">Dark Mode Analytics</option>
                  <option value="t5">Minimalist Data</option>
                  <option value="t7">Enterprise Dashboard</option>
                  <option value="t1">Executive Summary Book</option>
                </select>
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-md"
                style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text-main)', border: '1px solid var(--theme-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Download size={15} /> Export Report
              </button>
            </div>
          )}
        </div>
        {status === 'ready' && crumbs.length > 1 && <Breadcrumb crumbs={crumbs} />}
        {status === 'loading' && <LoadingScreen />}
        {status === 'empty'   && <EmptyScreen onGoBack={() => navigate('/upload')} />}
        {status === 'ready' && result && (
          <>
            {level === 'services'   && <ServicesView   result={result}     onSelectService={goPrivileges} />}
            {level === 'privileges' && selSvc   && <PrivilegesView service={selSvc}    onSelectPrivilege={goRoles} />}
            {level === 'roles'      && selPriv && selSvc && <RolesView privilege={selPriv} service={selSvc} onSelectRole={goEmployees} />}
            {level === 'employees'  && selRole && selSvc && <EmployeesView role={selRole} service={selSvc} />}
          </>
        )}
        </main>
      </div>
    </div>
  )
}
