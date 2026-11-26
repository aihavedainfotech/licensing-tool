import { useState, useEffect, useRef } from 'react'
import { 
  X, 
  Bot, 
  CheckCircle2, 
  Terminal, 
  Check, 
  Server, 
  RefreshCw,
  Sparkles,
  Scissors,
  ShieldAlert,
  Play,
  Monitor,
  Camera,
  ExternalLink
} from 'lucide-react'

interface SodRemediationModalProps {
  isOpen: boolean
  onClose: () => void
  conflict: {
    id: string
    ruleId: string
    user: string
    userName: string
    assignedRole1: string
    function1: string
    privilegeCode1?: string
    privilegeName1?: string
    assignedRole2: string
    function2: string
    privilegeCode2?: string
    privilegeName2?: string
    conflict: string
    targetRoleToRevoke: string
    actionRequired: string
    conflictType?: 'INTRA_ROLE' | 'INTER_ROLE'
  } | null
  onSuccess: (conflictId: string) => void
}

export default function SodRemediationModal({
  isOpen,
  onClose,
  conflict,
  onSuccess
}: SodRemediationModalProps) {
  const [strategy, setStrategy] = useState<'STRIP_PRIVILEGE' | 'REVOKE_ROLE'>('STRIP_PRIVILEGE')
  const [headlessMode, setHeadlessMode] = useState<boolean>(true)
  const [isRunning, setIsRunning] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('READY')
  const [progress, setProgress] = useState<number>(0)
  const [currentStep, setCurrentStep] = useState<string>('Select remediation strategy and launch bot.')
  const [logs, setLogs] = useState<string[]>([])
  const [proofScreenshot, setProofScreenshot] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !conflict) {
      setJobId(null)
      setStatus('READY')
      setProgress(0)
      setLogs([])
      setProofScreenshot(null)
      setIsDone(false)
      setIsRunning(false)
      setStrategy('STRIP_PRIVILEGE')
      setHeadlessMode(true)
      return
    }

    // Initialize with informative prompt
    const privName = conflict.privilegeName2 || conflict.function2 || 'Conflicting Privilege'
    const targetRole = conflict.targetRoleToRevoke || conflict.assignedRole2
    setLogs([
      `[${new Date().toLocaleTimeString()}] 🤖 Oracle SoD Remediation Studio Initialized.`,
      `[${new Date().toLocaleTimeString()}] 🎯 Target User: ${conflict.user}`,
      `[${new Date().toLocaleTimeString()}] 🎭 Target Role: "${targetRole}"`,
      `[${new Date().toLocaleTimeString()}] 🔑 Conflicting Privilege: "${privName}"`,
      `[${new Date().toLocaleTimeString()}] 🖥️ Browser Mode: Headless (Automated verification with screenshot capture).`,
      `[${new Date().toLocaleTimeString()}] 💡 Recommended: Strip privilege from role to preserve remaining job functions.`
    ])
  }, [isOpen, conflict])

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function startRemediation() {
    if (!conflict || isRunning) return
    setIsRunning(true)
    setStatus('STARTING')
    setProgress(10)
    setProofScreenshot(null)

    const isStrip = strategy === 'STRIP_PRIVILEGE'
    const targetRole = conflict.targetRoleToRevoke || conflict.assignedRole2
    const privToStrip = conflict.function2 || conflict.function1
    const privCode = conflict.privilegeCode2 || conflict.privilegeCode1 || 'AP08'
    const customRoleName = `XX_${targetRole.replace(/^XX_/, '')}`

    setLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 🚀 Launching RPA Bot (${isStrip ? 'Privilege Stripping' : 'Role Revocation'})...`,
      `[${new Date().toLocaleTimeString()}] ⚙️ Strategy Selected: ${isStrip ? 'Strip Toxic Privilege & Preserve Capabilities' : 'Revoke Whole Role'}`,
      `[${new Date().toLocaleTimeString()}] 🖥️ Execution Mode: ${headlessMode ? 'Headless (Capturing Verification Proof)' : 'Visible (Opening Browser Window)'}`
    ])

    try {
      const resp = await fetch('http://localhost:3001/api/sod/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: conflict.user,
          targetRole,
          roleToRevoke: targetRole,
          privilegeToStrip: privToStrip,
          privilegeCode: privCode,
          strategy,
          customRoleName,
          headless: headlessMode,
          ruleId: conflict.ruleId,
          conflictName: conflict.conflict
        })
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to start bot')

      setJobId(data.jobId)

      // Poll status
      const interval = setInterval(async () => {
        try {
          const pollResp = await fetch(`http://localhost:3001/api/sod/status/${data.jobId}`)
          if (pollResp.ok) {
            const jobData = await pollResp.json()
            setStatus(jobData.status)
            setProgress(jobData.progress || 0)
            setCurrentStep(jobData.currentStep || '')
            if (jobData.logs) setLogs(jobData.logs)
            if (jobData.proofScreenshot) setProofScreenshot(jobData.proofScreenshot)

            if (jobData.status === 'COMPLETED') {
              clearInterval(interval)
              setIsDone(true)
              setIsRunning(false)
              if (jobData.proofScreenshot) setProofScreenshot(jobData.proofScreenshot)
              onSuccess(conflict.id)
            } else if (jobData.status === 'FAILED') {
              clearInterval(interval)
              setIsRunning(false)
            }
          }
        } catch {
          // ignore transient poll errors
        }
      }, 700)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error'
      setStatus('FAILED')
      setIsRunning(false)
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Error: ${msg}`])
    }
  }

  if (!isOpen || !conflict) return null

  const targetRole = conflict.targetRoleToRevoke || conflict.assignedRole2
  const privToStrip = conflict.function2 || conflict.function1
  const customRoleName = `XX_${targetRole.replace(/^XX_/, '')}`

  // Dynamic step pipeline visualizer based on chosen strategy
  const stripSteps = [
    { label: 'Authenticate & Login', active: progress >= 10, done: progress >= 30 },
    { label: 'Clone to XX_ Role', active: progress >= 30, done: progress >= 60 },
    { label: 'Strip Toxic Privilege', active: progress >= 60, done: progress >= 85 },
    { label: 'Verify in Browser', active: progress >= 85, done: progress === 100 }
  ]

  const revokeSteps = [
    { label: 'Authenticate & Login', active: progress >= 10, done: progress >= 30 },
    { label: 'Navigate to User', active: progress >= 30, done: progress >= 65 },
    { label: 'Revoke Toxic Role', active: progress >= 65, done: progress >= 90 },
    { label: 'Verify in Browser', active: progress >= 90, done: progress === 100 }
  ]

  const activeSteps = strategy === 'STRIP_PRIVILEGE' ? stripSteps : revokeSteps

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-2xl border max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200" style={{ background: 'var(--theme-bg-card, #ffffff)', borderColor: 'var(--theme-border, var(--line, #E1E6EE))' }}>
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ background: 'var(--theme-bg-hover, var(--soft, #F0F3F8))', borderColor: 'var(--theme-border, var(--line, #E1E6EE))' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: 'linear-gradient(135deg, var(--acc, #1D4ED8), var(--acc, #1D4ED8))' }}>
              <Bot size={22} className={isRunning ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900">
                  Automated SoD Remediation Studio
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                  isDone 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : isRunning 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-700'
                }`}>
                  {isDone ? <Check size={10} /> : isRunning ? <RefreshCw size={10} className="animate-spin" /> : null}
                  {status}
                </span>
              </div>
              <h2 className="text-base font-bold text-gray-900 mt-0.5 flex items-center gap-2">
                Remediating Conflict for <span className="text-amber-800">{conflict.user}</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Conflict Summary Banner */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">Conflicting Pair to Resolve</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">{conflict.conflict}</div>
              <div className="text-xs text-gray-600 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>Role:</span>
                <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">{targetRole}</span>
                <span>• Conflicting Privilege:</span>
                <span className="font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">⚡ {privToStrip}</span>
              </div>
            </div>
            <div className="text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shrink-0">
              Rule: <span className="font-bold text-gray-800">{conflict.ruleId}</span>
            </div>
          </div>

          {/* Remediation Strategy Selector (Only enabled before execution) */}
          {!isRunning && !isDone && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-2">
                  Choose Remediation Strategy:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Privilege Stripping (Recommended) */}
                  <div 
                    onClick={() => setStrategy('STRIP_PRIVILEGE')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                      strategy === 'STRIP_PRIVILEGE'
                        ? 'border-amber-600 bg-amber-50/40 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <Scissors size={14} className="text-amber-700" />
                          Strip Privilege from Role
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Creates sanitized <span className="font-semibold text-gray-800">{customRoleName}</span> without <span className="text-red-700 font-semibold">{conflict.privilegeCode2 || 'toxic privilege'}</span>.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 size={12} /> Zero user disruption; preserves 100% of other job duties!
                    </div>
                  </div>

                  {/* Option 2: Revoke Entire Role */}
                  <div 
                    onClick={() => setStrategy('REVOKE_ROLE')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                      strategy === 'REVOKE_ROLE'
                        ? 'border-amber-600 bg-amber-50/40 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <ShieldAlert size={14} className="text-red-600" />
                          Revoke Entire Role
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        De-provisions the entire role <span className="font-semibold text-gray-800">{targetRole}</span> from the user account.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-gray-200 text-[10px] text-amber-800 font-medium">
                      ⚠️ User loses all duties granted by this role.
                    </div>
                  </div>
                </div>
              </div>

              {/* Browser Verification Mode Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50/70">
                <div className="flex items-center gap-2">
                  <Monitor size={16} className="text-amber-700 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-gray-800">Browser Verification Mode:</span>
                    <span className="text-[11px] text-gray-500 ml-1.5 hidden sm:inline">
                      {headlessMode ? 'Headless browser captures live screenshot verification proof' : 'Opens visible browser window on your desktop'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setHeadlessMode(true)}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition ${
                      headlessMode ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Headless (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeadlessMode(false)}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition ${
                      !headlessMode ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Visible Window
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Visual Step Progress Flow */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Execution Pipeline ({strategy === 'STRIP_PRIVILEGE' ? 'Privilege Stripping' : 'Role Revocation'})
              </span>
              <span className="text-xs font-bold text-amber-700">{progress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
              <div 
                className="h-full transition-all duration-500 rounded-full" 
                style={{ 
                  width: `${progress}%`,
                  background: isDone ? '#10b981' : 'linear-gradient(90deg, var(--acc, #1D4ED8), #f59e0b)'
                }}
              />
            </div>

            {/* Step Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activeSteps.map((st, i) => (
                <div 
                  key={i} 
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    st.done 
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800' 
                      : st.active 
                        ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold shadow-sm' 
                        : 'border-gray-200 bg-gray-50 text-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs">
                    {st.done ? (
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    ) : st.active ? (
                      <RefreshCw size={13} className="animate-spin text-amber-600 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] flex items-center justify-center">{i + 1}</span>
                    )}
                    <span className="truncate">{st.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Execution Terminal */}
          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-md">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-amber-400" />
                <span className="font-mono font-bold text-slate-300">oracle-rpa-agent --live</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {currentStep}
              </span>
            </div>

            <div className="bg-slate-950 p-4 font-mono text-xs text-emerald-400 h-44 overflow-y-auto space-y-1.5">
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed">
                  <span className="text-slate-500 mr-2">&gt;</span>
                  <span className={log.includes('✅') || log.includes('🎉') ? 'text-emerald-300 font-bold' : log.includes('❌') ? 'text-red-400' : 'text-slate-200'}>
                    {log}
                  </span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Headless Browser Verification Proof Screenshot */}
          {proofScreenshot && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2.5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                  <Camera size={15} className="text-blue-600" />
                  <span>Headless Browser Verification Proof (Live Oracle Cloud Screenshot)</span>
                </div>
                <a
                  href={`http://localhost:3001${proofScreenshot}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline"
                >
                  <ExternalLink size={12} /> Open Full Size
                </a>
              </div>

              <div className="rounded-lg overflow-hidden border border-blue-200 bg-white max-h-52 overflow-y-auto shadow-sm">
                <img
                  src={`http://localhost:3001${proofScreenshot}`}
                  alt="Oracle Cloud Verification Screenshot"
                  className="w-full h-auto object-top"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-blue-800 font-mono">
                <span className="truncate">Proof File: {proofScreenshot}</span>
                <span className="font-bold text-emerald-700 shrink-0">✓ Certified by Headless Browser</span>
              </div>
            </div>
          )}

          {/* After Impact Banner */}
          {isDone && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900">
                  {strategy === 'STRIP_PRIVILEGE' 
                    ? 'Segregation of Duties Restored via Role Customization' 
                    : 'Conflicting Role De-provisioned'}
                </h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {strategy === 'STRIP_PRIVILEGE'
                    ? `Privilege "${privToStrip}" was successfully removed from "${targetRole}". User "${conflict.user}" was reassigned to sanitized "${customRoleName}" with all other business duties preserved!`
                    : `Role "${targetRole}" has been unlinked from user "${conflict.user}". Compliance certified.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/60 flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <Server size={13} /> Target: fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com
            {jobId && <span className="ml-2 font-mono text-gray-400">({jobId})</span>}
          </div>

          <div className="flex items-center gap-2">
            {!isRunning && !isDone ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={startRemediation}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition shadow-sm hover:brightness-110 flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, var(--acc, #1D4ED8), var(--acc, #1D4ED8))' }}
                >
                  <Play size={13} fill="white" />
                  {strategy === 'STRIP_PRIVILEGE' ? 'Strip Privilege with Bot' : 'Revoke Role with Bot'}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                  isDone 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {isDone ? 'Done & Close' : 'Close'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
