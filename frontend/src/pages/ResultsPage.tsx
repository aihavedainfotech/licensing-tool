import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Users, Shield,
  Layers, AlertTriangle, CheckCircle2, XCircle, Clock,
  Download, Loader2, FileX2,
  Sparkles, Brain, LayoutTemplate,
  TrendingUp, TrendingDown,
  Building2, LineChart, Search, GitBranch, RefreshCw
} from 'lucide-react'
import Header from '../components/Header'
import RemediationModal from '../components/RemediationModal'
import HierarchyRemediationModal from '../components/HierarchyRemediationModal'
import type { Service, Privilege, Role, Employee, ParseResult } from '../types'
import { useTemplate } from '../context/TemplateContext'

/* ─── Utilities ──────────────────────────────────────── */
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
  high:   { bg: 'transparent', text: '#ef4444', border: '#ef4444', dot: '#ef4444', label: 'HIGH' },
  medium: { bg: 'transparent', text: '#f59e0b', border: '#fde047', dot: '#f59e0b', label: 'MED'  },
  low:    { bg: 'transparent', text: '#10b981', border: '#10b981', dot: '#10b981', label: 'LOW'  },
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

/* ─── UsageBar ────────────────────────────────────────── */
function UsageBar({ used, total, color = '#1d6fa4' }: { used: number; total: number; color?: string }) {
  const actualPct = total > 0 ? Math.round((used / total) * 100) : 0
  const barWidth = Math.min(100, actualPct)
  const fill = actualPct >= 95 ? '#ef4444' : actualPct >= 80 ? '#f97316' : actualPct <= 35 ? '#10b981' : color
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] font-bold mb-2">
        <span style={{ color: 'var(--theme-text-muted)' }}>{used.toLocaleString()} used</span>
        <span style={{ color: actualPct >= 95 ? '#ef4444' : 'var(--theme-text-muted)' }}>
          {total > 0 ? `${actualPct}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-border)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barWidth}%`, background: fill }} />
      </div>
    </div>
  )
}

/* ─── RiskBadge ───────────────────────────────────────── */
function RiskBadge({ risk }: { risk: 'high' | 'medium' | 'low' }) {
  const c = RISK_CONFIG[risk]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.dot }} />
      {c.label}
    </span>
  )
}

/* ─── Loading ─────────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: 'var(--theme-border)' }} />
        <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
          style={{ borderTopColor: '#1d6fa4' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--theme-text-muted)' }}>Loading analysis results…</p>
    </div>
  )
}

/* ─── Empty ───────────────────────────────────────────── */
function EmptyScreen({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: '#fef2f2' }}>
        <FileX2 size={36} style={{ color: '#ef4444' }} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--theme-text-main)' }}>No Data Available</h2>
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>Upload your files to see licence analytics.</p>
      </div>
      <button onClick={onGoBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: '#1d6fa4', color: 'white' }}>
        <ArrowLeft size={15} /> Back to Upload
      </button>
    </div>
  )
}

/* ─── AI Insight ──────────────────────────────────────── */
function AIInsightPanel({ privilege, service, onRemediate }: { privilege: Privilege; service: Service; onRemediate?: () => void }) {
  const [insight, setInsight] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setInsight(null)
    setLoading(true)
    const model = localStorage.getItem('modelSuggest') || 'deepseek'
    fetch('http://localhost:3001/api/ai-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privilegeName: privilege.name, serviceName: service.name, model }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setInsight(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [privilege.id])

  function renderText(t: string) {
    if (!t) return null
    return t.split(/\*\*(.*?)\*\*/g).map((s, i) =>
      i % 2 === 1 ? <strong key={i}>{s}</strong> : s
    )
  }

  const [activeMethodTab, setActiveMethodTab] = useState<'all' | 'm1' | 'm2'>('all')

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-card)' }}>
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'linear-gradient(90deg,#4f46e5,#7c3aed)', color: 'white' }}>
        <Brain size={16} />
        <span className="text-sm font-bold">AI Insights</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex bg-black/20 p-0.5 rounded-md text-[10px] font-semibold">
            <button 
              onClick={() => setActiveMethodTab('all')}
              className={`px-2 py-0.5 rounded transition-all ${activeMethodTab === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/80 hover:text-white'}`}>
              All
            </button>
            <button 
              onClick={() => setActiveMethodTab('m1')}
              className={`px-2 py-0.5 rounded transition-all ${activeMethodTab === 'm1' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/80 hover:text-white'}`}>
              Method 1
            </button>
            <button 
              onClick={() => setActiveMethodTab('m2')}
              className={`px-2 py-0.5 rounded transition-all ${activeMethodTab === 'm2' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/80 hover:text-white'}`}>
              Method 2
            </button>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            {(localStorage.getItem('modelSuggest') || 'deepseek').startsWith('gemini') ? 'Gemini' : 'DeepSeek'}
          </span>
        </div>
      </div>
      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            <Loader2 size={14} className="animate-spin" /> Analysing…
          </div>
        )}
        {!loading && !insight && (
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>No AI data available.</p>
        )}
        {insight?.explanation && (
          <div className="space-y-3">
            {/* ── Method 1: 2-3 Lines Overview & Recommendation ── */}
            {(activeMethodTab === 'all' || activeMethodTab === 'm1') && (
              <div className="rounded-lg border overflow-hidden text-xs" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between border-b"
                  style={{ borderColor: 'var(--theme-border)', background: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5' }}>
                  <span>Method 1: Executive Summary & Recommendation</span>
                  <span className="text-[10px] font-semibold text-gray-500 normal-case">2–3 Lines</span>
                </div>
                <div className="p-3 space-y-2.5">
                  <div>
                    <p className="font-semibold text-xs mb-1 flex items-center gap-1" style={{ color: '#4f46e5' }}>
                      <Sparkles size={11} /> Overview
                    </p>
                    <p className="leading-relaxed" style={{ color: 'var(--theme-text-main)' }}>{renderText(insight.explanation)}</p>
                  </div>
                  {insight.alternative && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                      <p className="font-semibold text-xs mb-1 flex items-center gap-1" style={{ color: '#f97316' }}>
                        <TrendingDown size={11} /> Recommendation
                      </p>
                      <p className="leading-relaxed" style={{ color: 'var(--theme-text-main)' }}>{renderText(insight.alternative)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Method 2: Structured Direct Mapping (Costed vs Free Clarity) ── */}
            {(activeMethodTab === 'all' || activeMethodTab === 'm2') && (
              <div className="rounded-lg border overflow-hidden text-xs" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between border-b"
                  style={{ borderColor: 'var(--theme-border)', background: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5' }}>
                  <span>Method 2: Direct Privilege Mapping</span>
                  <span className="text-[10px] font-semibold text-gray-500 normal-case">Costed vs Free</span>
                </div>
                <div className="p-3 space-y-2.5">
                  {/* Current Costed Privilege */}
                  <div className="p-2.5 rounded-md border flex items-center justify-between gap-3 bg-red-50/60 border-red-200">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
                        Costed Privilege (Current)
                      </span>
                      <span className="font-mono font-bold text-gray-900 text-xs truncate block" title={insight.costedPrivilege || privilege.name}>
                        {insight.costedPrivilege || privilege.name}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-red-600 text-white shadow-sm shrink-0">
                      Costed: Yes (Paid)
                    </span>
                  </div>

                  {/* Alternate Free Privilege */}
                  <div className="p-2.5 rounded-md border flex items-center justify-between gap-3 bg-emerald-50/60 border-emerald-200">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                        Alternate Privilege (Replacement)
                      </span>
                      <span className="font-mono font-bold text-emerald-900 text-xs truncate block" title={insight.alternatePrivilege || 'None'}>
                        {insight.alternatePrivilege || 'Free / Lower-Cost Duty Role'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-sm shrink-0">
                      Costed: No (Free)
                    </span>
                  </div>

                  {/* Remediate Action Button */}
                  {onRemediate && (
                    <div className="pt-1">
                      <button
                        onClick={onRemediate}
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Sparkles size={13} />
                        <span>Remediate License: Clone Role & Swap Assignment</span>
                      </button>
                    </div>
                  )}

                  {/* Value-Add Impact if present */}
                  {insight.impact && insight.impact.trim().length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                      <p className="font-semibold text-xs mb-1 flex items-center gap-1" style={{ color: '#d97706' }}>
                        <AlertTriangle size={11} /> Functional Impact
                      </p>
                      <p className="text-amber-900 leading-relaxed">{renderText(insight.impact)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Panel Rail (collapsed service/privilege/role list) ─ */
function Rail({
  label, items, selectedId, onSelect, icon: Icon
}: {
  label: string
  items: { id: string; name: string; risk?: 'high' | 'medium' | 'low'; count?: number }[]
  selectedId: string
  onSelect: (id: string) => void
  icon: React.ElementType
}) {
  return (
    <div className="flex flex-col h-full border-r"
      style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-card)', minWidth: 0 }}>
      <div className="px-3 py-2 border-b flex items-center gap-1.5"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
        <Icon size={11} style={{ color: 'var(--theme-text-muted)' }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--theme-text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.map(item => {
          const isActive = item.id === selectedId
          return (
            <button key={item.id}
              onClick={() => onSelect(item.id)}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2 border-b transition-colors text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                background: isActive ? '#1d6fa4' : 'transparent',
                color: isActive ? 'white' : 'var(--theme-text-main)',
              }}>
              <span className="flex-1 font-medium leading-tight break-words" style={{ wordBreak: 'break-word' }}>
                {item.name}
              </span>
              {item.risk && !isActive && (
                <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: RISK_CONFIG[item.risk].dot }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Services Grid ───────────────────────────────────── */
function ServicesGrid({ services, onSelect }: { services: Service[]; onSelect: (s: Service) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--theme-bg-page)' }}>
      <h2 className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-muted)' }}>
        {services.length} Services — click to explore
      </h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {services.map(svc => {
          const risk = svc.overProvisioned > 0 ? (svc.overProvisioned > 500 ? 'high' : 'medium') : 'low'
          const rc = RISK_CONFIG[risk]
          return (
            <button key={svc.id} onClick={() => onSelect(svc)}
              className="text-left rounded-xl p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 group flex flex-col"
              style={{ background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)', minHeight: '220px' }}>
              <div className="flex items-start justify-between gap-2 mb-3 w-full">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-muted)' }}>
                  <Building2 size={16} strokeWidth={2.5} />
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
                  style={{ background: rc.bg, color: rc.text, border: `1.5px solid ${rc.border}` }}>
                  {rc.label}
                </span>
              </div>
              <p className="text-[12px] font-bold leading-snug mb-3 w-full line-clamp-2"
                style={{ color: 'var(--theme-text-main)', minHeight: '34px' }}>
                {svc.name}
              </p>
              <div className="flex justify-end w-full mb-2">
                <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                  Min Qty: {svc.minimumQuantity || 1}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold mb-1 w-full" style={{ color: 'var(--theme-text-muted)' }}>
                <span>{fmtNum(svc.subscribedQuantity ?? svc.licenseCount)} licences</span>
                <span>{svc.privilegeCount} privileges</span>
              </div>
              <div className="w-full mt-auto">
                <UsageBar used={svc.licenseCount} total={svc.subscribedQuantity ?? svc.licenseCount} color="#3b82f6" />
                
                {/* Overage Warning in Card */}
                {svc.overageCost && svc.overageCost > 0 ? (
                  <div className="mt-3 pt-3 border-t flex justify-between items-center text-[11px] font-black"
                    style={{ borderColor: 'var(--theme-border)', color: '#ef4444' }}>
                    <span>Extra Cost</span>
                    <span>{fmtCost(svc.overageCost)}</span>
                  </div>
                ) : (
                  <div className="mt-3 pt-3" style={{ height: '37px' }}></div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Bottom Banner */}
      <div className="mt-8 rounded-2xl p-6 flex items-center relative overflow-hidden border"
        style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shadow-sm shrink-0"
          style={{ background: 'var(--theme-bg-hover)', color: 'var(--acc, #1D4ED8)' }}>
          <Building2 size={24} strokeWidth={2} />
        </div>
        <div className="z-10">
          <h3 className="text-[16px] font-black" style={{ color: 'var(--theme-text-main)' }}>Explore and optimize your license usage</h3>
          <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--theme-text-muted)' }}>Click on any service card to view detailed analytics, user breakdown, and optimization recommendations.</p>
        </div>
        
        {/* Banner Graphics */}
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-40 flex items-center justify-end pr-8 pointer-events-none">
          <div className="absolute w-32 h-32 rounded-full blur-2xl -right-10 top-0" style={{ background: 'var(--theme-bg-hover)' }}></div>
          <Sparkles size={20} className="absolute left-10 top-8" style={{ color: '#d47e3b', fill: '#d47e3b' }} />
          <Sparkles size={16} className="absolute right-20 bottom-6" style={{ color: '#d47e3b', fill: '#d47e3b' }} />
          <div className="relative z-10 w-16 h-20 rounded shadow-sm border mr-4 flex flex-col p-2"
            style={{ background: 'var(--theme-bg-page)', borderColor: 'var(--theme-border)' }}>
            <div className="w-full h-2 mb-1 rounded-sm" style={{ background: 'var(--theme-border)' }}></div>
            <div className="w-3/4 h-2 mb-4 rounded-sm" style={{ background: 'var(--theme-bg-hover)' }}></div>
            <div className="flex items-end gap-1 flex-1 px-1">
              <div className="w-1/3 h-1/2 bg-[#d47e3b] rounded-t-sm"></div>
              <div className="w-1/3 h-full bg-[#f4e2d3] rounded-t-sm"></div>
              <div className="w-1/3 h-3/4 bg-[var(--acc)] rounded-t-sm"></div>
            </div>
          </div>
          <div className="relative z-10 w-16 h-16 rounded-full shadow-sm border flex items-center justify-center absolute -bottom-2 -right-4"
            style={{ background: 'var(--theme-bg-page)', borderColor: 'var(--theme-border)' }}>
            <LineChart size={24} style={{ color: 'var(--acc, #1D4ED8)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Privileges Grid ─────────────────────────────────── */
function PrivilegesGrid({ privileges, service, onSelect }: {
  privileges: Privilege[]
  service: Service
  onSelect: (p: Privilege) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
      {/* Service Billing Summary */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-muted)' }}>
          Pricing Calculation: {service.name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 items-start">
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Actual Users</div>
            <div className="text-lg font-mono font-bold" style={{ color: 'var(--theme-text-main)' }}>{fmtNum(service.licenseCount)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Metric</div>
            <div className="text-sm font-semibold mt-1 truncate" style={{ color: 'var(--theme-text-main)' }}>
              {service.metric || 'Per User'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Min. Qty</div>
            <div className="text-lg font-mono font-bold" style={{ color: 'var(--theme-text-main)' }}>{service.minimumQuantity || 1}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Billing Units</div>
            <div className="text-lg font-mono font-bold" style={{ color: 'var(--theme-text-main)' }}>{fmtNum(service.billingUnits || service.licenseCount)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Unit Price</div>
            <div className="text-lg font-mono font-bold" style={{ color: 'var(--theme-text-main)' }}>{fmtCost(service.unitCost || 0)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Overage Cost</div>
            <div className="text-lg font-bold" style={{ color: '#ef4444' }}>{fmtCost(service.overageCost || 0)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Total Cost</div>
            <div className="text-lg font-bold" style={{ color: '#10b981' }}>{fmtCost(service.totalCost)}</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-muted)' }}>
          {privileges.length} Privileges — click to explore
        </h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {privileges.map(priv => (
          <button key={priv.id} onClick={() => onSelect(priv)}
            className="text-left rounded-xl border p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 group"
            style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--theme-blue-bg)' }}>
                <Shield size={14} style={{ color: 'var(--theme-blue-text)' }} />
              </div>
              <RiskBadge risk={priv.risk} />
            </div>
            <p className="text-xs font-bold leading-snug mb-1 group-hover:text-blue-600 transition-colors"
              style={{ color: 'var(--theme-text-main)', wordBreak: 'break-word' }}>
              {priv.name}
            </p>
            {priv.description && (
              <p className="text-[10px] mb-2 leading-relaxed"
                style={{ color: 'var(--theme-text-muted)', wordBreak: 'break-word' }}>
                {priv.description.length > 90 ? priv.description.slice(0, 90) + '…' : priv.description}
              </p>
            )}
            <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
              <span>{priv.roles?.length ?? 0} roles</span>
              <span>{fmtCost(priv.totalCost)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
    </div>
  )
}

/* ─── Roles Grid + AI ─────────────────────────────────── */
function RolesAndAI({ roles, privilege, service, onSelect, onRemediateRole }: {
  roles: Role[]
  privilege: Privilege
  service: Service
  onSelect: (r: Role) => void
  onRemediateRole?: (role: Role) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {/* Roles */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--theme-text-muted)' }}>
          {roles.length} Roles — click to see employees
        </h2>
        {roles.length === 0 ? (
          <div className="p-6 rounded-2xl border border-emerald-300 bg-emerald-50/80 text-emerald-950 flex flex-col items-center justify-center text-center gap-3 py-8 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 size={26} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-900">Costly Privilege Successfully Stripped!</h3>
              <p className="text-xs text-emerald-700 mt-1 max-w-md">
                No roles have this costly privilege assigned. All users have been remediated and reassigned to custom roles with the free alternative duty role.
              </p>
            </div>
          </div>
        ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {roles.map(role => {
            const pct = role.licenseTotal > 0 ? Math.round((role.licenseUsed / role.licenseTotal) * 100) : 0
            const isHot = pct >= 95
            const isRemediated = role.isRemediated || role.name.startsWith('XX_')
            return (
              <button key={role.id} onClick={() => onSelect(role)}
                className={`text-left rounded-xl border p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 group overflow-hidden flex flex-col justify-between ${
                  isRemediated ? 'border-emerald-300 ring-1 ring-emerald-200' : ''
                }`}
                style={{ background: isRemediated ? 'rgba(236, 253, 245, 0.5)' : 'var(--theme-bg-card)', borderColor: isRemediated ? '#86efac' : isHot ? '#fecaca' : 'var(--theme-border)', minHeight: '130px' }}>
                <div className="flex items-center gap-2 mb-2 w-full">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: isRemediated ? '#d1fae5' : isHot ? '#fef2f2' : 'var(--theme-blue-bg)' }}>
                    {isRemediated ? (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    ) : (
                      <Layers size={13} style={{ color: isHot ? '#dc2626' : 'var(--theme-blue-text)' }} />
                    )}
                  </div>
                  {isRemediated && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Reassigned
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-auto text-[10px] font-semibold shrink-0"
                    style={{ color: 'var(--theme-text-muted)' }}>
                    <Users size={10} />
                    {role.employeeCount}
                  </div>
                </div>
                <div className="w-full">
                  <p className="text-xs font-bold leading-snug mb-1 group-hover:text-blue-600 transition-colors w-full line-clamp-2"
                    style={{ color: 'var(--theme-text-main)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    title={role.name}>
                    {role.name}
                  </p>
                  {role.originalRoleName && (
                    <p className="text-[10px] text-gray-500 mb-2 truncate">
                      (reassigned from: <span className="line-through">{role.originalRoleName}</span>)
                    </p>
                  )}
                </div>
                <div className="w-full mt-auto">
                  <UsageBar used={role.licenseUsed} total={role.licenseTotal} color={isRemediated ? '#10b981' : service.color} />
                </div>
              </button>
            )
          })}
        </div>
        )}
      </div>

      {/* AI Insights */}
      <AIInsightPanel
        privilege={privilege}
        service={service}
        onRemediate={() => onRemediateRole && onRemediateRole(roles[0])}
      />
    </div>
  )
}


/* ─── Employees Table ─────────────────────────────────── */
function EmployeesPanel({ employees, role, service: _service, onRemediateEmployee, onHierarchyRemediate }: {
  employees: Employee[]
  role: Role
  service?: Service
  onRemediateEmployee?: (emp: Employee) => void
  onHierarchyRemediate?: (emp: Employee) => void
}) {
  const isRemediated = role.isRemediated || role.name.startsWith('XX_') || employees.some(e => e.isRemediated)

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Simulation Reassignment Notification Banner */}
      {isRemediated && (
        <div className="mb-3.5 p-3 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-950 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-emerald-900 uppercase tracking-wider">
                  Simulation Active: Role Reassigned
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                  {employees.length} Users Assigned
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                All <strong>{employees.length} employees</strong> previously under <em>"{role.originalRoleName || 'the previous role'}"</em> are now assigned to custom role <code className="font-mono font-bold bg-white/90 px-1 py-0.5 rounded border border-emerald-200 text-emerald-900">{role.name}</code> with costly privilege removed.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--theme-text-muted)' }}>
          {employees.length} Employees in {role.name}
        </h2>
        <div className="flex items-center gap-2">
          {employees.length > 0 && onRemediateEmployee && (
            <button
              onClick={() => onRemediateEmployee(employees[0])}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Sparkles size={12} /> Remediate
            </button>
          )}
          {employees.length > 0 && onHierarchyRemediate && (
            <button
              onClick={() => onHierarchyRemediate(employees[0])}
              className="px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
              title="Recursive hierarchy remediation: traverses role chain, clones parent services with XX_, strips costly privileges"
            >
              <GitBranch size={12} /> Hierarchy Remediate
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--theme-bg-hover)', borderBottom: '1px solid var(--theme-border)' }}>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Employee</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Assigned Role</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Email</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, idx) => {
              const sc = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.inactive
              const { Icon: StatusIcon } = sc
              const grad = AVATAR_PALETTE[idx % AVATAR_PALETTE.length]
              const empRoleName = emp.assignedRole || role.name
              const isEmpRemediated = emp.isRemediated || role.isRemediated || empRoleName.startsWith('XX_')
              return (
                <tr key={emp.id}
                  className="border-b transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--theme-border)', background: idx % 2 === 0 ? 'var(--theme-bg-card)' : 'var(--theme-bg-hover)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                        style={{ background: grad }}>
                        {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-xs" style={{ color: 'var(--theme-text-main)' }}>{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEmpRemediated ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 w-fit">
                          <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                          {empRoleName}
                        </span>
                        {(emp.previousRole || role.originalRoleName) && (
                          <span className="text-[9px] text-gray-400 line-through pl-1">
                            was: {emp.previousRole || role.originalRoleName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 w-fit">
                        {empRoleName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: sc.bg, color: sc.text }}>
                      <StatusIcon size={10} />{sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>{emp.email || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onRemediateEmployee && onRemediateEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors shadow-sm"
                      >
                        <Sparkles size={11} /> Remediate
                      </button>
                      {onHierarchyRemediate && (
                        <button
                          onClick={() => onHierarchyRemediate(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-white border transition-colors shadow-sm"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', borderColor: '#7c3aed' }}
                          title="Recursive hierarchy remediation"
                        >
                          <GitBranch size={11} /> Hierarchy
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── MAIN PAGE ───────────────────────────────────────── */
export default function ResultsPage() {
  const { activeTemplateId, setActiveTemplateId } = useTemplate()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [originalResult, setOriginalResult] = useState<ParseResult | null>(null)

  // Drill-down state
  const [selSvc, setSelSvc] = useState<Service | null>(null)
  const [selPriv, setSelPriv] = useState<Privilege | null>(null)
  const [selRole, setSelRole] = useState<Role | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/analysis-results')
        if (!res.ok) throw new Error('Not ready')
        const data = await res.json()
        if (cancelled) return
        if (data?.services?.length > 0) {
          setResult(data)
          setOriginalResult(JSON.parse(JSON.stringify(data)))
          setStatus('ready')
        }
        else setStatus('empty')
      } catch { if (!cancelled) setStatus('empty') }
    })()
    return () => { cancelled = true }
  }, [])

  function selectService(svc: Service) {
    setSelSvc(svc)
    setSelPriv(null)
    setSelRole(null)
  }
  function selectPrivilege(priv: Privilege) {
    setSelPriv(priv)
    setSelRole(null)
  }
  function selectRole(role: Role) {
    setSelRole(role)
  }

  // Hierarchy Remediation State
  const [hierarchyTarget, setHierarchyTarget] = useState<{
    isOpen: boolean
    serviceName: string
    targetRoleName: string
    targetUsername: string
    costlyPrivileges: Array<{ privilegeName: string; freeAlternative: string; parentServiceName: string }>
  } | null>(null)

  function openHierarchyRemediation(emp?: Employee, roleOverride?: Role) {
    const sName   = selSvc?.name || 'Oracle Fusion Time and Labor Cloud Service'
    const r       = roleOverride || selRole || selPriv?.roles?.[0]
    const rName   = r?.name || 'OTL Administrator US'
    const e       = emp || r?.employees?.[0]
    const eName   = e?.name || 'Parveen'

    // Build list of costly privileges from selected service, defaulting to the selected one
    const privs = selSvc?.privileges
      ?.filter(p => p.risk === 'high' || p.name === selPriv?.name)
      ?.slice(0, 10)
      ?.map(p => ({
        privilegeName:    p.name,
        freeAlternative:  `${p.name.split('_MANAGE_')[0]}_VIEW${p.name.includes('_PRIV') ? '_PRIV' : ''}`,
        parentServiceName: sName
      }))
    || [{
        privilegeName:    selPriv?.name || 'HWM_MANAGE_TIME_WORK_AREA_PRIV',
        freeAlternative:  'HWM_VIEW_TIME_WORK_AREA_PRIV',
        parentServiceName: sName
      }]

    setHierarchyTarget({
      isOpen: true,
      serviceName: sName,
      targetRoleName: rName,
      targetUsername: eName,
      costlyPrivileges: privs
    })
  }

  // Remediation Studio State
  const [remediationTarget, setRemediationTarget] = useState<{
    isOpen: boolean
    serviceName: string
    roleName: string
    employeeName: string
    employeeId: string
    costlyPrivilegeName: string
    serviceCost: number
    roleEmployees: Employee[]
    privilegeRoles: Role[]
  } | null>(null)

  function openRemediation(emp?: Employee, roleOverride?: Role) {
    const sName = selSvc?.name || 'Oracle Fusion Time and Labor Cloud Service'
    const r = roleOverride || selRole || (selPriv?.roles?.[0])
    const rName = r?.name || 'OTL Administrator US'
    const pName = selPriv?.name || 'HWM_MANAGE_TIME_WORK_AREA_PRIV'
    const e = emp || r?.employees?.[0]
    const eName = e?.name || 'Parveen'
    const eId = e?.id || '100597'
    const sCost = selSvc?.unitCost || 0
    const allEmps = r?.employees || (e ? [e] : [])
    const privRoles = selPriv?.roles || (r ? [r] : [])

    setRemediationTarget({
      isOpen: true,
      serviceName: sName,
      roleName: rName,
      employeeName: eName,
      employeeId: eId,
      costlyPrivilegeName: pName,
      serviceCost: sCost,
      roleEmployees: allEmps,
      privilegeRoles: privRoles
    })
  }

  // Audit verification banner state
  const [remediationAudit, setRemediationAudit] = useState<{
    serviceName: string
    savedLicenses: number
    roleName: string
    customRoleName: string
    costlyPrivilegeName?: string
    replacementPrivilege?: string | null
    swappedRoles?: Array<{
      originalRoleId: string
      originalRoleName: string
      customRoleName: string
      customRoleCode: string
      employees: Employee[]
    }>
  } | null>(null)

  function handleRevertSimulation() {
    if (originalResult) {
      const clonedOrig: ParseResult = JSON.parse(JSON.stringify(originalResult))
      setResult(clonedOrig)
      if (selSvc) {
        const origSvc = clonedOrig.services.find(s => s.id === selSvc.id || s.name === selSvc.name)
        if (origSvc) {
          setSelSvc(origSvc)
          if (selPriv) {
            const origPriv = origSvc.privileges.find(p => p.id === selPriv.id || p.name === selPriv.name)
            if (origPriv) {
              setSelPriv(origPriv)
              if (selRole) {
                const origRole = origPriv.roles.find(r => r.name === selRole.name || r.originalRoleName === selRole.name || r.name === selRole.originalRoleName)
                if (origRole) setSelRole(origRole)
              }
            }
          }
        }
      }
    }
    setRemediationAudit(null)
  }

  function handleApplySimulation(data: {
    serviceName: string
    roleName: string
    customRoleName: string
    employeeName: string
    savedLicenses: number
    costlyPrivilegeName?: string
    replacementPrivilege?: string | null
    swappedRoles?: Array<{
      originalRoleId: string
      originalRoleName: string
      customRoleName: string
      customRoleCode: string
      employees: Employee[]
    }>
  }) {
    if (!result) return

    const swappedRolesList = data.swappedRoles || []
    const swappedMap = new Map(swappedRolesList.map(s => [s.originalRoleName.toLowerCase(), s]))
    const swappedIdMap = new Map(swappedRolesList.map(s => [s.originalRoleId, s]))

    // 1. Update main result
    let updatedSelectedSvc: Service | null = null

    setResult(prev => {
      if (!prev) return null

      const nextServices = prev.services.map(s => {
        if (s.name !== data.serviceName) return s

        const newLicenseCount = Math.max(0, s.licenseCount - data.savedLicenses)
        const minQty = s.minimumQuantity || 1
        const billingUnits = Math.ceil(newLicenseCount / minQty)
        const billableQuantity = billingUnits * minQty
        const totalCost = billingUnits * (s.unitCost || 0)
        const overProvisioned = s.subscribedQuantity !== undefined ? Math.max(0, billableQuantity - s.subscribedQuantity) : 0
        const overageBillingUnits = overProvisioned > 0 ? Math.ceil(overProvisioned / minQty) : 0
        const overageCost = overageBillingUnits * (s.unitCost || 0)

        // Process privileges in this service
        let updatedPrivileges = s.privileges.map(p => {
          const isCostlyPriv = data.costlyPrivilegeName && (
            p.name.toLowerCase() === data.costlyPrivilegeName.toLowerCase() ||
            p.id === data.costlyPrivilegeName
          )

          if (isCostlyPriv) {
            // In the costly privilege: REMOVE all swapped roles!
            // The custom role (XX_...) does NOT have this costly privilege because it was stripped.
            // The previous role had its employees reassigned to the custom role.
            const updatedRoles = p.roles
              .map(r => {
                const swapMatch = swappedMap.get(r.name.toLowerCase()) || swappedIdMap.get(r.id)
                if (swapMatch) {
                  const swappedEmpIds = new Set((swapMatch.employees || []).map(e => e.id))
                  const remainingEmployees = (r.employees || []).filter(e => !swappedEmpIds.has(e.id))
                  return {
                    ...r,
                    employeeCount: remainingEmployees.length,
                    licenseUsed: remainingEmployees.length,
                    employees: remainingEmployees
                  }
                }
                return r
              })
              .filter(r => r.employeeCount > 0) // Costly privilege is stripped; role is removed when 0 employees

            const newUsage = updatedRoles.reduce((sum, r) => sum + r.licenseUsed, 0)
            return {
              ...p,
              roles: updatedRoles,
              usageCount: newUsage,
              totalCost: newUsage * p.costPerUser
            }
          }

          // If this is the alternate privilege: ensure custom role and assigned users are attached
          const isAltPriv = data.replacementPrivilege && p.name.toLowerCase() === data.replacementPrivilege.toLowerCase()
          if (isAltPriv) {
            const updatedRoles = [...p.roles]
            swappedRolesList.forEach(swapMatch => {
              const exists = updatedRoles.find(r => r.name.toLowerCase() === swapMatch.customRoleName.toLowerCase())
              const newRoleEntry: Role = {
                id: `role_${swapMatch.customRoleCode}`,
                name: swapMatch.customRoleName,
                originalRoleName: swapMatch.originalRoleName,
                employeeCount: (swapMatch.employees || []).length,
                licenseUsed: (swapMatch.employees || []).length,
                licenseTotal: (swapMatch.employees || []).length,
                isRemediated: true,
                remediationNote: `Granted alternative free duty role`,
                employees: (swapMatch.employees || []).map(emp => ({
                  ...emp,
                  assignedRole: swapMatch.customRoleName,
                  previousRole: swapMatch.originalRoleName,
                  isRemediated: true
                }))
              }
              if (exists) {
                const idx = updatedRoles.indexOf(exists)
                updatedRoles[idx] = newRoleEntry
              } else {
                updatedRoles.push(newRoleEntry)
              }
            })
            return {
              ...p,
              roles: updatedRoles,
              usageCount: updatedRoles.reduce((sum, r) => sum + r.licenseUsed, 0)
            }
          }

          // In other privileges, update role labels and employees so they consistently show the new role
          const updatedRoles = p.roles.map(r => {
            const swapMatch = swappedMap.get(r.name.toLowerCase()) || swappedIdMap.get(r.id)
            if (swapMatch) {
              return {
                ...r,
                name: swapMatch.customRoleName,
                originalRoleName: r.name,
                isRemediated: true,
                employees: (swapMatch.employees || []).map(emp => ({
                  ...emp,
                  assignedRole: swapMatch.customRoleName,
                  previousRole: r.name,
                  isRemediated: true
                }))
              }
            }
            return r
          })

          return {
            ...p,
            roles: updatedRoles
          }
        })

        // If replacementPrivilege was specified and doesn't exist in service privileges, append it as a free alternative duty role
        if (data.replacementPrivilege && !updatedPrivileges.some(p => p.name.toLowerCase() === data.replacementPrivilege!.toLowerCase())) {
          const altPrivRoles: Role[] = swappedRolesList.map(swapMatch => ({
            id: `role_${swapMatch.customRoleCode}`,
            name: swapMatch.customRoleName,
            originalRoleName: swapMatch.originalRoleName,
            employeeCount: (swapMatch.employees || []).length,
            licenseUsed: (swapMatch.employees || []).length,
            licenseTotal: (swapMatch.employees || []).length,
            isRemediated: true,
            remediationNote: `Granted alternative free duty role`,
            employees: (swapMatch.employees || []).map(emp => ({
              ...emp,
              assignedRole: swapMatch.customRoleName,
              previousRole: swapMatch.originalRoleName,
              isRemediated: true
            }))
          }))

          updatedPrivileges.push({
            id: `alt_priv_${Date.now()}`,
            name: data.replacementPrivilege,
            description: `Replacement Free / Lower-Cost Alternative Duty Role (Eliminates Paid SKU)`,
            costPerUser: 0,
            totalCost: 0,
            usageCount: data.savedLicenses,
            usageLimit: 999999,
            risk: 'low',
            roles: altPrivRoles
          })
        }

        const updatedServiceObj: Service = {
          ...s,
          licenseCount: newLicenseCount,
          billingUnits,
          billableQuantity,
          totalCost,
          overProvisioned,
          overageCost,
          privileges: updatedPrivileges
        }

        updatedSelectedSvc = updatedServiceObj
        return updatedServiceObj
      })

      return {
        ...prev,
        services: nextServices
      }
    })

    // 2. Also update currently selected service
    setSelSvc(prev => {
      if (!prev || prev.name !== data.serviceName) return prev
      return updatedSelectedSvc || prev
    })

    // 3. Update currently selected privilege:
    // Focus on the newly granted alternate privilege so the user immediately sees the new role and users!
    setSelPriv(prevPriv => {
      if (updatedSelectedSvc) {
        if (data.replacementPrivilege) {
          const altFound = (updatedSelectedSvc as Service).privileges.find(p =>
            p.name.toLowerCase() === data.replacementPrivilege!.toLowerCase()
          )
          if (altFound) return altFound
        }
        if (prevPriv) {
          const found = (updatedSelectedSvc as Service).privileges.find(p =>
            p.id === prevPriv.id || p.name.toLowerCase() === prevPriv.name.toLowerCase()
          )
          if (found) return found
        }
      }
      return prevPriv
    })

    // 4. Update currently selected role: assign users to the new custom role!
    setSelRole(prevRole => {
      if (!prevRole) return null
      const matchedSwap = swappedRolesList.find(s =>
        s.originalRoleName.toLowerCase() === prevRole.name.toLowerCase() ||
        s.originalRoleId === prevRole.id ||
        s.customRoleName.toLowerCase() === prevRole.name.toLowerCase()
      )
      if (matchedSwap) {
        return {
          ...prevRole,
          id: `role_${matchedSwap.customRoleCode}`,
          name: matchedSwap.customRoleName,
          originalRoleName: prevRole.originalRoleName || prevRole.name,
          employeeCount: (matchedSwap.employees || []).length,
          licenseUsed: 0,
          isRemediated: true,
          remediationNote: `Costly privilege stripped • Reassigned to ${matchedSwap.customRoleName}`,
          employees: (matchedSwap.employees || []).map(emp => ({
            ...emp,
            assignedRole: matchedSwap.customRoleName,
            previousRole: prevRole.originalRoleName || prevRole.name,
            isRemediated: true
          }))
        }
      }
      return prevRole
    })

    // 5. Set audit confirmation
    setRemediationAudit({
      serviceName: data.serviceName,
      savedLicenses: data.savedLicenses,
      roleName: data.roleName,
      customRoleName: data.customRoleName,
      costlyPrivilegeName: data.costlyPrivilegeName,
      replacementPrivilege: data.replacementPrivilege,
      swappedRoles: swappedRolesList
    })
  }

  // Determine layout level: 0=services, 1=privileges, 2=roles+ai, 3=employees
  const level = selRole ? 3 : selPriv ? 2 : selSvc ? 1 : 0

  // Grid template columns based on level — clean focus on selected service!
  const gridCols = (() => {
    if (level === 0) return '1fr'                       // All services grid
    if (level === 1) return '1fr'                       // Selected service privileges & pricing full width
    if (level === 2) return '330px 1fr'                 // Privileges rail of this service | roles + ai
    if (level === 3) return '260px 260px 1fr'           // Priv rail | roles rail | employees
    return '1fr'
  })()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--theme-bg-page)' }}>
      {/* Header */}
      <Header variant="upload" />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-8 py-4 border-b transition-colors"
        style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button onClick={() => navigate('/upload')}
            className="flex items-center gap-1 text-[13px] font-bold transition-colors hover:underline"
            style={{ color: 'var(--theme-text-muted)' }}>
            <ArrowLeft size={14} /> Upload
          </button>
          <ChevronRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
          <button onClick={() => { setSelSvc(null); setSelPriv(null); setSelRole(null) }}
            className="text-[13px] font-black transition-colors hover:underline"
            style={{ color: selSvc ? 'var(--theme-text-muted)' : 'var(--theme-text-main)' }}>
            Licence Analytics
          </button>
          {selSvc && <>
            <ChevronRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
            <button onClick={() => { setSelPriv(null); setSelRole(null) }}
              className="text-[13px] font-black truncate max-w-[220px] transition-colors hover:underline"
              style={{ color: selPriv ? 'var(--theme-text-muted)' : 'var(--theme-text-main)' }}>
              {selSvc.name}
            </button>
          </>}
          {selPriv && <>
            <ChevronRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
            <button onClick={() => setSelRole(null)}
              className="text-[13px] font-black truncate max-w-[200px] transition-colors hover:underline"
              style={{ color: selRole ? 'var(--theme-text-muted)' : 'var(--theme-text-main)' }}>
              {selPriv.name}
            </button>
          </>}
          {selRole && <>
            <ChevronRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
            <span className="text-[13px] font-black truncate max-w-[200px]" style={{ color: 'var(--theme-text-main)' }}>
              {selRole.name}
            </span>
          </>}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative mr-2 hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--theme-text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-8 pr-3 py-1.5 rounded-lg text-[13px] border focus:outline-none w-48 transition-colors"
              style={{ backgroundColor: 'var(--theme-bg-hover)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-main)' }}
            />
          </div>
          {status === 'ready' && result && (
            <>
              {(() => {
                const totalExtraCost = result.services.reduce((sum, s) => sum + (s.overageCost || 0), 0)
                if (totalExtraCost > 0) {
                  return (
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg border font-black text-[13px]"
                      style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                      <TrendingUp size={16} /> Overage: {fmtCost(totalExtraCost)}
                    </div>
                  )
                }
                return null
              })()}
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border"
                style={{ background: 'var(--theme-bg-hover)', borderColor: 'var(--theme-border)' }}>
                <LayoutTemplate size={16} style={{ color: 'var(--theme-text-muted)' }} />
                <select value={activeTemplateId} onChange={e => setActiveTemplateId(e.target.value)}
                  className="text-[13px] font-black bg-transparent outline-none cursor-pointer"
                  style={{ color: 'var(--theme-text-main)' }}>
                  <option value="t2" style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text-main)' }}>Standard</option>
                  <option value="t3" style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text-main)' }}>Dark Mode</option>
                  <option value="t5" style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text-main)' }}>Minimal</option>
                  <option value="t7" style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text-main)' }}>Enterprise</option>
                  <option value="t1" style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text-main)' }}>Executive</option>
                </select>
              </div>
              <button className="flex items-center gap-1.5 px-6 py-2 rounded-lg text-[13px] font-black shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: 'var(--acc, #1D4ED8)', color: 'white' }}>
                <Download size={16} /> Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* Remediation Audit Verification Banner */}
      {remediationAudit && (
        <div className="mx-8 mt-3 p-3.5 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 text-emerald-950 flex items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-emerald-900 uppercase tracking-wider">
                  Simulation Applied: Users Reassigned
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                  -{remediationAudit.savedLicenses} Licenses Saved
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                All users previously under <strong>{remediationAudit.roleName}</strong> are now assigned to custom role <code className="bg-white/90 px-1.5 py-0.5 rounded border border-emerald-300 font-mono text-[11px] font-bold text-emerald-900">{remediationAudit.customRoleName}</code> with costly privilege <em>"{remediationAudit.costlyPrivilegeName || 'costly privilege'}"</em> stripped{remediationAudit.replacementPrivilege ? ` and alternative duty role "${remediationAudit.replacementPrivilege}" assigned.` : ' (no alternative duty role assigned).'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {originalResult && (
              <button
                onClick={handleRevertSimulation}
                className="text-amber-800 hover:text-amber-950 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors flex items-center gap-1.5 shadow-sm"
                title="Restore original licensing and role assignments"
              >
                <RefreshCw size={12} /> Revert Simulation
              </button>
            )}
            <button
              onClick={() => setRemediationAudit(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      {status === 'loading' && <LoadingScreen />}
      {status === 'empty' && <EmptyScreen onGoBack={() => navigate('/upload')} />}
      {status === 'ready' && result && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Cascading Panels */}
          <div
            className="flex-1 min-h-0 overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              transition: 'grid-template-columns 0.35s cubic-bezier(0.4,0,0.2,1)',
            }}>

            {/* Panel 0: Services (Only when no service is selected) */}
            {level === 0 && (
              <ServicesGrid services={result.services} onSelect={selectService} />
            )}

            {/* Panel 1: Privileges Grid for Selected Service (Full-width clean view) */}
            {level === 1 && selSvc && (
              <PrivilegesGrid privileges={selSvc.privileges} service={selSvc} onSelect={selectPrivilege} />
            )}

            {/* Level 2 & 3: Privileges Rail (Only for this selected service) */}
            {level >= 2 && selSvc && (
              <Rail
                label="Privileges"
                icon={Shield}
                items={(selSvc.privileges).map(p => ({ id: p.id, name: p.name, risk: p.risk }))}
                selectedId={selPriv?.id ?? ''}
                onSelect={id => {
                  const p = selSvc.privileges.find(p => p.id === id)
                  if (p) selectPrivilege(p)
                }}
              />
            )}

            {/* Panel 2: Roles + AI (when level === 2) or Roles Rail (when level === 3) */}
            {level >= 2 && selPriv && selSvc && (
              level === 2 ? (
                <RolesAndAI
                  roles={selPriv.roles}
                  privilege={selPriv}
                  service={selSvc}
                  onSelect={selectRole}
                  onRemediateRole={(r) => openRemediation(undefined, r)}
                />
              ) : (
                <Rail
                  label="Roles"
                  icon={Layers}
                  items={(selPriv.roles).map(r => ({ id: r.id, name: r.name, count: r.employeeCount }))}
                  selectedId={selRole?.id ?? ''}
                  onSelect={id => {
                    const r = selPriv.roles.find(r => r.id === id)
                    if (r) selectRole(r)
                  }}
                />
              )
            )}

            {/* Panel 3: Employees */}
            {level === 3 && selRole && selSvc && (
              <EmployeesPanel
                employees={selRole.employees}
                role={selRole}
                service={selSvc}
                onRemediateEmployee={(emp) => openRemediation(emp, selRole)}
                onHierarchyRemediate={(emp) => openHierarchyRemediation(emp, selRole)}
              />
            )}
          </div>
        </div>
      )}

      {/* Remediation Studio Modal */}
      {remediationTarget && (
        <RemediationModal
          isOpen={remediationTarget.isOpen}
          onClose={() => setRemediationTarget(null)}
          serviceName={remediationTarget.serviceName}
          roleName={remediationTarget.roleName}
          employeeName={remediationTarget.employeeName}
          employeeId={remediationTarget.employeeId}
          costlyPrivilegeName={remediationTarget.costlyPrivilegeName}
          serviceCost={remediationTarget.serviceCost}
          roleEmployees={remediationTarget.roleEmployees}
          privilegeRoles={remediationTarget.privilegeRoles}
          onApplySimulation={handleApplySimulation}
        />
      )}

      {/* Hierarchy Remediation Modal */}
      {hierarchyTarget && (
        <HierarchyRemediationModal
          isOpen={hierarchyTarget.isOpen}
          onClose={() => setHierarchyTarget(null)}
          serviceName={hierarchyTarget.serviceName}
          targetRoleName={hierarchyTarget.targetRoleName}
          targetUsername={hierarchyTarget.targetUsername}
          costlyPrivileges={hierarchyTarget.costlyPrivileges}
          onApplySimulation={(data) => handleApplySimulation({
            serviceName: hierarchyTarget.serviceName,
            roleName: hierarchyTarget.targetRoleName,
            customRoleName: `XX_${hierarchyTarget.targetRoleName}`,
            employeeName: data.employeeName,
            savedLicenses: data.savedLicenses,
            swappedRoles: [{
              originalRoleId: hierarchyTarget.targetRoleName,
              originalRoleName: hierarchyTarget.targetRoleName,
              customRoleName: `XX_${hierarchyTarget.targetRoleName}`,
              customRoleCode: `XX_${hierarchyTarget.targetRoleName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`,
              employees: [{ id: '100597', name: data.employeeName, email: '', department: '', status: 'active' as const, avatar: '' }]
            }]
          })}
        />
      )}
    </div>
  )
}
