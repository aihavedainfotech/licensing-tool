import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Users, Shield,
  Layers, AlertTriangle, CheckCircle2, XCircle, Clock,
  Download, Loader2, FileX2,
  BarChart3, Key, Sparkles, Brain, LayoutTemplate,
  ChevronLeft, Package, TrendingUp, TrendingDown
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
  high:   { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#ef4444', label: 'HIGH' },
  medium: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', dot: '#f59e0b', label: 'MED'  },
  low:    { bg: '#f0fdf4', text: '#059669', border: '#bbf7d0', dot: '#10b981', label: 'LOW'  },
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
  const fill = pct >= 95 ? '#ef4444' : pct >= 80 ? '#f97316' : color
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--theme-text-muted)' }}>
        <span>{used.toLocaleString()} used</span>
        <span style={{ color: pct >= 95 ? '#ef4444' : 'var(--theme-text-muted)' }}>{total > 0 ? `${pct}%` : '—'}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-bg-hover)' }}>
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
                style={{ color: 'var(--theme-text-muted)' }}>Used</th>
              <th className="text-right px-2 py-2 font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }}>Pur.</th>
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
                    {svc.overProvisioned > 0 && <span style={{ color: isActive ? '#fcd34d' : '#ef4444' }}>⚠ </span>}
                    {svc.name}
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
                        <span style={{ color: isActive ? '#fca5a5' : '#dc2626' }}>+{diff.toLocaleString()}</span>
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
    <div className="flex-1 overflow-y-auto p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-muted)' }}>
        {services.length} Services — click to explore
      </h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {services.map(svc => {
          const risk = svc.overProvisioned > 0 ? (svc.overProvisioned > 500 ? 'high' : 'medium') : 'low'
          const rc = RISK_CONFIG[risk]
          return (
            <button key={svc.id} onClick={() => onSelect(svc)}
              className="text-left rounded-xl border p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 group"
              style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-2xl leading-none">{svc.icon}</div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                  style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>
                  {rc.label}
                </span>
              </div>
              <p className="text-xs font-bold leading-snug mb-2 group-hover:text-blue-600 transition-colors"
                style={{ color: 'var(--theme-text-main)' }}>
                {svc.name}
              </p>
              {svc.vendor && (
                <p className="text-[10px] mb-2" style={{ color: 'var(--theme-text-muted)' }}>{svc.vendor}</p>
              )}
              <div className="flex items-center justify-between text-[10px] mb-2" style={{ color: 'var(--theme-text-muted)' }}>
                <span>{fmtNum(svc.licenseCount)} licences</span>
                <span>{svc.privilegeCount} privileges</span>
              </div>
              <UsageBar used={svc.licenseCount} total={svc.subscribedQuantity ?? svc.licenseCount} color={svc.color} />
            </button>
          )
        })}
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
    <div className="flex-1 overflow-y-auto p-5">
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
      <div className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-card)' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button onClick={() => navigate('/upload')}
            className="flex items-center gap-1 text-xs font-semibold transition-colors hover:underline"
            style={{ color: 'var(--theme-text-muted)' }}>
            <ArrowLeft size={13} /> Upload
          </button>
          <ChevronRight size={13} style={{ color: 'var(--theme-text-light)' }} />
          <button onClick={() => { setSelSvc(null); setSelPriv(null); setSelRole(null) }}
            className="text-xs font-bold transition-colors hover:underline"
            style={{ color: selSvc ? 'var(--theme-text-muted)' : 'var(--theme-text-main)' }}>
            Licence Analytics
          </button>
          {selSvc && <>
            <ChevronRight size={13} style={{ color: 'var(--theme-text-light)' }} />
            <button onClick={() => { setSelPriv(null); setSelRole(null) }}
              className="text-xs font-bold truncate max-w-[160px] transition-colors hover:underline"
              style={{ color: selPriv ? 'var(--theme-text-muted)' : 'var(--theme-text-main)' }}>
              {selSvc.name}
            </button>
          </>}
          {selPriv && <>
            <ChevronRight size={13} style={{ color: 'var(--theme-text-light)' }} />
            <button onClick={() => setSelRole(null)}
              className="text-xs font-bold truncate max-w-[160px] transition-colors hover:underline"
              style={{ color: selRole ? 'var(--theme-text-muted)' : 'var(--theme-text-main)' }}>
              {selPriv.name}
            </button>
          </>}
          {selRole && <>
            <ChevronRight size={13} style={{ color: 'var(--theme-text-light)' }} />
            <span className="text-xs font-bold truncate max-w-[160px]" style={{ color: 'var(--theme-text-main)' }}>
              {selRole.name}
            </span>
          </>}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'ready' && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                style={{ background: 'var(--theme-bg-hover)', borderColor: 'var(--theme-border)' }}>
                <LayoutTemplate size={13} style={{ color: 'var(--theme-text-muted)' }} />
                <select value={activeTemplateId} onChange={e => setActiveTemplateId(e.target.value)}
                  className="text-xs font-semibold bg-transparent outline-none cursor-pointer"
                  style={{ color: 'var(--theme-text-main)' }}>
                  <option value="t2">Standard</option>
                  <option value="t3">Dark Mode</option>
                  <option value="t5">Minimal</option>
                  <option value="t7">Enterprise</option>
                  <option value="t1">Executive</option>
                </select>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: '#1d6fa4', color: 'white' }}>
                <Download size={13} /> Export
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
