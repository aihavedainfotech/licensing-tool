import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Users, Shield,
  Layers, AlertTriangle, CheckCircle2, XCircle, Clock,
  Download, Loader2, FileX2,
  BarChart3, Key, Sparkles, Brain, LayoutTemplate,
  ChevronLeft, Package, TrendingUp, TrendingDown,
  Building2, LineChart
} from 'lucide-react'
import Header from '../components/Header'
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
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const fill = pct >= 95 ? '#ef4444' : pct >= 80 ? '#f97316' : pct <= 35 ? '#10b981' : color
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] font-bold mb-2">
        <span style={{ color: '#6d5f53' }}>{used.toLocaleString()} used</span>
        <span style={{ color: pct >= 95 ? '#ef4444' : '#6d5f53' }}>{total > 0 ? `${pct}%` : '—'}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#efebe4' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: fill }} />
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
function AIInsightPanel({ privilege, service }: { privilege: Privilege; service: Service }) {
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

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-card)' }}>
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'linear-gradient(90deg,#4f46e5,#7c3aed)', color: 'white' }}>
        <Brain size={16} />
        <span className="text-sm font-bold">AI Insights</span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.2)' }}>
          {(localStorage.getItem('modelSuggest') || 'deepseek').startsWith('gemini') ? 'Gemini' : 'DeepSeek'}
        </span>
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
            <div className="p-3 rounded-lg border-l-4 border-blue-500 text-sm" style={{ background: 'var(--theme-bg-hover)' }}>
              <p className="font-semibold text-xs mb-1 flex items-center gap-1" style={{ color: '#4f46e5' }}>
                <Sparkles size={11} /> Overview
              </p>
              <p style={{ color: 'var(--theme-text-main)' }}>{renderText(insight.explanation)}</p>
            </div>
            {insight.alternative && (
              <div className="p-3 rounded-lg border-l-4 border-orange-400 text-sm" style={{ background: 'var(--theme-bg-hover)' }}>
                <p className="font-semibold text-xs mb-1 flex items-center gap-1" style={{ color: '#f97316' }}>
                  <TrendingDown size={11} /> Recommendation
                </p>
                <p style={{ color: 'var(--theme-text-main)' }}>{renderText(insight.alternative)}</p>
              </div>
            )}
            {insight.impact && (
              <div className="p-3 rounded-lg border-l-4 border-amber-400 text-sm" style={{ background: '#fffbeb' }}>
                <p className="font-semibold text-xs mb-1 flex items-center gap-1" style={{ color: '#d97706' }}>
                  <AlertTriangle size={11} /> Impact
                </p>
                <p style={{ color: '#92400e' }}>{renderText(insight.impact)}</p>
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

/* ─── ServiceRail (column table view) ────────────────── */
function ServiceRail({ services, selectedId, onSelect }: {
  services: Service[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full border-r overflow-hidden"
      style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-card)', minWidth: 0 }}>
      {/* Fixed header */}
      <div style={{ borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
        <table className="w-full" style={{ tableLayout: 'fixed', fontSize: '10px' }}>
          <colgroup>
            <col style={{ width: '32%' }} /><col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} /><col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} /><col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left px-2 py-2 font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }}>
                <span className="flex items-center gap-1"><Package size={9} />Service</span>
              </th>
              <th className="text-right px-2 py-2 font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }} title="Actual Active Users">Users</th>
              <th className="text-right px-2 py-2 font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }} title="Purchased Quantity">Pur.</th>
              <th className="text-right px-2 py-2 font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }}>Cost</th>
              <th className="text-right px-2 py-2 font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }}>Over</th>
              <th className="text-center px-2 py-2 font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }}>Risk</th>
            </tr>
          </thead>
        </table>
      </div>
      {/* Scrollable rows */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full" style={{ tableLayout: 'fixed', fontSize: '10px', borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ width: '32%' }} /><col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} /><col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} /><col style={{ width: '14%' }} />
          </colgroup>
          <tbody>
            {services.map((svc, idx) => {
              const isActive = svc.id === selectedId
              const risk = svc.overProvisioned > 0 ? (svc.overProvisioned > 500 ? 'high' : 'medium') : 'low'
              const rc = RISK_CONFIG[risk]
              const purchased = svc.subscribedQuantity ?? svc.licenseCount
              return (
                <tr key={svc.id}
                  onClick={() => onSelect(svc.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    background: isActive ? '#1d6fa4' : idx % 2 === 0 ? 'var(--theme-bg-card)' : 'var(--theme-bg-hover)',
                    borderBottom: '1px solid var(--theme-border)',
                  }}>
                  <td className="px-2 py-1.5 font-semibold" style={{ color: isActive ? 'white' : 'var(--theme-text-main)', wordBreak: 'break-word', lineHeight: '1.3' }}>
                    <div className="flex flex-col">
                      <div>
                        {svc.overProvisioned > 0 && <span style={{ color: isActive ? '#fcd34d' : '#ef4444' }}>⚠ </span>}
                        {svc.name}
                      </div>
                      <span className="text-[9px] mt-0.5" style={{ color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--theme-text-muted)' }}>
                        Min Qty: {svc.minimumQuantity || 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums"
                    style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--theme-text-main)' }}>
                    {svc.licenseCount.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums"
                    style={{ color: isActive ? 'rgba(255,255,255,0.65)' : 'var(--theme-text-muted)' }}>
                    {purchased.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold"
                    style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--theme-text-main)' }}>
                    {fmtCost(svc.totalCost)}
                  </td>
                  {/* Over / Spare column */}
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums">
                    {(() => {
                      const diff = svc.licenseCount - purchased
                      if (diff > 0) return (
                        <div className="flex flex-col items-end">
                          <span style={{ color: isActive ? '#fca5a5' : '#dc2626' }}>+{diff.toLocaleString()}</span>
                          {svc.overageCost && svc.overageCost > 0 ? (
                            <span className="text-[9px]" style={{ color: isActive ? '#fca5a5' : '#ef4444' }}>
                              (+{fmtCost(svc.overageCost)})
                            </span>
                          ) : null}
                        </div>
                      )
                      if (diff < 0) return (
                        <span style={{ color: isActive ? '#86efac' : '#059669' }}>{diff.toLocaleString()}</span>
                      )
                      return <span style={{ color: 'var(--theme-text-muted)' }}>0</span>
                    })()}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.2)' : rc.bg,
                        color: isActive ? 'white' : rc.text,
                      }}>{rc.label}</span>
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

/* ─── Services Grid ───────────────────────────────────── */
function ServicesGrid({ services, onSelect }: { services: Service[]; onSelect: (s: Service) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#fdfbf7]">
      <h2 className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: '#8a7d71' }}>
        {services.length} Services — click to explore
      </h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {services.map(svc => {
          const risk = svc.overProvisioned > 0 ? (svc.overProvisioned > 500 ? 'high' : 'medium') : 'low'
          const rc = RISK_CONFIG[risk]
          return (
            <button key={svc.id} onClick={() => onSelect(svc)}
              className="text-left rounded-xl p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 group bg-white flex flex-col"
              style={{ border: '1px solid #efebe4', minHeight: '220px' }}>
              <div className="flex items-start justify-between gap-2 mb-3 w-full">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#f5eee6', color: '#6d5f53' }}>
                  <Building2 size={16} strokeWidth={2.5} />
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
                  style={{ background: rc.bg, color: rc.text, border: `1.5px solid ${rc.border}` }}>
                  {rc.label}
                </span>
              </div>
              <p className="text-[12px] font-bold leading-snug mb-3 w-full line-clamp-2"
                style={{ color: '#31231a', minHeight: '34px' }}>
                {svc.name}
              </p>
              <div className="flex justify-end w-full mb-2">
                <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#8a7d71' }}>
                  Min Qty: {svc.minimumQuantity || 1}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold mb-1 w-full" style={{ color: '#6d5f53' }}>
                <span>{fmtNum(svc.subscribedQuantity ?? svc.licenseCount)} licences</span>
                <span>{svc.privilegeCount} privileges</span>
              </div>
              <div className="w-full mt-auto">
                <UsageBar used={svc.licenseCount} total={svc.subscribedQuantity ?? svc.licenseCount} color="#3b82f6" />
                
                {/* Overage Warning in Card */}
                {svc.overageCost && svc.overageCost > 0 ? (
                  <div className="mt-3 pt-3 border-t flex justify-between items-center text-[11px] font-black"
                    style={{ borderColor: '#efebe4', color: '#ef4444' }}>
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
      <div className="mt-8 rounded-2xl p-6 flex items-center relative overflow-hidden" style={{ background: '#fcf0e6' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white mr-4 shadow-sm shrink-0" style={{ color: '#ba6017' }}>
          <Building2 size={24} strokeWidth={2} />
        </div>
        <div className="z-10">
          <h3 className="text-[16px] font-black" style={{ color: '#31231a' }}>Explore and optimize your license usage</h3>
          <p className="text-[13px] font-medium mt-1" style={{ color: '#6d5f53' }}>Click on any service card to view detailed analytics, user breakdown, and optimization recommendations.</p>
        </div>
        
        {/* Banner Graphics */}
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-60 flex items-center justify-end pr-8">
          <div className="absolute w-32 h-32 bg-[#f4e2d3] rounded-full blur-2xl -right-10 top-0"></div>
          <Sparkles size={20} className="absolute left-10 top-8" style={{ color: '#d47e3b', fill: '#d47e3b' }} />
          <Sparkles size={16} className="absolute right-20 bottom-6" style={{ color: '#d47e3b', fill: '#d47e3b' }} />
          <div className="relative z-10 w-16 h-20 bg-white rounded shadow-sm border border-[#efebe4] mr-4 flex flex-col p-2">
            <div className="w-full h-2 bg-[#f4e2d3] mb-1 rounded-sm"></div>
            <div className="w-3/4 h-2 bg-[#efebe4] mb-4 rounded-sm"></div>
            <div className="flex items-end gap-1 flex-1 px-1">
              <div className="w-1/3 h-1/2 bg-[#d47e3b] rounded-t-sm"></div>
              <div className="w-1/3 h-full bg-[#f4e2d3] rounded-t-sm"></div>
              <div className="w-1/3 h-3/4 bg-[#ba6017] rounded-t-sm"></div>
            </div>
          </div>
          <div className="relative z-10 w-16 h-16 bg-white rounded-full shadow-sm border border-[#efebe4] flex items-center justify-center absolute -bottom-2 -right-4">
            <LineChart size={24} style={{ color: '#ba6017' }} />
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Actual Users</div>
            <div className="text-lg font-mono">{fmtNum(service.licenseCount)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Metric</div>
            <div className="text-sm font-semibold mt-1" style={{ color: 'var(--theme-text-main)' }}>
              {service.metric || 'Per User'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Min. Qty</div>
            <div className="text-lg font-mono">{service.minimumQuantity || 1}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Billing Units</div>
            <div className="text-lg font-mono">{fmtNum(service.billingUnits || service.licenseCount)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Unit Price</div>
            <div className="text-lg font-mono">{fmtCost(service.unitCost || 0)}</div>
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
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
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
              style={{ color: 'var(--theme-text-main)' }}>
              {priv.name}
            </p>
            {priv.description && (
              <p className="text-[10px] mb-2 leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                {priv.description.length > 80 ? priv.description.slice(0, 80) + '…' : priv.description}
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
function RolesAndAI({ roles, privilege, service, onSelect }: {
  roles: Role[]
  privilege: Privilege
  service: Service
  onSelect: (r: Role) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {/* Roles */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--theme-text-muted)' }}>
          {roles.length} Roles — click to see employees
        </h2>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {roles.map(role => {
            const pct = role.licenseTotal > 0 ? Math.round((role.licenseUsed / role.licenseTotal) * 100) : 0
            const isHot = pct >= 95
            return (
              <button key={role.id} onClick={() => onSelect(role)}
                className="text-left rounded-xl border p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 group"
                style={{ background: 'var(--theme-bg-card)', borderColor: isHot ? '#fecaca' : 'var(--theme-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: isHot ? '#fef2f2' : 'var(--theme-blue-bg)' }}>
                    <Layers size={13} style={{ color: isHot ? '#dc2626' : 'var(--theme-blue-text)' }} />
                  </div>
                  <div className="flex items-center gap-1 ml-auto text-[10px] font-semibold"
                    style={{ color: 'var(--theme-text-muted)' }}>
                    <Users size={10} />
                    {role.employeeCount}
                  </div>
                </div>
                <p className="text-xs font-bold leading-snug mb-2 group-hover:text-blue-600 transition-colors"
                  style={{ color: 'var(--theme-text-main)' }}>
                  {role.name}
                </p>
                <UsageBar used={role.licenseUsed} total={role.licenseTotal} color={service.color} />
              </button>
            )
          })}
        </div>
      </div>

      {/* AI Insights */}
      <AIInsightPanel privilege={privilege} service={service} />
    </div>
  )
}

/* ─── Employees Table ─────────────────────────────────── */
function EmployeesPanel({ employees, role, service }: {
  employees: Employee[]
  role: Role
  service: Service
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--theme-text-muted)' }}>
        {employees.length} Employees in {role.name}
      </h2>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--theme-bg-hover)', borderBottom: '1px solid var(--theme-border)' }}>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Employee</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, idx) => {
              const sc = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.inactive
              const { Icon: StatusIcon } = sc
              const grad = AVATAR_PALETTE[idx % AVATAR_PALETTE.length]
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
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: sc.bg, color: sc.text }}>
                      <StatusIcon size={10} />{sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>{emp.email || '—'}</td>
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
        if (data?.services?.length > 0) { setResult(data); setStatus('ready') }
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

  // Determine layout level: 0=services, 1=privileges, 2=roles+ai, 3=employees
  const level = selRole ? 3 : selPriv ? 2 : selSvc ? 1 : 0

  // Panel widths — use fractions so all panels share space fairly
  // Grid template columns based on level
  const gridCols = (() => {
    if (level === 0) return '1fr'
    if (level === 1) return '1.8fr 3fr'                  // services rail | privileges grid
    if (level === 2) return '1.5fr 1.5fr 3fr'             // svc | priv | roles+ai
    if (level === 3) return '1.6fr 1.6fr 1.6fr 2fr'    // svc | priv | roles | employees (narrower)
    return '1fr'
  })()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--theme-bg-page)' }}>
      {/* Header */}
      <Header variant="upload" />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white"
        style={{ borderColor: '#efebe4' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button onClick={() => navigate('/upload')}
            className="flex items-center gap-1 text-[13px] font-bold transition-colors hover:underline"
            style={{ color: '#6d5f53' }}>
            <ArrowLeft size={14} /> Upload
          </button>
          <ChevronRight size={14} style={{ color: '#d3c9be' }} />
          <button onClick={() => { setSelSvc(null); setSelPriv(null); setSelRole(null) }}
            className="text-[13px] font-black transition-colors hover:underline"
            style={{ color: selSvc ? '#6d5f53' : '#31231a' }}>
            Licence Analytics
          </button>
          {selSvc && <>
            <ChevronRight size={14} style={{ color: '#d3c9be' }} />
            <button onClick={() => { setSelPriv(null); setSelRole(null) }}
              className="text-[13px] font-black truncate max-w-[160px] transition-colors hover:underline"
              style={{ color: selPriv ? '#6d5f53' : '#31231a' }}>
              {selSvc.name}
            </button>
          </>}
          {selPriv && <>
            <ChevronRight size={14} style={{ color: '#d3c9be' }} />
            <button onClick={() => setSelRole(null)}
              className="text-[13px] font-black truncate max-w-[160px] transition-colors hover:underline"
              style={{ color: selRole ? '#6d5f53' : '#31231a' }}>
              {selPriv.name}
            </button>
          </>}
          {selRole && <>
            <ChevronRight size={14} style={{ color: '#d3c9be' }} />
            <span className="text-[13px] font-black truncate max-w-[160px]" style={{ color: '#31231a' }}>
              {selRole.name}
            </span>
          </>}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
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
                style={{ background: '#fdfbf7', borderColor: '#efebe4' }}>
                <LayoutTemplate size={16} style={{ color: '#6d5f53' }} />
                <select value={activeTemplateId} onChange={e => setActiveTemplateId(e.target.value)}
                  className="text-[13px] font-black bg-transparent outline-none cursor-pointer"
                  style={{ color: '#31231a' }}>
                  <option value="t2">Standard</option>
                  <option value="t3">Dark Mode</option>
                  <option value="t5">Minimal</option>
                  <option value="t7">Enterprise</option>
                  <option value="t1">Executive</option>
                </select>
              </div>
              <button className="flex items-center gap-1.5 px-6 py-2 rounded-lg text-[13px] font-black shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: '#ba6017', color: 'white' }}>
                <Download size={16} /> Export
              </button>
            </>
          )}
        </div>
      </div>

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

            {/* Panel 0: Services */}
            {level === 0 ? (
              <ServicesGrid services={result.services} onSelect={selectService} />
            ) : (
              <ServiceRail
                services={result.services}
                selectedId={selSvc?.id ?? ''}
                onSelect={id => {
                  const s = result.services.find(s => s.id === id)
                  if (s) selectService(s)
                }}
              />
            )}

            {/* Panel 1: Privileges */}
            {level >= 1 && selSvc && (
              level === 1 ? (
                <PrivilegesGrid privileges={selSvc.privileges} service={selSvc} onSelect={selectPrivilege} />
              ) : (
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
              )
            )}

            {/* Panel 2: Roles + AI */}
            {level >= 2 && selPriv && selSvc && (
              level === 2 ? (
                <RolesAndAI roles={selPriv.roles} privilege={selPriv} service={selSvc} onSelect={selectRole} />
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
              <EmployeesPanel employees={selRole.employees} role={selRole} service={selSvc} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
