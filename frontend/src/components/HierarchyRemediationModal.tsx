import React, { useState, useEffect, useRef } from 'react'
import {
  X, Shield, AlertTriangle, CheckCircle2, Check,
  ChevronRight, User, ArrowRight, Terminal,
  RefreshCw, Zap, Loader2, ExternalLink,
  GitBranch, Layers, Info, ChevronDown, ChevronUp, Circle
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CostlyPrivilegeConfig {
  privilegeName: string
  freeAlternative: string
  parentServiceName: string
}

interface HierarchyStepAction {
  action: string
  parent?: string
  code?: string
  xxName?: string
  xxCode?: string
  from?: string
  to?: string
  proof?: string
  reason?: string
  grandParent?: string
  replacingService?: string
  withService?: string
  roleName?: string
  roleCode?: string
  privilege?: string
  success?: boolean
  alternate?: string
  targetFound?: boolean
  usersCount?: number
  message?: string
  user?: string
}

interface HierarchyStep {
  step: number
  privilege: string
  freeAlternative: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'PARTIAL'
  actions: HierarchyStepAction[]
  error?: string
}

interface HierarchyRemediationModalProps {
  isOpen: boolean
  onClose: () => void
  serviceName: string
  targetRoleName: string
  targetUsername?: string
  costlyPrivileges: CostlyPrivilegeConfig[]
  onApplySimulation?: (data: { savedLicenses: number; employeeName: string }) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  PENDING:    '#94a3b8',
  IN_PROGRESS:'#f59e0b',
  COMPLETED:  '#10b981',
  FAILED:     '#ef4444',
  SKIPPED:    '#6b7280',
  PARTIAL:    '#f97316'
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'IN_PROGRESS') return <Loader2 size={13} className="animate-spin text-amber-500" />
  if (status === 'COMPLETED')   return <CheckCircle2 size={13} className="text-emerald-500" />
  if (status === 'FAILED')      return <AlertTriangle size={13} className="text-red-500" />
  if (status === 'PARTIAL')     return <AlertTriangle size={13} className="text-orange-500" />
  return <Circle size={13} className="text-slate-400" />
}

function ActionBadge({ action }: { action: string }) {
  const labels: Record<string, { color: string; label: string }> = {
    FOUND_PARENT:         { color: '#3b82f6', label: '🔍 Immediate Parent Found' },
    EXPAND_TOWARDS_USERS: { color: '#06b6d4', label: '👥 Expand Toward Users' },
    ROLE_SEARCHED:        { color: '#6366f1', label: '🔎 Role Code Search' },
    COPY_STARTED:         { color: '#8b5cf6', label: '📋 Role Cloned (XX_)' },
    PRIVILEGE_REMOVED:    { color: '#ef4444', label: '🗑 Costly Priv Stripped' },
    ALTERNATE_ADDED:      { color: '#10b981', label: '➕ Free Alt Added' },
    VERIFIED:             { color: '#059669', label: '✅ Verified in Oracle' },
    DIRECT_SWAP:          { color: '#10b981', label: '↔ Direct User Swap' },
    INHERITED:            { color: '#f59e0b', label: '⛓ Inherited → Recurse Parent' },
    MAX_RECURSION:        { color: '#eab308', label: '⚠ Max Depth' },
    CLONED:               { color: '#8b5cf6', label: '📋 XX_ Cloned' },
    GRANDPARENT_CLONED:   { color: '#8b5cf6', label: '📋 Parent Cloned' },
    INHERITED_SWAP:       { color: '#10b981', label: '↔ Inherited Swap' },
    SKIP:                 { color: '#6b7280', label: '⏭ Skipped' }
  }
  const cfg = labels[action] || { color: '#6b7280', label: action }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: cfg.color + '18', color: cfg.color, border: `1px solid ${cfg.color}40` }}
    >
      {cfg.label}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HierarchyRemediationModal({
  isOpen, onClose,
  serviceName, targetRoleName,
  targetUsername = 'Parveen',
  costlyPrivileges,
  onApplySimulation
}: HierarchyRemediationModalProps) {

  const [privileges, setPrivileges]       = useState<CostlyPrivilegeConfig[]>(costlyPrivileges)
  const [oracleConfig, setOracleConfig]   = useState<{ host: string | null; username: string | null } | null>(null)
  const [editableRoleName, setEditableRoleName] = useState(`XX_${targetRoleName}`)
  const [editableRoleCode, setEditableRoleCode] = useState(
    `XX_${targetRoleName.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22).replace(/_+$/, '')}`
  )
  const [isHeadless, setIsHeadless]       = useState(true)
  const [isRunning, setIsRunning]         = useState(false)
  const [jobStatus, setJobStatus]         = useState('IDLE')
  const [progress, setProgress]           = useState(0)
  const [message, setMessage]             = useState('')
  const [logs, setLogs]                   = useState<string[]>([])
  const [hierarchySteps, setHierarchySteps] = useState<HierarchyStep[]>([])
  const [proofScreenshots, setProofScreenshots] = useState<string[]>([])
  const [rpaError, setRpaError]           = useState<string | null>(null)
  const [isSimulated, setIsSimulated]     = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [showLogs, setShowLogs]           = useState(false)
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/remediation/oracle-config')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setOracleConfig(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isRunning) {
      setPrivileges(costlyPrivileges)
      setEditableRoleName(`XX_${targetRoleName}`)
      setEditableRoleCode(`XX_${targetRoleName.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22).replace(/_+$/, '')}`)
    }
  }, [costlyPrivileges, targetRoleName, isRunning])

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [logs])

  if (!isOpen) return null

  const handleLaunch = async () => {
    setIsRunning(true)
    setJobStatus('INITIALIZING')
    setProgress(2)
    setMessage('Connecting to Oracle Fusion Cloud...')
    setRpaError(null)
    setProofScreenshots([])
    setHierarchySteps(privileges.map((p, i) => ({
      step: i + 1,
      privilege: p.privilegeName,
      freeAlternative: p.freeAlternative,
      status: 'PENDING',
      actions: []
    })))
    setLogs([
      `[${new Date().toLocaleTimeString()}] Initiating recursive hierarchy remediation...`,
      `[${new Date().toLocaleTimeString()}] Target User: ${targetUsername}`,
      `[${new Date().toLocaleTimeString()}] Target Role: ${targetRoleName}`,
      `[${new Date().toLocaleTimeString()}] Costly Privileges (${privileges.length}): ${privileges.map(p => p.privilegeName).join(', ')}`
    ])

    try {
      const res = await fetch('http://localhost:3001/api/remediation/oracle-hierarchy-remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername,
          targetRoleName,
          customRoleName: editableRoleName,
          customRoleCode: editableRoleCode,
          costlyPrivileges: privileges.map(p => ({
            privilegeName:    p.privilegeName,
            freeAlternative:  p.freeAlternative,
            parentServiceName: p.parentServiceName
          })),
          headless: isHeadless
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start hierarchy remediation.')

      const pollTimer = setInterval(async () => {
        try {
          const s = await (await fetch(`http://localhost:3001/api/remediation/oracle-status/${data.jobId}`)).json()
          setJobStatus(s.status || 'RUNNING')
          setProgress(s.progress || 0)
          setMessage(s.message || '')
          if (s.logs)             setLogs(s.logs)
          if (s.hierarchySteps)   setHierarchySteps(s.hierarchySteps)
          if (s.proofScreenshots) setProofScreenshots(s.proofScreenshots)
          if (s.status === 'COMPLETED' || s.status === 'FAILED' || s.status === 'ROLE_NOT_FOUND') {
            clearInterval(pollTimer)
            setIsRunning(false)
            setJobStatus(s.status)
            if (s.status === 'FAILED' || s.status === 'ROLE_NOT_FOUND') setRpaError(s.error || s.message)
          }
        } catch { /* ignore */ }
      }, 1500)
    } catch (err: any) {
      setIsRunning(false)
      setJobStatus('FAILED')
      setRpaError(err.message)
    }
  }

  const toggleStep = (i: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else {
        next.add(i)
      }
      return next
    })
  }

  const isCompleted   = jobStatus === 'COMPLETED'
  const isFailed      = jobStatus === 'FAILED'
  const completedCount = hierarchySteps.filter(s => s.status === 'COMPLETED').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[96vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border"
        style={{ background: 'var(--theme-bg-card,#ffffff)', borderColor: 'var(--theme-border,#e2e8f0)', color: 'var(--theme-text-main,#0f172a)' }}
      >
        {/* HEADER */}
        <div className="px-6 py-4 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: 'var(--theme-border)', background: 'linear-gradient(135deg,rgba(139,92,246,0.08),rgba(30,58,138,0.03))' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
              <GitBranch size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-violet-100 text-violet-700">
                  Recursive Hierarchy Remediation
                </span>
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {privileges.length} Costly Privilege{privileges.length !== 1 ? 's' : ''} → Free Alternatives
                </span>
              </div>
              <h2 className="text-sm font-bold text-gray-900 mt-0.5">
                Hierarchy-Aware Remediation for <span className="text-violet-700">{targetUsername}</span>
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Role chain diagram */}
          <div className="p-4 rounded-xl border bg-slate-50 space-y-2.5">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <Layers size={12} /> Oracle Role Inheritance Chain
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
              {[
                { icon: <User size={11} className="text-violet-500" />, label: targetUsername, border: 'border-violet-200', text: 'text-violet-800' },
                { icon: <Shield size={11} className="text-indigo-500" />, label: targetRoleName, border: 'border-indigo-200', text: 'text-indigo-800' },
                { icon: <Layers size={11} className="text-blue-500" />, label: serviceName, border: 'border-blue-200', text: 'text-blue-800' },
              ].map((item, i, arr) => (
                <React.Fragment key={i}>
                  <div className={`px-3 py-1.5 rounded-lg bg-white border shadow-sm flex items-center gap-1.5 ${item.border} ${item.text}`}>
                    {item.icon} {item.label}
                  </div>
                  {i < arr.length - 1 && <ChevronRight size={14} className="text-slate-300" />}
                </React.Fragment>
              ))}
              <ChevronRight size={14} className="text-slate-300" />
              <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-1.5">
                <AlertTriangle size={11} className="text-red-500" />
                {privileges.length} costly privilege{privileges.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 flex items-start gap-1.5">
              <Info size={11} className="shrink-0 mt-0.5 text-indigo-400" />
              Bot traverses the chain bottom-up: copies each parent service → strips costly priv → adds free alternative → swaps user assignment (recursing through inherited chains automatically).
            </div>
          </div>

          {/* Editable Custom Role Name & Code */}
          <div className="p-4 rounded-xl border bg-slate-50 space-y-2.5">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2"><Shield size={12} className="text-violet-600" /> Custom Cloned Role Configuration</span>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                editableRoleCode.length > 30 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-violet-100 text-violet-700 border border-violet-200'
              }`}>
                Code: {editableRoleCode.length}/30 chars
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-700 block">Custom Role Name (Displayed in Oracle)</label>
                <input
                  type="text"
                  value={editableRoleName}
                  disabled={isRunning}
                  onChange={e => {
                    const val = e.target.value;
                    setEditableRoleName(val);
                  }}
                  placeholder="e.g. XX_Order Entry Specialist"
                  className="w-full text-xs font-semibold p-2 rounded bg-white border border-blue-200 text-blue-950 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-indigo-700 block">Custom Role Code (Max 30 chars)</label>
                <input
                  type="text"
                  maxLength={30}
                  value={editableRoleCode}
                  disabled={isRunning}
                  onChange={e => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                    setEditableRoleCode(val);
                  }}
                  placeholder="e.g. XX_FOM_ORDER_ENTRY_SPEC"
                  className={`w-full text-xs font-mono font-bold p-2 rounded border focus:outline-none focus:ring-1 disabled:opacity-60 ${
                    editableRoleCode.length > 30 ? 'bg-red-50 border-red-300 text-red-900 focus:ring-red-500' : 'bg-white border-indigo-200 text-indigo-900 focus:ring-indigo-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Editable privilege table */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={12} className="text-red-500" /> Privileges to Remediate
            </div>
            {privileges.map((p, i) => (
              <div key={i} className="p-3.5 rounded-xl border grid grid-cols-1 md:grid-cols-3 gap-3"
                style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-red-600 uppercase tracking-wider block">Costly Privilege #{i + 1}</label>
                  <input
                    type="text" value={p.privilegeName} disabled={isRunning}
                    onChange={e => setPrivileges(prev => prev.map((x, j) => j === i ? { ...x, privilegeName: e.target.value } : x))}
                    className="w-full text-[11px] font-mono font-bold px-2 py-1.5 rounded bg-red-50 border border-red-200 text-red-900 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block">Immediate Parent Service</label>
                  <input
                    type="text" value={p.parentServiceName} disabled={isRunning}
                    onChange={e => setPrivileges(prev => prev.map((x, j) => j === i ? { ...x, parentServiceName: e.target.value } : x))}
                    className="w-full text-[11px] font-medium px-2 py-1.5 rounded bg-blue-50 border border-blue-200 text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Free Alternative</label>
                  <input
                    type="text" value={p.freeAlternative} disabled={isRunning}
                    onChange={e => setPrivileges(prev => prev.map((x, j) => j === i ? { ...x, freeAlternative: e.target.value } : x))}
                    className="w-full text-[11px] font-medium px-2 py-1.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Oracle connection & launch */}
          <div className="p-4 rounded-xl border bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4"
            style={{ borderColor: 'var(--theme-border)' }}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                  Oracle Instance Connected (.env)
                </span>
              </div>
              <div className="text-xs text-gray-800">
                <strong>Host:</strong> <span className="font-mono text-violet-700">{oracleConfig?.host || 'fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com'}</span>
              </div>
              <div className="text-xs text-gray-800">
                <strong>User:</strong> <span className="font-semibold">{oracleConfig?.username || 'Curtis.Feitty'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                <input type="checkbox" checked={isHeadless} disabled={isRunning} onChange={e => setIsHeadless(e.target.checked)} className="rounded text-violet-600" />
                Headless mode
              </label>
              <button
                onClick={handleLaunch} disabled={isRunning}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all ${
                  isRunning ? 'bg-violet-400 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700'
                }`}
              >
                {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                {isRunning ? 'Traversing Oracle Hierarchy...' : 'Execute Hierarchy Remediation'}
              </button>
            </div>
          </div>

          {/* Live execution console */}
          {jobStatus !== 'IDLE' && (
            <div className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900 shadow-lg">
              {/* status bar */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-amber-400 animate-ping' : isCompleted ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-[11px] font-bold text-white uppercase">Execution Status:</span>
                  <span className="text-[11px] text-violet-300">{message || jobStatus}</span>
                </div>
                <span className="text-xs font-bold text-violet-400 font-mono">{progress}%</span>
              </div>
              {/* progress bar */}
              <div className="px-4 pb-3">
                <div className="w-full bg-gray-800 rounded-full h-2 border border-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Steps panel */}
              {hierarchySteps.length > 0 && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch size={11} /> Per-Privilege Remediation Steps
                  </div>
                  {hierarchySteps.map((step, i) => (
                    <div key={i} className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
                      <button
                        onClick={() => toggleStep(i)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <StatusIcon status={step.status} />
                          <span className="text-[11px] font-bold text-white truncate max-w-[220px]" title={step.privilege}>
                            #{step.step} {step.privilege}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ color: STATUS_COLOR[step.status], background: STATUS_COLOR[step.status] + '22', border: `1px solid ${STATUS_COLOR[step.status]}44` }}>
                            {step.status}
                          </span>
                          {expandedSteps.has(i) ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
                        </div>
                      </button>
                      {expandedSteps.has(i) && (
                        <div className="px-3 pb-3 space-y-2 border-t border-gray-700 pt-2">
                          <div className="text-[10px] text-emerald-400 font-mono">
                            Free Alt: <span className="text-white">{step.freeAlternative}</span>
                          </div>
                          {step.actions.map((act, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <span className="text-gray-600 text-[10px] mt-0.5">›</span>
                              <div className="space-y-0.5">
                                <ActionBadge action={act.action} />
                                {act.parent && (
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    Parent Role: <span className="text-blue-300 font-semibold">{act.parent}</span>
                                    {act.code && <span className="text-gray-500 ml-1">({act.code})</span>}
                                  </div>
                                )}
                                {act.usersCount !== undefined && (
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    Users with Privilege: <span className="text-amber-300 font-semibold">{act.usersCount}</span>
                                    {act.targetFound && <span className="text-emerald-400 ml-1.5">• Target user confirmed</span>}
                                  </div>
                                )}
                                {act.roleName && (
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    Searched Role: <span className="text-indigo-300 font-semibold">{act.roleName}</span>
                                    {act.roleCode && <span className="text-gray-500 ml-1">({act.roleCode})</span>}
                                  </div>
                                )}
                                {act.xxName && (
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    Custom Role: <span className="text-violet-300 font-semibold">{act.xxName}</span>
                                    {act.xxCode && <span className="text-gray-500 ml-1">({act.xxCode})</span>}
                                  </div>
                                )}
                                {act.privilege && (
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    Stripped: <span className="text-red-400">{act.privilege}</span>
                                    {act.success && <span className="text-emerald-400 ml-1">✓</span>}
                                  </div>
                                )}
                                {act.alternate && (
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    Added Alternative: <span className="text-emerald-300 font-semibold">{act.alternate}</span>
                                  </div>
                                )}
                                {act.from && act.to && (
                                  <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                    <span className="text-red-400">{act.from}</span>
                                    <ArrowRight size={10} className="text-gray-500" />
                                    <span className="text-emerald-400 font-semibold">{act.to}</span>
                                    {act.user && <span className="text-gray-500 ml-1">({act.user})</span>}
                                  </div>
                                )}
                                {act.message && <div className="text-[10px] text-amber-400 font-mono">{act.message}</div>}
                                {act.reason && <div className="text-[10px] text-orange-400 font-mono">Reason: {act.reason}</div>}
                                {act.proof && (
                                  <a href={`http://localhost:3001${act.proof}`} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5">
                                    <ExternalLink size={10} /> View Proof Screenshot
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                          {step.error && (
                            <div className="text-[10px] text-red-400 font-mono p-1.5 bg-red-950/40 rounded border border-red-800">
                              ✗ {step.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Raw logs toggle */}
              <div className="px-4 pb-3">
                <button onClick={() => setShowLogs(p => !p)}
                  className="text-[10px] text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors">
                  <Terminal size={11} /> {showLogs ? 'Hide' : 'Show'} Console
                  {showLogs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {showLogs && (
                  <div ref={logsRef}
                    className="mt-2 bg-black/70 p-3 rounded-lg text-[11px] text-emerald-400 font-mono max-h-32 overflow-y-auto space-y-0.5 border border-gray-800">
                    {logs.map((log, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-gray-600">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    {isRunning && (
                      <div className="flex items-center gap-1 text-violet-300 animate-pulse">
                        <span>&gt;</span><span className="inline-block w-2 h-4 bg-violet-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Proof screenshots */}
              {proofScreenshots.length > 0 && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-2">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={11} /> Proof Screenshots ({proofScreenshots.length})
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {proofScreenshots.slice(-4).map((url, i) => (
                      <a key={i} href={`http://localhost:3001${url}`} target="_blank" rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-gray-700 hover:border-violet-500 transition-colors">
                        <img src={`http://localhost:3001${url}`} alt={`Proof ${i + 1}`} className="w-full object-cover max-h-28" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {rpaError && (
                <div className="mx-4 mb-4 p-3 rounded-lg bg-red-950/70 border border-red-600 text-red-200 text-xs space-y-1 font-sans animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 font-bold text-red-300">
                    <AlertTriangle size={15} className="text-red-400 shrink-0" />
                    <span>Role Not Found in Demo Instance</span>
                  </div>
                  <p className="font-mono text-[11px] text-red-200">
                    {rpaError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Completed summary */}
          {isCompleted && (
            <div className="p-4 rounded-xl border-2 border-emerald-400 bg-emerald-50/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={15} className="text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">Hierarchy Remediation Complete</span>
                    <span className="text-[10px] text-emerald-700">{completedCount}/{privileges.length} privileges successfully remediated</span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center gap-1">
                  <Check size={11} /> EXECUTED
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Privileges Fixed</div>
                  <div className="text-xl font-black text-emerald-600">{completedCount}</div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">User Protected</div>
                  <div className="text-sm font-bold text-emerald-700">{targetUsername}</div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">XX_ Roles Created</div>
                  <div className="text-xl font-black text-violet-600">{proofScreenshots.length}</div>
                </div>
              </div>
              <div className="space-y-1 bg-white rounded-lg border border-emerald-200 p-3 text-[11px]">
                {hierarchySteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <StatusIcon status={s.status} />
                    <span className="text-gray-700 font-medium flex-1 truncate" title={s.privilege}>{s.privilege}</span>
                    <span className="text-[10px] font-bold" style={{ color: STATUS_COLOR[s.status] }}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}>
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            Recursive: parent service → XX_ clone → strip costly → swap user assignment
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors">
              Close
            </button>
            {(isCompleted || jobStatus === 'IDLE') && (
              <button
                onClick={() => { setIsSimulated(true); onApplySimulation?.({ savedLicenses: 1, employeeName: targetUsername }) }}
                disabled={isSimulated}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all ${
                  isSimulated ? 'bg-emerald-600 opacity-90' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95'
                }`}
              >
                {isSimulated ? <Check size={14} /> : <RefreshCw size={14} />}
                {isSimulated ? 'Applied!' : 'Apply to Dashboard'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
