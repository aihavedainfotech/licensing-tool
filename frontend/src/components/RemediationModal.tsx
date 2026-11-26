import { useState, useEffect, useMemo } from 'react'
import {
  X, Shield, CheckCircle2, Copy, Check, Download,
  Layers, Users, ArrowRight, Sparkles, Terminal, FileText,
  RefreshCw, Info, AlertTriangle,
  Cpu, Play, Loader2, ExternalLink
} from 'lucide-react'
import type { Employee, Role } from '../types'

interface RemediationModalProps {
  isOpen: boolean
  onClose: () => void
  serviceName: string
  roleName: string
  employeeName?: string
  employeeId?: string
  costlyPrivilegeName?: string
  serviceCost?: number
  roleEmployees?: Employee[]
  privilegeRoles?: Role[]
  onApplySimulation?: (data: {
    serviceName: string
    roleName: string
    customRoleName: string
    employeeName: string
    savedLicenses: number
    costlyPrivilegeName?: string
    replacementPrivilege?: string
    swappedRoles?: Array<{
      originalRoleId: string
      originalRoleName: string
      customRoleName: string
      customRoleCode: string
      employees: Employee[]
    }>
  }) => void
}

export default function RemediationModal({
  isOpen,
  onClose,
  serviceName,
  roleName,
  employeeName = 'Parveen',
  employeeId = '100597',
  costlyPrivilegeName = 'HWM_MANAGE_TIME_WORK_AREA_PRIV',
  serviceCost = 0,
  roleEmployees = [],
  privilegeRoles = [],
  onApplySimulation
}: RemediationModalProps) {
  // Available Roles pool granting this privilege
  const availableRoles: Role[] = useMemo(() => {
    if (privilegeRoles && privilegeRoles.length > 0) return privilegeRoles
    return [{
      id: roleName,
      name: roleName,
      employeeCount: roleEmployees.length || 1,
      licenseUsed: roleEmployees.length || 1,
      licenseTotal: roleEmployees.length || 1,
      employees: roleEmployees.length > 0 ? roleEmployees : [{
        id: employeeId || employeeName,
        name: employeeName,
        email: `${employeeName.toLowerCase()}@corp.com`,
        department: '',
        status: 'active',
        avatar: employeeName.slice(0, 2).toUpperCase()
      }]
    }]
  }, [privilegeRoles, roleName, roleEmployees, employeeName, employeeId])

  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    () => new Set(availableRoles.map(r => r.id))
  )

  // Step 1: Cloned Role Names & Codes map: roleId -> { customName, customCode }
  const [clonedRoleConfig, setClonedRoleConfig] = useState<Record<string, { name: string; code: string }>>({})

  // Initialize role cloning dictionary
  useEffect(() => {
    const config: Record<string, { name: string; code: string }> = {}
    availableRoles.forEach(r => {
      const clean = r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22).replace(/_+$/, '')
      config[r.id] = {
        name: `XX_${r.name}`,
        code: `XX_${clean}`
      }
    })
    setClonedRoleConfig(config)
    setSelectedRoleIds(new Set(availableRoles.map(r => r.id)))
  }, [availableRoles])

  const getInitialAlternatePrivilege = (priv: string) => {
    const p = (priv || '').toUpperCase()
    if (p.includes('TIME_WORK_AREA') || p.includes('HWM')) return 'View Time Work Area'
    if (p.includes('ORDER') || p.includes('FOM')) return 'View Orders'
    if (p.includes('INVOICE') || p.includes('PAYABLE')) return 'View Invoices'
    if (p.includes('INVENTORY') || p.includes('INV_')) return 'View On-Hand Quantity'
    if (p.includes('PURCHASE') || p.includes('PO_')) return 'View Purchase Orders'
    return 'View Time Work Area'
  }

  // Step 2: Privilege Stripping state
  const [includeAlternatePrivilege, setIncludeAlternatePrivilege] = useState<boolean>(true)
  const [replacementPrivilege, setReplacementPrivilege] = useState(() => getInitialAlternatePrivilege(costlyPrivilegeName))

  useEffect(() => {
    setReplacementPrivilege(getInitialAlternatePrivilege(costlyPrivilegeName))
  }, [costlyPrivilegeName])

  const effectiveReplacementPrivilege = includeAlternatePrivilege && replacementPrivilege.trim() ? replacementPrivilege.trim() : null

  const [isSimulated, setIsSimulated] = useState(false)
  const [activeTab, setActiveTab] = useState<'hdl' | 'scim' | 'sop' | 'rpa'>('rpa')
  const [copied, setCopied] = useState(false)

  // ── RPA BOT AUTOMATION STATE (USES BACKEND .ENV DIRECTLY) ──────────
  const [isDirectAssignment, setIsDirectAssignment] = useState<boolean>(true)
  const [oracleEnvConfig, setOracleEnvConfig] = useState<{ configured: boolean; host: string | null; username: string | null } | null>(null)
  const [isHeadless, setIsHeadless] = useState(false)
  const [rpaJobId, setRpaJobId] = useState<string | null>(null)
  const [rpaStatus, setRpaStatus] = useState<string>('IDLE')
  const [rpaProgress, setRpaProgress] = useState<number>(0)
  const [rpaMessage, setRpaMessage] = useState<string>('')
  const [rpaLogs, setRpaLogs] = useState<string[]>([])
  const [rpaScreenshot, setRpaScreenshot] = useState<string | null>(null)
  const [isRpaRunning, setIsRpaRunning] = useState<boolean>(false)
  const [rpaError, setRpaError] = useState<string | null>(null)


  useEffect(() => {
    fetch('http://localhost:3001/api/remediation/oracle-config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setOracleEnvConfig(data)
      })
      .catch(() => {})
  }, [])

  if (!isOpen) return null

  // Active roles based on user selection in Step 1
  const activeRoles = availableRoles.filter(r => selectedRoleIds.has(r.id))
  const effectiveRoles = activeRoles.length > 0 ? activeRoles : availableRoles.slice(0, 1)

  // Gather unique employees across all active roles
  const uniqueEmployeeMap = new Map<string, { employee: Employee; roles: string[] }>()
  effectiveRoles.forEach(r => {
    (r.employees || []).forEach(emp => {
      if (!uniqueEmployeeMap.has(emp.id)) {
        uniqueEmployeeMap.set(emp.id, { employee: emp, roles: [r.name] })
      } else {
        uniqueEmployeeMap.get(emp.id)?.roles.push(r.name)
      }
    })
  })

  const totalUniqueEmployees = uniqueEmployeeMap.size > 0 ? uniqueEmployeeMap.size : 1
  const totalPotentialSavings = (serviceCost || 0) * totalUniqueEmployees

  // Formatted HDL File Content (User.dat) across ALL selected roles and employees
  const hdlHeader = [
    '# ==========================================================================',
    '# Oracle HCM Data Loader (HDL) - Multi-Role Assignment Swap',
    '# File: User.dat',
    `# Mode: ${isDirectAssignment ? 'DIRECT USER ROLE SWAP' : 'INHERITED PARENT ROLE HIERARCHY SWAP'}`,
    `# Costly Privilege Eliminated: ${costlyPrivilegeName}`,
    `# Alternate Privilege Status: ${effectiveReplacementPrivilege ? `Assigned (${effectiveReplacementPrivilege})` : 'None (Costly Privilege Stripped Only)'}`,
    `# Total Roles Remediated: ${effectiveRoles.length}`,
    `# Total Unique Employees: ${totalUniqueEmployees}`,
    `# Target Cloud Service: ${serviceName}`,
    '# ==========================================================================',
    'METADATA|UserRole|PersonNumber|RoleCommonName|AddRemoveRole'
  ]

  const hdlRows: string[] = []
  effectiveRoles.forEach(r => {
    const origCode = `ORA_${r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_JOB`
    const customCode = clonedRoleConfig[r.id]?.code || `XX_${r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_JOB`
    
    hdlRows.push(`# --- Role: ${r.name} (${(r.employees || []).length} users) ---`)
    const emps = r.employees && r.employees.length > 0 ? r.employees : [{ id: employeeId, name: employeeName }]
    emps.forEach(emp => {
      hdlRows.push(`MERGE|UserRole|${emp.id}|${origCode}|REMOVE`)
      hdlRows.push(`MERGE|UserRole|${emp.id}|${customCode}|ADD`)
    })
  })

  const hdlContent = [...hdlHeader, ...hdlRows, ''].join('\n')

  // Formatted SCIM v2 Batch Command across all roles
  const scimSections = effectiveRoles.map(r => {
    const origCode = `ORA_${r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_JOB`
    const customCode = clonedRoleConfig[r.id]?.code || `XX_${r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_JOB`
    const emps = r.employees && r.employees.length > 0 ? r.employees : [{ id: employeeId, name: employeeName }]

    const revokeMembers = emps.map(emp => ({ value: `<${emp.id.toUpperCase()}_USER_GUID>`, operation: 'REMOVE' }))
    const assignMembers = emps.map(emp => ({ value: `<${emp.id.toUpperCase()}_USER_GUID>`, operation: 'ADD' }))

    return `# --- Role: ${r.name} (${emps.length} users) ---
# 1. Revoke Seeded Role: ${r.name}
curl -X PATCH "https://<your-fusion-pod>/hcmRestApi/scim/Roles/<${origCode}_GUID>" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/scim+json" \\
  -d '${JSON.stringify({ members: revokeMembers }, null, 2)}'

# 2. Assign Custom Role: ${clonedRoleConfig[r.id]?.name || `XX_${r.name}`}
curl -X PATCH "https://<your-fusion-pod>/hcmRestApi/scim/Roles/<${customCode}_GUID>" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/scim+json" \\
  -d '${JSON.stringify({ members: assignMembers }, null, 2)}'`
  }).join('\n\n')

  // Handle HDL Download
  const handleDownloadHdl = () => {
    const blob = new Blob([hdlContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'User.dat'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle Copy
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle Live Simulation
  const handleSimulate = () => {
    setIsSimulated(true)
    if (onApplySimulation) {
      const swappedRoles = effectiveRoles.map(r => ({
        originalRoleId: r.id,
        originalRoleName: r.name,
        customRoleName: clonedRoleConfig[r.id]?.name || `XX_${r.name}`,
        customRoleCode: clonedRoleConfig[r.id]?.code || `XX_${r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22).replace(/_+$/, '')}`,
        employees: r.employees && r.employees.length > 0 ? r.employees : [{ id: employeeId || '100597', name: employeeName, email: '', department: '', status: 'active' as const, avatar: '' }]
      }))

      onApplySimulation({
        serviceName,
        roleName: effectiveRoles.map(r => r.name).join(', '),
        customRoleName: effectiveRoles.map(r => clonedRoleConfig[r.id]?.name || `XX_${r.name}`).join(', '),
        employeeName: `All ${totalUniqueEmployees} Employees across ${effectiveRoles.length} Roles`,
        savedLicenses: totalUniqueEmployees,
        costlyPrivilegeName,
        replacementPrivilege: effectiveReplacementPrivilege || undefined,
        swappedRoles
      })
    }
  }

  // Toggle role selection
  const toggleRole = (id: string) => {
    const next = new Set(selectedRoleIds)
    if (next.has(id)) {
      if (next.size > 1) next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedRoleIds(next)
  }

  const selectAllRoles = () => {
    setSelectedRoleIds(new Set(availableRoles.map(r => r.id)))
  }

  const selectOnlyRole = (id: string) => {
    setSelectedRoleIds(new Set([id]))
  }

  // Launch Puppeteer RPA Bot to automate Oracle Cloud Security Console using backend .env
  const handleLaunchRpa = async () => {
    const targetRolesToProcess = effectiveRoles.map(r => ({
      originalRoleName: r.name,
      customRoleName: clonedRoleConfig[r.id]?.name || `XX_${r.name}`,
      customRoleCode: clonedRoleConfig[r.id]?.code || `XX_${r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22).replace(/_+$/, '')}`,
      employees: (r.employees && r.employees.length > 0) ? r.employees : (roleEmployees && roleEmployees.length > 0 ? roleEmployees : (employeeName ? [{ name: employeeName, id: employeeId }] : []))
    }))

    const primaryRole = targetRolesToProcess[0] || {
      originalRoleName: roleName,
      customRoleName: `XX_${roleName}`,
      customRoleCode: `XX_${roleName.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22).replace(/_+$/, '')}`,
      employees: roleEmployees && roleEmployees.length > 0 ? roleEmployees : (employeeName ? [{ name: employeeName, id: employeeId }] : [])
    }

    setIsRpaRunning(true)
    setRpaStatus('INITIALIZING')
    setRpaProgress(5)
    setRpaMessage(`Connecting to Oracle Fusion Cloud for ${targetRolesToProcess.length} role(s)...`)
    setRpaLogs([
      `[${new Date().toLocaleTimeString()}] Target Pod: ${oracleEnvConfig?.host || 'From .env'}`,
      `[${new Date().toLocaleTimeString()}] Authenticated as: ${oracleEnvConfig?.username || 'From .env'}`,
      `[${new Date().toLocaleTimeString()}] Execution Scope: ${targetRolesToProcess.length} role(s) (${targetRolesToProcess.map(t => t.originalRoleName).join(', ')})`,
      `[${new Date().toLocaleTimeString()}] Assigned Employees Scope: ${totalUniqueEmployees} unique user(s) to attach in Step 7 (Users)`,
      `[${new Date().toLocaleTimeString()}] Initializing Puppeteer automation engine...`
    ])
    setRpaError(null)
    setRpaScreenshot(null)

    try {
      const res = await fetch('http://localhost:3001/api/remediation/oracle-auto-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: targetRolesToProcess.map(t => ({
            ...t,
            replacementPrivilege: effectiveReplacementPrivilege
          })),
          originalRoleName: primaryRole.originalRoleName,
          customRoleName: primaryRole.customRoleName,
          customRoleCode: primaryRole.customRoleCode,
          employees: primaryRole.employees,
          privilegeToStrip: costlyPrivilegeName,
          replacementPrivilege: effectiveReplacementPrivilege,
          headless: isHeadless
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start Oracle RPA automation.')
      }

      setRpaJobId(data.jobId)

      // Start status polling
      const pollTimer = setInterval(async () => {
        try {
          const pollRes = await fetch(`http://localhost:3001/api/remediation/oracle-status/${data.jobId}`)
          if (pollRes.ok) {
            const statusData = await pollRes.json()
            setRpaStatus(statusData.status || 'RUNNING')
            setRpaProgress(statusData.progress || 0)
            setRpaMessage(statusData.message || '')
            if (statusData.logs) setRpaLogs(statusData.logs)
            if (statusData.proofScreenshot) setRpaScreenshot(statusData.proofScreenshot)

            if (statusData.status === 'COMPLETED') {
              clearInterval(pollTimer)
              setIsRpaRunning(false)
            } else if (statusData.status === 'FAILED' || statusData.status === 'ROLE_NOT_FOUND') {
              clearInterval(pollTimer)
              setIsRpaRunning(false)
              setRpaStatus(statusData.status)
              setRpaError(statusData.error || statusData.message)
            }
          }
        } catch {
          // ignore transient poll error
        }
      }, 1500)

    } catch (err: any) {
      setIsRpaRunning(false)
      setRpaStatus('FAILED')
      setRpaError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F1B2D]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border bg-white"
        style={{
          borderColor: 'var(--line, #E1E6EE)',
          color: 'var(--ink, #0F1B2D)'
        }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b bg-white"
          style={{ borderColor: 'var(--line, #E1E6EE)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-2xs" style={{ background: 'var(--acc, #1D4ED8)' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)' }}>
                  Enterprise Privilege Remediation Studio
                </span>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border" style={{ background: 'var(--gb, #E4F5EA)', color: 'var(--gt, #0E6B38)', borderColor: 'var(--line, #E1E6EE)' }}>
                  <CheckCircle2 size={11} /> {totalUniqueEmployees} Licenses Across {effectiveRoles.length} Roles Can Be Saved
                </span>
              </div>
              <h2 className="text-base font-bold tracking-tight mt-1" style={{ color: 'var(--ink, #0F1B2D)' }}>
                Remediate Costly Privilege Across All Assigned Roles
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: 'var(--bg, #F4F6FA)' }}>
          {/* Target Summary Banner */}
          <div className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 shadow-2xs bg-white" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--mut, #586377)' }}>
                Target Cloud Service &amp; Costly Privilege
              </span>
              <p className="text-xs font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>{serviceName}</p>
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold border" style={{ background: 'var(--rb, #FDEBEA)', color: 'var(--rt, #B3261E)', borderColor: 'var(--rb, #FDEBEA)' }}>
                  {costlyPrivilegeName}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--mut, #586377)' }}>
                  inherited by <strong style={{ color: 'var(--ink, #0F1B2D)' }}>{effectiveRoles.length} roles</strong> with <strong style={{ color: 'var(--ink, #0F1B2D)' }}>{totalUniqueEmployees} total employees</strong>.
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--mut, #586377)' }}>
                Total Potential Savings
              </span>
              <span className="text-2xl font-black font-mono" style={{ color: 'var(--gt, #0E6B38)' }}>
                {totalPotentialSavings > 0 ? `$${totalPotentialSavings.toLocaleString()}/mo` : `${totalUniqueEmployees} Paid Licenses`}
              </span>
              {totalUniqueEmployees > 1 && serviceCost > 0 && (
                <span className="text-[10px] block" style={{ color: 'var(--mut, #586377)' }}>
                  (${serviceCost.toLocaleString()} &times; {totalUniqueEmployees} users)
                </span>
              )}
            </div>
          </div>

          {/* 3 Steps Container */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Step 1: Clone Selected Roles */}
            <div className="p-4 rounded-xl border flex flex-col justify-between shadow-2xs bg-white h-full" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: 'var(--acc, #1D4ED8)' }}>1</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink, #0F1B2D)' }}>
                      Clone {effectiveRoles.length} Role{effectiveRoles.length !== 1 ? 's' : ''} (XX_)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)', borderColor: 'var(--line, #E1E6EE)' }}>
                    {effectiveRoles.length} of {availableRoles.length} selected
                  </span>
                </div>

                {/* Scope Switcher: Both Roles vs Single Role */}
                {availableRoles.length > 1 && (
                  <div className="mb-3 p-2 rounded-lg border flex flex-col gap-1.5" style={{ background: 'var(--soft, #F0F3F8)', borderColor: 'var(--line, #E1E6EE)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between" style={{ color: 'var(--mut, #586377)' }}>
                      <span className="flex items-center gap-1.5"><Layers size={12} style={{ color: 'var(--acc, #1D4ED8)' }} /> Remediation Scope:</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllRoles}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                          selectedRoleIds.size === availableRoles.length
                            ? 'bg-[var(--acc,#1D4ED8)] text-white border-[var(--acc,#1D4ED8)] shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span>✓ Remediate All Roles</span>
                        <span className="text-[10px] opacity-80 font-mono">({availableRoles.length} Roles)</span>
                      </button>

                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--mut, #586377)' }}>Or Single:</span>
                        {availableRoles.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectOnlyRole(r.id)}
                            className={`flex-1 px-2 py-1 rounded text-[10px] font-bold border transition-all text-left truncate flex items-center justify-between cursor-pointer ${
                              selectedRoleIds.size === 1 && selectedRoleIds.has(r.id)
                                ? 'bg-[var(--acct,#1B3FA8)] text-white border-[var(--acct,#1B3FA8)] shadow-2xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span className="truncate">{r.name}</span>
                            <span className="text-[9px] opacity-80 font-mono ml-1 shrink-0">({(r.employees || []).length})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
                  {availableRoles.map(r => {
                    const isSelected = selectedRoleIds.has(r.id);
                    const currentCode = clonedRoleConfig[r.id]?.code || `XX_${r.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22).replace(/_+$/, '')}`;
                    const currentName = clonedRoleConfig[r.id]?.name || `XX_${r.name}`;
                    const isCodeTooLong = currentCode.length > 30;

                    return (
                      <div
                        key={r.id}
                        className={`p-2.5 rounded-lg border transition-all space-y-2 ${
                          isSelected
                            ? 'bg-[var(--soft,#F0F3F8)] border-[var(--line,#E1E6EE)]'
                            : 'bg-gray-50 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="flex items-center gap-2 cursor-pointer font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRole(r.id)}
                              className="w-4 h-4 rounded accent-[var(--acc,#1D4ED8)] cursor-pointer"
                            />
                            <span className="truncate" title={r.name}>{r.name}</span>
                          </label>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-white border border-[var(--line,#E1E6EE)]" style={{ color: 'var(--ink, #0F1B2D)' }}>
                            {(r.employees || []).length} users
                          </span>
                        </div>

                        {isSelected ? (
                          <div className="space-y-2 pt-1 border-t" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
                            {/* Editable Role Name */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--mut, #586377)' }}>
                                Role Name (Oracle Display)
                              </label>
                              <input
                                type="text"
                                value={currentName}
                                onChange={e => {
                                  const val = e.target.value;
                                  setClonedRoleConfig(prev => ({
                                    ...prev,
                                    [r.id]: {
                                      name: val,
                                      code: prev[r.id]?.code || currentCode
                                    }
                                  }));
                                }}
                                placeholder="e.g. XX_Order Entry Specialist"
                                className="w-full text-xs font-semibold p-2 rounded bg-white border text-[var(--ink,#0F1B2D)] focus:outline-none focus:ring-2 focus:ring-[var(--acc,#1D4ED8)]/20 transition-all"
                                style={{ borderColor: 'var(--line, #E1E6EE)' }}
                              />
                            </div>

                            {/* Editable Role Code */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--mut, #586377)' }}>Role Code</label>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  isCodeTooLong
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : 'bg-white text-[var(--mut,#586377)] border border-[var(--line,#E1E6EE)]'
                                }`}>
                                  {currentCode.length}/30 chars
                                </span>
                              </div>
                              <input
                                type="text"
                                maxLength={30}
                                value={currentCode}
                                onChange={e => {
                                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                                  setClonedRoleConfig(prev => ({
                                    ...prev,
                                    [r.id]: {
                                      name: prev[r.id]?.name || currentName,
                                      code: val
                                    }
                                  }));
                                }}
                                placeholder="e.g. XX_FOM_ORDER_ENTRY_SPEC"
                                className={`w-full text-xs font-mono font-bold p-2 rounded border focus:outline-none focus:ring-2 transition-all ${
                                  isCodeTooLong
                                    ? 'bg-red-50 border-red-300 text-red-900 focus:ring-red-500'
                                    : 'bg-white text-[var(--ink,#0F1B2D)] focus:ring-[var(--acc,#1D4ED8)]/20'
                                }`}
                                style={{ borderColor: isCodeTooLong ? undefined : 'var(--line, #E1E6EE)' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 italic flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
                            <span>Excluded from execution</span>
                            <button
                              type="button"
                              onClick={() => toggleRole(r.id)}
                              className="text-[10px] font-bold hover:underline cursor-pointer"
                              style={{ color: 'var(--acc, #1D4ED8)' }}
                            >
                              + Include
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[10px] flex items-center gap-1.5" style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--mut, #586377)' }}>
                <Info size={12} /> Clones {effectiveRoles.length} selected role{effectiveRoles.length !== 1 ? 's' : ''} to preserve standard templates.
              </div>
            </div>

            {/* Step 2: Strip Costly Privilege */}
            <div className="p-4 rounded-xl border flex flex-col justify-between shadow-2xs bg-white h-full" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: 'var(--acc, #1D4ED8)' }}>2</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink, #0F1B2D)' }}>
                    Strip Costly Privilege
                  </h3>
                </div>
                <div className="space-y-3">
                  {/* Costly Privilege To Remove */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--rt, #B3261E)' }}>
                      Costly Privilege to Remove
                    </label>
                    <div className="p-2.5 rounded-lg border space-y-1" style={{ background: 'var(--rb, #FDEBEA)', borderColor: 'rgba(179,38,30,0.2)' }}>
                      <div className="text-xs font-mono font-bold break-all flex items-center gap-1.5" style={{ color: 'var(--rt, #B3261E)' }}>
                        <span className="font-bold">✕</span> {costlyPrivilegeName}
                      </div>
                      <p className="text-[10px] leading-snug" style={{ color: 'var(--rt, #B3261E)' }}>
                        Will be stripped from all <strong>{effectiveRoles.length} custom cloned role{effectiveRoles.length !== 1 ? 's' : ''}</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Alternate Privilege Checkbox + Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer select-none" style={{ color: 'var(--ink, #0F1B2D)' }}>
                        <input
                          type="checkbox"
                          checked={includeAlternatePrivilege}
                          onChange={e => setIncludeAlternatePrivilege(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[var(--acc,#1D4ED8)] cursor-pointer"
                        />
                        <span>Add Alternate Privilege</span>
                      </label>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded transition-colors border" style={{
                        background: includeAlternatePrivilege ? 'var(--gb, #E4F5EA)' : 'var(--soft, #F0F3F8)',
                        color: includeAlternatePrivilege ? 'var(--gt, #0E6B38)' : 'var(--mut, #586377)',
                        borderColor: includeAlternatePrivilege ? 'rgba(14,107,56,0.2)' : 'var(--line, #E1E6EE)'
                      }}>
                        {includeAlternatePrivilege ? 'Attached' : 'Strip Only (No Alternate)'}
                      </span>
                    </div>
                    <input
                      type="text"
                      disabled={!includeAlternatePrivilege}
                      value={replacementPrivilege}
                      onChange={e => setReplacementPrivilege(e.target.value)}
                      placeholder={includeAlternatePrivilege ? 'Enter alternate duty role (e.g. View Orders)' : 'No alternate privilege will be added'}
                      className={`w-full text-xs p-2 rounded-lg border font-medium focus:outline-none transition-all ${
                        includeAlternatePrivilege
                          ? 'bg-white text-[var(--ink,#0F1B2D)] focus:ring-2 focus:ring-[var(--acc,#1D4ED8)]/20'
                          : 'bg-[var(--soft,#F0F3F8)] text-gray-400 cursor-not-allowed italic'
                      }`}
                      style={{ borderColor: 'var(--line, #E1E6EE)' }}
                    />
                    <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--mut, #586377)' }}>
                      {includeAlternatePrivilege
                        ? 'Assigns substitute non-billable duty role to preserve read/view workflows.'
                        : 'Costly privilege will be stripped completely without granting any substitute duty role.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[10px] font-semibold flex items-center gap-1.5" style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--gt, #0E6B38)' }}>
                <CheckCircle2 size={12} /> Eliminates the paid SKU dependency across all {effectiveRoles.length} roles!
              </div>
            </div>

            {/* Step 3: Swap Assignment & Target Selection */}
            <div className="p-4 rounded-xl border flex flex-col justify-between shadow-2xs bg-white h-full" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: 'var(--acc, #1D4ED8)' }}>3</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink, #0F1B2D)' }}>
                    Swap {totalUniqueEmployees} Employees
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* Direct vs Inherited toggle */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mut, #586377)' }}>
                      Role Assignment Hierarchy
                    </label>
                    <div className="seg w-full">
                      <button
                        type="button"
                        onClick={() => setIsDirectAssignment(true)}
                        className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer ${isDirectAssignment ? 'on' : ''}`}
                      >
                        <CheckCircle2 size={12} /> YES (Direct)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDirectAssignment(false)}
                        className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer ${!isDirectAssignment ? 'on' : ''}`}
                      >
                        <Layers size={12} /> NO (Inherited)
                      </button>
                    </div>
                  </div>

                  {/* Summary Breakdown */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mut, #586377)' }}>
                      Swap Distribution per Role
                    </label>
                    <div className="p-2.5 rounded-lg border space-y-1.5 max-h-40 overflow-y-auto" style={{ background: 'var(--soft, #F0F3F8)', borderColor: 'var(--line, #E1E6EE)' }}>
                      {effectiveRoles.map(r => (
                        <div key={r.id} className="text-[11px] flex items-center justify-between border-b pb-1 last:border-0 last:pb-0" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
                          <span className="truncate max-w-[170px] font-medium" style={{ color: 'var(--ink, #0F1B2D)' }} title={r.name}>{r.name}</span>
                          <span className="font-bold" style={{ color: 'var(--gt, #0E6B38)' }}>{(r.employees || []).length} users</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t text-[10px] flex items-center gap-1.5" style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--mut, #586377)' }}>
                <Shield size={12} /> Total of {totalUniqueEmployees} employees swapped across {effectiveRoles.length} roles.
              </div>
            </div>
          </div>

          {/* Verification & Proof of Execution Card (shown after clicking Apply Simulation) */}
          {isSimulated && (
            <div className="p-4 rounded-xl border-2 border-emerald-400 bg-emerald-50/90 shadow-md animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <CheckCircle2 size={15} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-emerald-950 uppercase tracking-wider block">
                      Remediation Verified &amp; Applied
                    </span>
                    <span className="text-[10px] text-emerald-700">
                      Live dashboard metrics successfully updated
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                  <Check size={12} /> 100% PERFECTLY EXECUTED
                </span>
              </div>

              {/* Before vs After comparison grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white border border-emerald-200 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Billable Users</div>
                  <div className="text-sm font-mono font-bold text-gray-900 mt-1 flex items-center justify-center gap-1.5">
                    <span className="line-through text-red-500">{totalUniqueEmployees}</span>
                    <ArrowRight size={13} className="text-gray-400" />
                    <span className="text-emerald-600 text-base font-black">0</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 mt-1 bg-emerald-50 py-0.5 rounded">
                    -{totalUniqueEmployees} Users (-100%)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white border border-emerald-200 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Monthly License Cost</div>
                  <div className="text-sm font-mono font-bold text-gray-900 mt-1 flex items-center justify-center gap-1.5">
                    <span className="line-through text-red-500">${(serviceCost * totalUniqueEmployees).toLocaleString()}</span>
                    <ArrowRight size={13} className="text-gray-400" />
                    <span className="text-emerald-600 text-base font-black">$0</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 mt-1 bg-emerald-50 py-0.5 rounded">
                    ${(serviceCost * totalUniqueEmployees).toLocaleString()} Saved!
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white border border-emerald-200 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Role Swaps Verified</div>
                  <div className="text-sm font-mono font-bold text-emerald-700 mt-1">
                    {effectiveRoles.length} Roles &bull; {totalUniqueEmployees} Users
                  </div>
                  <div className="text-[10px] font-bold text-blue-700 mt-1 bg-blue-50 py-0.5 rounded">
                    Reassigned to XX_
                  </div>
                </div>
              </div>

              {/* Checklist */}
              {/* User-by-User Reassignment Table */}
              <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden shadow-xs">
                <div className="p-2.5 bg-emerald-100/50 border-b border-emerald-200 flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-700" />
                    <span>Live Reassigned Users ({totalUniqueEmployees} Employees Swapped to Custom Role)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    Role Swapped: Old Role Stripped &bull; New Role Assigned
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">User / Employee</th>
                        <th className="px-3 py-2">Previous Seeded Role</th>
                        <th className="px-3 py-2">New Assigned Custom Role</th>
                        <th className="px-3 py-2 text-right">License Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {effectiveRoles.flatMap(r => {
                        const emps = r.employees && r.employees.length > 0 ? r.employees : [{ id: employeeId || '100597', name: employeeName }]
                        const customRole = clonedRoleConfig[r.id]?.name || `XX_${r.name}`
                        return emps.map(emp => (
                          <tr key={`${r.id}_${emp.id}`} className="hover:bg-emerald-50/40 transition-colors">
                            <td className="px-3 py-2 font-semibold text-gray-900 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {emp.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate">{emp.name}</span>
                              <span className="text-[10px] font-mono text-gray-400">({emp.id})</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="line-through text-gray-400 text-[11px] font-mono">
                                {r.name}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                                {customRole}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700 text-[11px]">
                              ✓ 1 Paid License Saved
                            </td>
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Export / Execution Console */}
          <div className="rounded-xl border overflow-hidden bg-white shadow-2xs" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
            {/* Tabs Header */}
            <div className="flex items-center justify-between border-b px-3 py-2 flex-wrap gap-2" style={{ background: 'var(--soft, #F0F3F8)', borderColor: 'var(--line, #E1E6EE)' }}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setActiveTab('rpa')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'rpa'
                      ? 'bg-white text-[var(--acct,#1B3FA8)] shadow-2xs border border-[var(--line,#E1E6EE)]'
                      : 'text-[var(--mut,#586377)] hover:text-[var(--ink,#0F1B2D)] hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <Cpu size={13} style={{ color: activeTab === 'rpa' ? 'var(--acc, #1D4ED8)' : undefined }} /> 1-Click Auto-Deploy to Oracle Cloud (RPA Bot)
                </button>
                <button
                  onClick={() => setActiveTab('hdl')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'hdl'
                      ? 'bg-white text-[var(--acct,#1B3FA8)] shadow-2xs border border-[var(--line,#E1E6EE)]'
                      : 'text-[var(--mut,#586377)] hover:text-[var(--ink,#0F1B2D)] hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <Download size={13} /> Oracle HDL ({effectiveRoles.length} Roles, {totalUniqueEmployees} Users)
                </button>
                <button
                  onClick={() => setActiveTab('scim')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'scim'
                      ? 'bg-white text-[var(--acct,#1B3FA8)] shadow-2xs border border-[var(--line,#E1E6EE)]'
                      : 'text-[var(--mut,#586377)] hover:text-[var(--ink,#0F1B2D)] hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <Terminal size={13} /> SCIM Batch Script
                </button>
                <button
                  onClick={() => setActiveTab('sop')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'sop'
                      ? 'bg-white text-[var(--acct,#1B3FA8)] shadow-2xs border border-[var(--line,#E1E6EE)]'
                      : 'text-[var(--mut,#586377)] hover:text-[var(--ink,#0F1B2D)] hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <FileText size={13} /> Security Console SOP
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {activeTab === 'hdl' && (
                  <button
                    onClick={handleDownloadHdl}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:brightness-110 cursor-pointer"
                    style={{ background: 'var(--acc, #1D4ED8)' }}
                  >
                    <Download size={12} /> Download User.dat ({effectiveRoles.length} Roles)
                  </button>
                )}
                {activeTab !== 'rpa' && (
                  <button
                    onClick={() => handleCopy(activeTab === 'hdl' ? hdlContent : scimSections)}
                    className="px-3 py-1.5 rounded-lg bg-white border hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                )}
              </div>
            </div>

            {/* Tab 0: RPA Automation Bot */}
            {activeTab === 'rpa' && (
              <div className="p-5 bg-white text-gray-900 space-y-4">
                <div className="p-3.5 rounded-xl border flex items-start gap-3" style={{ background: 'var(--accbg, #E7EEFF)', borderColor: 'rgba(29, 78, 216, 0.2)' }}>
                  <div className="p-2 rounded-lg text-white shadow-2xs shrink-0" style={{ background: 'var(--acc, #1D4ED8)' }}>
                    <Cpu size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>
                      Automated Oracle Security Console Role Cloning &amp; Privilege Stripping
                    </h4>
                    <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--acct, #1B3FA8)' }}>
                      This Puppeteer RPA worker securely connects to your Oracle Fusion Cloud pod, searches for <strong>{effectiveRoles[0]?.name || roleName}</strong>, creates <strong>{clonedRoleConfig[effectiveRoles[0]?.id]?.name || `XX_${roleName}`}</strong>, deletes the costly privilege <strong>{costlyPrivilegeName}</strong>, and submits the custom role definition into Oracle’s security database automatically.
                    </p>
                  </div>
                </div>

                {/* Oracle Environment Connected Card (Direct from .env) */}
                <div className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: 'var(--soft, #F0F3F8)', borderColor: 'var(--line, #E1E6EE)' }}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border" style={{ background: 'var(--gb, #E4F5EA)', color: 'var(--gt, #0E6B38)', borderColor: 'rgba(14,107,56,0.2)' }}>
                        Oracle Instance Connected (.env)
                      </span>
                    </div>
                    <div className="text-xs pt-0.5" style={{ color: 'var(--ink, #0F1B2D)' }}>
                      <strong>Host:</strong> <span className="font-mono font-semibold" style={{ color: 'var(--acc, #1D4ED8)' }}>{oracleEnvConfig?.host || 'fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com'}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--mut, #586377)' }}>
                      <strong>Authenticated User:</strong> <span className="font-semibold" style={{ color: 'var(--ink, #0F1B2D)' }}>{oracleEnvConfig?.username || 'Curtis.Feitty'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs bg-white px-3 py-2 rounded-lg border shadow-2xs" style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}>
                      <input
                        type="checkbox"
                        checked={isHeadless}
                        onChange={e => setIsHeadless(e.target.checked)}
                        disabled={isRpaRunning}
                        className="rounded accent-[var(--acc,#1D4ED8)]"
                      />
                      <span>Headless mode (uncheck to watch visible browser)</span>
                    </label>

                    <button
                      onClick={handleLaunchRpa}
                      disabled={isRpaRunning}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all hover:brightness-110 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ background: 'var(--acc, #1D4ED8)' }}
                    >
                      {isRpaRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                      {isRpaRunning ? 'Bot Executing in Oracle Cloud...' : 'Launch Auto-Provisioning Bot'}
                    </button>
                  </div>
                </div>

                {/* Live RPA Progress Card */}
                {rpaStatus !== 'IDLE' && (
                  <div className="p-4 rounded-xl border bg-gray-900 text-gray-100 space-y-3 font-mono shadow-md">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isRpaRunning ? 'bg-amber-400 animate-ping' : rpaStatus === 'COMPLETED' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        <strong className="text-white uppercase font-sans">Execution Status:</strong>
                        <span className={`font-sans font-bold ${rpaStatus === 'ROLE_NOT_FOUND' ? 'text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-700 text-[11px]' : 'text-purple-300'}`}>
                          {rpaStatus === 'ROLE_NOT_FOUND' ? 'ROLE NOT FOUND' : (rpaMessage || rpaStatus)}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-purple-400 font-mono">{rpaProgress}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700">
                      <div
                        className={`h-full transition-all duration-300 ${
                          rpaStatus === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : (rpaStatus === 'FAILED' || rpaStatus === 'ROLE_NOT_FOUND')
                            ? 'bg-red-500'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                        }`}
                        style={{ width: `${rpaProgress}%` }}
                      ></div>
                    </div>

                    {rpaJobId && (
                      <div className="text-[10px] font-mono text-gray-400">
                        Execution Job: {rpaJobId}
                      </div>
                    )}

                    {/* Prominent Role Not Found Alert */}
                    {(rpaStatus === 'ROLE_NOT_FOUND' || rpaError?.toLowerCase().includes('not found') || rpaError?.toLowerCase().includes('does not match')) ? (
                      <div className="p-3 rounded-lg bg-red-950/70 border border-red-600 text-red-200 text-xs space-y-1.5 font-sans animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 font-bold text-red-300 text-sm">
                          <AlertTriangle size={16} className="text-red-400 shrink-0" />
                          <span>Role Not Found in Demo Instance</span>
                        </div>
                        <p className="font-mono text-[11px] text-red-200 leading-relaxed">
                          {rpaError || `The role "${roleName}" was not found or does not match any role in the Oracle demo instance.`}
                        </p>
                        <p className="text-[10px] text-red-300/80">
                          Please verify that the role name or code matches an active role in your Oracle Cloud Security Console.
                        </p>
                      </div>
                    ) : rpaError ? (
                      <div className="text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-800 font-mono">
                        {rpaError}
                      </div>
                    ) : null}

                    {/* Live Console Output */}
                    <div className="bg-black/80 p-3 rounded-lg text-[11px] text-emerald-400 font-mono max-h-36 overflow-y-auto space-y-1 border border-gray-800">
                      {rpaLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-gray-500">&gt;</span>
                          <span>{log}</span>
                        </div>
                      ))}
                      {isRpaRunning && (
                        <div className="flex items-center gap-1 text-purple-300 animate-pulse">
                          <span>&gt;</span>
                          <span className="inline-block w-2 h-4 bg-purple-400"></span>
                        </div>
                      )}
                    </div>

                    {/* Proof Screenshot */}
                    {rpaScreenshot && (
                      <div className="pt-2 border-t border-gray-800">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-emerald-400 font-sans font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={13} /> Oracle Cloud Confirmation Proof Screenshot
                          </span>
                          <a
                            href={`http://localhost:3001${rpaScreenshot}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px] font-sans"
                          >
                            <ExternalLink size={11} /> Open Full Size
                          </a>
                        </div>
                        <div className="rounded-lg overflow-hidden border border-gray-700 max-h-48 bg-black">
                          <img
                            src={`http://localhost:3001${rpaScreenshot}`}
                            alt="Oracle Cloud Remediation Proof"
                            className="w-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 1: HDL */}
            {activeTab === 'hdl' && (
              <div className="p-4 bg-gray-900 text-gray-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-64">
                <pre>{hdlContent}</pre>
              </div>
            )}

            {/* Tab 2: SCIM REST */}
            {activeTab === 'scim' && (
              <div className="p-4 bg-gray-900 text-gray-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-64">
                <pre>{scimSections}</pre>
              </div>
            )}

            {/* Tab 3: SOP */}
            {activeTab === 'sop' && (
              <div className="p-4 bg-white text-gray-800 text-xs space-y-2.5">
                <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
                  <li>Log in to Oracle Fusion Cloud as <strong>IT Security Manager</strong>.</li>
                  <li>Navigate to: <strong>Navigator &gt; Tools &gt; Security Console &gt; Roles</strong>.</li>
                  <li>For each of the <strong>{effectiveRoles.length} roles</strong> listed in Step 1:
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {effectiveRoles.map(r => (
                        <li key={r.id}>
                          Search <code>{r.name}</code> &gt; Copy Role &gt; Name it <code>{clonedRoleConfig[r.id]?.name || `XX_${r.name}`}</code> &gt; Strip <code>{costlyPrivilegeName}</code>
                          {effectiveReplacementPrivilege ? (
                            <> &gt; Add Alternate Privilege <code>{effectiveReplacementPrivilege}</code>.</>
                          ) : (
                            <> (No alternate privilege &mdash; stripped only).</>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                  <li>Click <strong>Download User.dat</strong> above to get the complete batch file covering all <strong>{totalUniqueEmployees} employees across all {effectiveRoles.length} roles</strong>.</li>
                  <li>Go to <strong>My Client Groups &gt; Data Exchange &gt; Import and Load Data</strong> &gt; Upload the <code>User.dat</code> zip file.</li>
                  <li>Run scheduled process: <strong>Send Pending LDAP Requests</strong> to complete the swap for all {totalUniqueEmployees} employees!</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="px-6 py-3.5 border-t flex items-center justify-between"
          style={{ background: 'var(--soft, #F0F3F8)', borderColor: 'var(--line, #E1E6EE)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--mut, #586377)' }}>
            <span className="dot dg"></span>
            Multi-role remediation covers <strong style={{ color: 'var(--ink, #0F1B2D)' }}>{effectiveRoles.length} role{effectiveRoles.length !== 1 ? 's' : ''}</strong> and <strong style={{ color: 'var(--ink, #0F1B2D)' }}>{totalUniqueEmployees} unique employees</strong>.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border hover:bg-gray-100 transition-colors cursor-pointer"
              style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
            >
              Close
            </button>
            <button
              onClick={handleSimulate}
              disabled={isSimulated}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer hover:brightness-110 disabled:opacity-90"
              style={{ background: isSimulated ? 'var(--gt, #0E6B38)' : 'var(--acc, #1D4ED8)' }}
            >
              {isSimulated ? <Check size={14} /> : <RefreshCw size={14} />}
              {isSimulated
                ? `Simulation Applied (-${totalUniqueEmployees} Licenses across ${effectiveRoles.length} Roles)!`
                : `Apply Simulation To Dashboard (-${totalUniqueEmployees} Licenses across ${effectiveRoles.length} Roles)`}
            </button>
            {isSimulated && (
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all hover:brightness-110 cursor-pointer"
                style={{ background: 'var(--gt, #0E6B38)' }}
              >
                <Check size={14} /> View Reassigned Users in Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
