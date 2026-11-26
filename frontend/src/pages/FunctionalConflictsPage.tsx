import { useState, useEffect } from 'react'
import { 
  ShieldAlert, 
  Search, 
  Download, 
  RefreshCw, 
  Server, 
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Layers,
  GitCommit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import SodRemediationModal from '../components/SodRemediationModal'

interface FunctionalConflictRecord {
  id: string
  ruleId: string
  module: string
  conflictType?: 'INTRA_ROLE' | 'INTER_ROLE'
  conflictTypeLabel?: string
  user: string
  userName: string
  userEmail: string
  assignedRole1: string
  function1: string
  privilegeCode1?: string
  privilegeName1?: string
  oraclePrivilege1?: string
  assignedRole2: string
  function2: string
  privilegeCode2?: string
  privilegeName2?: string
  oraclePrivilege2?: string
  conflict: string
  rating: 'High' | 'Medium'
  description: string
  howDetected: string
  targetRoleToRevoke: string
  actionRequired: string
  status: 'ACTIVE' | 'SUCCEEDED'
  isRemediated?: boolean
  remediatedAt?: string | null
}

interface ConflictStats {
  totalConflicts: number
  activeConflictsCount: number
  intraRoleCount?: number
  interRoleCount?: number
  succeededCount: number
  highRiskCount: number
  mediumRiskCount: number
  affectedUsersCount: number
  totalUsersScanned: number
  generatedAt: string
}

const SERVER_URL = 'http://localhost:3001'
const PAGE_SIZE = 10

export default function FunctionalConflictsPage() {
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [conflicts, setConflicts] = useState<FunctionalConflictRecord[]>([])
  const [stats, setStats] = useState<ConflictStats | null>(null)
  const [dataSource, setDataSource] = useState<string>('')
  const [instanceHost, setInstanceHost] = useState<string>('fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com')
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'ACTIVE' | 'SUCCEEDED'>('All')
  const [scopeFilter, setScopeFilter] = useState<'All' | 'INTRA_ROLE' | 'INTER_ROLE'>('All')
  const [riskFilter, setRiskFilter] = useState<'All' | 'High' | 'Medium'>('All')
  const [moduleFilter, setModuleFilter] = useState<'All' | 'FIN' | 'HCM' | 'SCM' | 'SYS'>('All')
  const [sortBy, setSortBy] = useState<'user_asc' | 'user_desc' | 'rule_asc' | 'rating_desc'>('user_asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Modals & Bot Automation state
  const [remediatedIds, setRemediatedIds] = useState<Set<string>>(new Set())
  const [selectedConflict, setSelectedConflict] = useState<FunctionalConflictRecord | null>(null)
  const [activeBotConflict, setActiveBotConflict] = useState<FunctionalConflictRecord | null>(null)

  useEffect(() => {
    handleFetchConflicts()
  }, [])

  async function handleFetchConflicts(force = false) {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${SERVER_URL}/api/sod/conflicts${force ? '?fresh=true' : ''}`)
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({ error: 'Failed to fetch functional conflicts' }))
        throw new Error(errJson.error || `Server responded with ${resp.status}`)
      }
      const result = await resp.json()
      setConflicts(result.conflicts || [])
      setStats({
        totalConflicts: result.totalConflicts || 0,
        activeConflictsCount: result.activeConflictsCount || 0,
        intraRoleCount: result.intraRoleCount || 0,
        interRoleCount: result.interRoleCount || 0,
        succeededCount: result.succeededCount || 0,
        highRiskCount: result.highRiskCount || 0,
        mediumRiskCount: result.mediumRiskCount || 0,
        affectedUsersCount: result.affectedUsersCount || 0,
        totalUsersScanned: result.totalUsersScanned || 0,
        generatedAt: result.generatedAt || new Date().toISOString()
      })
      setDataSource(result.source || 'oracle_demo_instance')
      if (result.instance?.host) setInstanceHost(result.instance.host)
      setDataLoaded(true)
      setCurrentPage(1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query Oracle Demo instance'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleExportCsv() {
    if (!filteredConflicts.length) return
    const headers = [
      'User',
      'Scope',
      'Assigned Role 1',
      'Function 1',
      'Oracle Privilege Code 1',
      'Assigned Role 2',
      'Function 2',
      'Oracle Privilege Code 2',
      'Conflict Rule',
      'Rating',
      'Status',
      'Remediated Date',
      'How Detected',
      'Action Required'
    ]
    const rows = filteredConflicts.map(c => [
      `"${c.user}"`,
      `"${c.conflictTypeLabel || c.conflictType || 'Cross-Role'}"`,
      `"${c.assignedRole1}"`,
      `"${c.function1}"`,
      `"${c.oraclePrivilege1 || ''}"`,
      `"${c.assignedRole2}"`,
      `"${c.function2}"`,
      `"${c.oraclePrivilege2 || ''}"`,
      `"${c.conflict.replace(/"/g, '""')}"`,
      `"${c.rating}"`,
      `"${c.status || 'ACTIVE'}"`,
      `"${c.remediatedAt || 'N/A'}"`,
      `"${(c.howDetected || '').replace(/"/g, '""')}"`,
      `"${c.actionRequired}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Oracle_Functional_Conflicts_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter logic
  const filteredConflicts = conflicts.filter(c => {
    const q = searchQuery.toLowerCase().trim()
    const matchSearch = !q || 
      c.user.toLowerCase().includes(q) ||
      c.userName.toLowerCase().includes(q) ||
      c.assignedRole1.toLowerCase().includes(q) ||
      c.assignedRole2.toLowerCase().includes(q) ||
      c.conflict.toLowerCase().includes(q) ||
      c.function1.toLowerCase().includes(q) ||
      c.function2.toLowerCase().includes(q) ||
      (c.oraclePrivilege1 && c.oraclePrivilege1.toLowerCase().includes(q)) ||
      (c.oraclePrivilege2 && c.oraclePrivilege2.toLowerCase().includes(q))

    const isSucceeded = c.status === 'SUCCEEDED' || remediatedIds.has(c.id)
    const matchStatus = statusFilter === 'All' || 
      (statusFilter === 'SUCCEEDED' && isSucceeded) || 
      (statusFilter === 'ACTIVE' && !isSucceeded)

    const matchScope = scopeFilter === 'All' || c.conflictType === scopeFilter
    const matchRisk = riskFilter === 'All' || c.rating === riskFilter
    const matchModule = moduleFilter === 'All' || c.module === moduleFilter
    return matchSearch && matchStatus && matchScope && matchRisk && matchModule
  })

  // Sort logic: alphabetical order (user_asc) by default
  filteredConflicts.sort((a, b) => {
    if (sortBy === 'user_desc') {
      const nameA = String(a.userName || a.user || '').trim().toLowerCase()
      const nameB = String(b.userName || b.user || '').trim().toLowerCase()
      const cmp = nameB.localeCompare(nameA)
      if (cmp !== 0) return cmp
      return (a.ruleId || '').localeCompare(b.ruleId || '')
    }
    if (sortBy === 'rule_asc') {
      return (a.ruleId || '').localeCompare(b.ruleId || '')
    }
    if (sortBy === 'rating_desc') {
      const score = (r: string) => r === 'High' ? 2 : 1
      const diff = score(b.rating) - score(a.rating)
      if (diff !== 0) return diff
      return (a.userName || a.user || '').localeCompare(b.userName || b.user || '')
    }
    // Default: Alphabetical Order (A → Z)
    const nameA = String(a.userName || a.user || '').trim().toLowerCase()
    const nameB = String(b.userName || b.user || '').trim().toLowerCase()
    const cmp = nameA.localeCompare(nameB)
    if (cmp !== 0) return cmp
    return (a.ruleId || '').localeCompare(b.ruleId || '')
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredConflicts.length / PAGE_SIZE) || 1
  const paginatedConflicts = filteredConflicts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--card, #ffffff)' }}>
      <Sidebar />

      <main className="flex-1 p-8 max-w-7xl mx-auto overflow-x-hidden">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold tracking-wider text-amber-700 uppercase px-2.5 py-0.5 rounded-md" style={{ background: '#fdf0e6' }}>
                Segregation of Duties (SoD) • Privilege Engine
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Server size={12} /> {instanceHost} {dataSource ? `• ${dataSource.replace(/_/g, ' ')}` : ''}
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
              <ShieldAlert className="text-red-600" size={26} />
              Functional Conflicts
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Detect privilege conflicts across <span className="font-semibold text-gray-800">User → Roles → Privileges</span> (Intra-role toxic duties & Inter-role segregation violations).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleFetchConflicts(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition shadow-sm disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Scanning Oracle...' : 'Refresh Scan'}
            </button>

            <button
              onClick={handleExportCsv}
              disabled={!filteredConflicts.length}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition disabled:opacity-50"
              style={{ background: 'var(--acc, #1D4ED8)' }}
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => handleFetchConflicts(false)} className="font-bold underline ml-4 hover:text-red-950">Retry</button>
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Evaluated</span>
                <ShieldAlert size={18} className="text-amber-600" />
              </div>
              <div className="text-3xl font-black text-gray-900">{stats.totalConflicts}</div>
              <div className="text-xs text-gray-500 mt-1">Across all enterprise modules</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-purple-100 shadow-sm bg-gradient-to-br from-white to-purple-50/20">
              <div className="flex items-center justify-between text-purple-900 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Intra-Role Conflicts</span>
                <Layers size={18} className="text-purple-600" />
              </div>
              <div className="text-3xl font-black text-purple-700">{stats.intraRoleCount || 0}</div>
              <div className="text-xs text-purple-800 font-medium mt-1">Toxic duties inside single role</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-amber-100 shadow-sm bg-gradient-to-br from-white to-amber-50/20">
              <div className="flex items-center justify-between text-amber-900 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Inter-Role Conflicts</span>
                <GitCommit size={18} className="text-amber-600" />
              </div>
              <div className="text-3xl font-black text-amber-700">{stats.interRoleCount || 0}</div>
              <div className="text-xs text-amber-800 font-medium mt-1">Cross-role segregation violations</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-emerald-100 shadow-sm bg-gradient-to-br from-white to-emerald-50/20">
              <div className="flex items-center justify-between text-emerald-800 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Succeeded / Remediated</span>
                <CheckCircle2 size={18} className="text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-600">{stats.succeededCount}</div>
              <div className="text-xs text-emerald-700 font-medium mt-1">Preserved in audit records</div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search user, role, privilege, conflict..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Conflict Scope Filter (Intra-Role vs Inter-Role) */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase">Scope:</span>
              <button
                onClick={() => { setScopeFilter('All'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${scopeFilter === 'All' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All
              </button>
              <button
                onClick={() => { setScopeFilter('INTRA_ROLE'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${scopeFilter === 'INTRA_ROLE' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Intra-Role (Same Role)
              </button>
              <button
                onClick={() => { setScopeFilter('INTER_ROLE'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${scopeFilter === 'INTER_ROLE' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Inter-Role (Cross-Role)
              </button>
            </div>

            <div className="h-4 w-[1px] bg-gray-300 hidden sm:block" />

            {/* Status Filter (Active vs Succeeded) */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase">Status:</span>
              <button
                onClick={() => { setStatusFilter('All'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${statusFilter === 'All' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All
              </button>
              <button
                onClick={() => { setStatusFilter('ACTIVE'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${statusFilter === 'ACTIVE' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Active
              </button>
              <button
                onClick={() => { setStatusFilter('SUCCEEDED'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${statusFilter === 'SUCCEEDED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Succeeded
              </button>
            </div>

            <div className="h-4 w-[1px] bg-gray-300 hidden sm:block" />

            {/* Risk Rating Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase">Risk:</span>
              {(['All', 'High', 'Medium'] as const).map(rating => (
                <button
                  key={rating}
                  onClick={() => {
                    setRiskFilter(rating)
                    setCurrentPage(1)
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                    riskFilter === rating 
                      ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>

            <div className="h-4 w-[1px] bg-gray-300 hidden sm:block" />

            {/* Module Filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-gray-500 uppercase">Module:</span>
              {(['All', 'FIN', 'HCM', 'SCM', 'SYS'] as const).map(mod => (
                <button
                  key={mod}
                  onClick={() => {
                    setModuleFilter(mod)
                    setCurrentPage(1)
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                    moduleFilter === mod
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            <div className="h-4 w-[1px] bg-gray-300 hidden sm:block" />

            {/* Sort Order Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                <ArrowUpDown size={12} className="text-gray-400" />
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={e => {
                  setSortBy(e.target.value as 'user_asc' | 'user_desc' | 'rule_asc' | 'rating_desc')
                  setCurrentPage(1)
                }}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="user_asc">Alphabetical (A → Z)</option>
                <option value="user_desc">Alphabetical (Z → A)</option>
                <option value="rule_asc">Conflict Rule (SOD ID)</option>
                <option value="rating_desc">Highest Risk First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Conflicts Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider">
                  <th 
                    className="py-3.5 px-4 cursor-pointer hover:bg-gray-100/80 transition select-none"
                    onClick={() => setSortBy(prev => prev === 'user_asc' ? 'user_desc' : 'user_asc')}
                    title="Click to toggle alphabetical order"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>User</span>
                      {sortBy === 'user_asc' ? (
                        <ArrowUp size={13} className="text-amber-700" />
                      ) : sortBy === 'user_desc' ? (
                        <ArrowDown size={13} className="text-amber-700" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                      <span className="text-[10px] font-normal normal-case text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded ml-1">
                        {sortBy === 'user_desc' ? 'Z → A' : 'A → Z'}
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">Conflict Scope</th>
                  <th className="py-3.5 px-4">Assigned Role 1 & Privilege</th>
                  <th className="py-3.5 px-4">Assigned Role 2 & Privilege</th>
                  <th 
                    className="py-3.5 px-4 cursor-pointer hover:bg-gray-100/80 transition select-none"
                    onClick={() => setSortBy(prev => prev === 'rule_asc' ? 'user_asc' : 'rule_asc')}
                    title="Click to sort by Conflict Rule"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Conflict Rule</span>
                      {sortBy === 'rule_asc' ? (
                        <ArrowUp size={13} className="text-amber-700" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && !dataLoaded ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                      Analyzing user privileges (Intra-role & Inter-role) from Oracle...
                    </td>
                  </tr>
                ) : paginatedConflicts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No functional conflicts found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedConflicts.map((c) => {
                    const isSucceeded = c.status === 'SUCCEEDED' || remediatedIds.has(c.id)
                    const isIntraRole = c.conflictType === 'INTRA_ROLE'

                    return (
                      <tr 
                        key={c.id} 
                        className={`transition-colors group cursor-pointer ${
                          isSucceeded ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-amber-50/30'
                        }`}
                        onClick={() => setSelectedConflict(c)}
                      >
                        {/* 1. User */}
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{c.user}</span>
                            <Info size={13} className="text-gray-400 group-hover:text-amber-600 transition" />
                          </div>
                          {c.userName && c.userName !== c.user && (
                            <div className="text-xs font-normal text-gray-500">{c.userName}</div>
                          )}
                          {c.userEmail && (
                            <div className="text-[11px] font-normal text-gray-400 truncate max-w-[160px]">{c.userEmail}</div>
                          )}
                        </td>

                        {/* 2. Conflict Scope Badge */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isIntraRole ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200 shadow-xs">
                              <Layers size={11} className="text-purple-600" />
                              Intra-Role • Single Role
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-xs">
                              <GitCommit size={11} className="text-amber-600" />
                              Inter-Role • Cross-Role
                            </span>
                          )}
                        </td>

                        {/* 3. Assigned Role 1 & Privilege 1 */}
                        <td className="py-3.5 px-4 max-w-[270px]">
                          <div className="flex flex-col gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border inline-block w-fit ${
                              isSucceeded && (c.targetRoleToRevoke === c.assignedRole1)
                                ? 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            }`}>
                              {c.assignedRole1}
                            </span>
                            <span className="text-xs text-blue-900 font-medium bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100 inline-block w-fit">
                              🔑 {c.function1}
                            </span>
                            {c.oraclePrivilege1 && (
                              <span
                                title={`Authoritative Oracle Cloud Privilege: ${c.oraclePrivilege1}`}
                                className="font-mono text-[10px] text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1 font-semibold break-all leading-tight w-fit"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                {c.oraclePrivilege1}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Assigned Role 2 & Privilege 2 */}
                        <td className="py-3.5 px-4 max-w-[270px]">
                          <div className="flex flex-col gap-1.5">
                            {isIntraRole ? (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold border inline-block w-fit bg-purple-50 text-purple-900 border-purple-200">
                                ↺ Same Role ({c.assignedRole1})
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold border inline-block w-fit ${
                                isSucceeded && (c.targetRoleToRevoke === c.assignedRole2)
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 line-through' 
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                              }`}>
                                {c.assignedRole2}
                              </span>
                            )}
                            <span className="text-xs text-amber-900 font-medium bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200 inline-block w-fit">
                              ⚡ {c.function2}
                            </span>
                            {c.oraclePrivilege2 && (
                              <span
                                title={`Authoritative Oracle Cloud Privilege: ${c.oraclePrivilege2}`}
                                className="font-mono text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1 font-semibold break-all leading-tight w-fit"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                {c.oraclePrivilege2}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Conflict Rule */}
                        <td className="py-3.5 px-4 max-w-[260px]">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                isSucceeded
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : c.rating === 'High' 
                                    ? 'bg-red-100 text-red-800 border border-red-200' 
                                    : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              }`}>
                                {isSucceeded ? (
                                  <>
                                    <CheckCircle2 size={11} className="text-emerald-700" />
                                    Resolved: {c.ruleId}
                                  </>
                                ) : (
                                  <>
                                    {c.rating === 'High' && <AlertTriangle size={11} />}
                                    {c.ruleId} • {c.rating}
                                  </>
                                )}
                              </span>
                              <span className="text-xs font-bold text-gray-900 truncate">
                                {c.conflict.replace(/\[(High|Medium)\]/, '').trim()}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-500 line-clamp-2">{c.description}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredConflicts.length > PAGE_SIZE && (
            <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
              <div>
                Showing <span className="font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
                <span className="font-bold">
                  {Math.min(currentPage * PAGE_SIZE, filteredConflicts.length)}
                </span>{' '}
                of <span className="font-bold">{filteredConflicts.length}</span> conflicts
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-bold text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Conflict Inspector Modal ("How it was detected") */}
        {selectedConflict && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setSelectedConflict(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  selectedConflict.status === 'SUCCEEDED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedConflict.rating === 'High' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedConflict.status === 'SUCCEEDED' ? '✓ Remediated (Succeeded)' : `${selectedConflict.ruleId} • ${selectedConflict.rating} Risk`}
                </span>

                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  selectedConflict.conflictType === 'INTRA_ROLE'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  {selectedConflict.conflictType === 'INTRA_ROLE' ? 'Intra-Role Conflict (Single Role)' : 'Inter-Role Conflict (Cross-Role)'}
                </span>

                <span className="text-xs text-gray-500 font-medium">Module: {selectedConflict.module}</span>
              </div>

              <h2 className="text-xl font-black text-gray-900 mb-1">
                {selectedConflict.conflict}
              </h2>
              <p className="text-xs text-gray-500 mb-6">User: <span className="font-bold text-gray-800">{selectedConflict.user}</span> ({selectedConflict.userName || selectedConflict.userEmail})</p>

              <div className="space-y-4 text-sm">
                {/* Detection Logic Flow */}
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600" />
                    How This Privilege Conflict Was Detected
                  </h4>
                  <p className="text-amber-950 font-medium text-xs leading-relaxed mb-2">
                    {selectedConflict.howDetected}
                  </p>
                  <div className="text-[11px] text-amber-800 bg-white/70 p-2.5 rounded-lg border border-amber-200/60 font-mono break-all">
                    Evaluation Path: User ({selectedConflict.user}) → Roles → Privileges ({selectedConflict.oraclePrivilege1 || selectedConflict.privilegeCode1 || 'P1'} vs {selectedConflict.oraclePrivilege2 || selectedConflict.privilegeCode2 || 'P2'})
                  </div>
                </div>

                {/* Conflicting Duties Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-blue-800 uppercase">Privilege 1</span>
                      {selectedConflict.oraclePrivilege1 && (
                        <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-100/80 px-1.5 py-0.5 rounded border border-blue-200 truncate max-w-[200px]" title={selectedConflict.oraclePrivilege1}>
                          {selectedConflict.oraclePrivilege1}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-gray-900 mt-1">{selectedConflict.function1}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Granted via role: <span className="font-semibold text-gray-800">{selectedConflict.assignedRole1}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-700 uppercase">
                        {selectedConflict.status === 'SUCCEEDED' ? 'Privilege 2 (Revoked via Bot)' : 'Privilege 2 (Conflicting)'}
                      </span>
                      {selectedConflict.oraclePrivilege2 && (
                        <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-[200px]" title={selectedConflict.oraclePrivilege2}>
                          {selectedConflict.oraclePrivilege2}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-gray-900 mt-1">{selectedConflict.function2}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Granted via role: <span className="font-semibold text-gray-800">
                        {selectedConflict.conflictType === 'INTRA_ROLE' ? `Same Role (${selectedConflict.assignedRole1})` : selectedConflict.assignedRole2}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risk Description */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-1">SOX Compliance & Internal Control Risk</h4>
                  <p className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                    {selectedConflict.description}
                  </p>
                </div>

                {/* Remediation Status */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-1">Remediation Status</h4>
                  <div className={`flex items-center gap-2 p-3 rounded-xl font-medium text-xs ${
                    selectedConflict.status === 'SUCCEEDED'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border border-amber-200 text-amber-900'
                  }`}>
                    {selectedConflict.status === 'SUCCEEDED' ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <span>Succeeded: Conflicting role has been revoked from Oracle Cloud. Audit record preserved.</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={18} className="text-amber-600 shrink-0" />
                        <span>{selectedConflict.actionRequired}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedConflict(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Bot Execution Studio Modal */}
        <SodRemediationModal
          isOpen={Boolean(activeBotConflict)}
          conflict={activeBotConflict}
          onClose={() => {
            setActiveBotConflict(null)
            handleFetchConflicts(false)
          }}
          onSuccess={(remediatedId) => {
            setRemediatedIds(prev => new Set(prev).add(remediatedId))
          }}
        />

      </main>
    </div>
  )
}
