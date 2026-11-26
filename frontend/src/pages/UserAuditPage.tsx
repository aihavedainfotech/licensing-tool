import { useState, useEffect } from 'react'
import { 
  UserCheck, 
  History, 
  Search, 
  Download, 
  Calendar, 
  Mail, 
  User, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  ArrowLeft, 
  Server, 
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
  Eye,
  ExternalLink,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export interface RoleLoginSession {
  role: string
  loginTime: string
  logoutTime: string | null
  duration: string
  sessionType?: string
}

export interface RoleAuditItem {
  roleName: string
  lastLoginDate: string | null
  lastLogoutDate: string | null
  isMostRecent: boolean
  loginCount: number
  daysSinceLastLogin?: number | null
  isActive?: boolean
  activityStatus?: 'Yes' | 'No'
  activityReason?: string
  thresholdDays?: number
}

export interface EmployeeAuditRecord {
  id: string
  userLogin: string
  employeeName: string
  employeeEmail: string
  personNumber: string
  creationDate: string
  assignedRoles: string[]
  suspended: boolean
  lastLoginDate: string | null
  lastLogoutDate: string | null
  lastLoginRole?: string | null
  loginStatement?: string
  roleLoginSessions?: RoleLoginSession[]
  roleAuditList?: RoleAuditItem[]
  activeRolesCount?: number
  inactiveRolesCount?: number
  roleActivitySummary?: string
  thresholdDays?: number
  loginCount: number
  activityStatus: 'Yes' | 'No'
  activityReason: string
}

// Evaluate individual role activity against threshold time (in days)
export function evaluateRoleActivity(role: RoleAuditItem, threshold: number): {
  isActive: boolean
  status: 'Yes' | 'No'
  daysAgo: number | null
  reason: string
} {
  if (!role.lastLoginDate) {
    return {
      isActive: false,
      status: 'No',
      daysAgo: null,
      reason: 'Never logged in with this role'
    }
  }
  const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(role.lastLoginDate).getTime()) / 86400000))
  const isActive = daysAgo <= threshold
  return {
    isActive,
    status: isActive ? 'Yes' : 'No',
    daysAgo,
    reason: isActive 
      ? `Active (${daysAgo}d ago ≤ ${threshold}d threshold)` 
      : `Inactive (${daysAgo}d ago > ${threshold}d threshold)`
  }
}

// Evaluate all roles on an employee against threshold time
export function evaluateUserRoles(roles: RoleAuditItem[], threshold: number) {
  const evaluated = roles.map(r => {
    const act = evaluateRoleActivity(r, threshold)
    return {
      ...r,
      daysSinceLastLogin: act.daysAgo,
      isActive: act.isActive,
      activityStatus: act.status,
      activityReason: act.reason,
      thresholdDays: threshold
    }
  })
  const activeCount = evaluated.filter(r => r.isActive).length
  const inactiveCount = evaluated.length - activeCount
  return {
    evaluatedRoles: evaluated,
    activeCount,
    inactiveCount,
    summary: `${activeCount} of ${evaluated.length} Active (≤${threshold}d)`
  }
}

interface AuditStats {
  totalEmployees: number
  totalInstanceEmployees?: number
  activeUsers: number
  inactiveUsers: number
  activePercentage: number
  generatedAt: string
}

const SERVER_URL = 'http://localhost:3001'

export default function UserAuditPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [employees, setEmployees] = useState<EmployeeAuditRecord[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [dataSource, setDataSource] = useState<string>('')
  const [instanceHost, setInstanceHost] = useState<string>('fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com')
  const [error, setError] = useState<string | null>(null)
  const [selectedSessionUser, setSelectedSessionUser] = useState<EmployeeAuditRecord | null>(null)
  const [modalTab, setModalTab] = useState<'roles' | 'sessions'>('roles')
  const [modalRoleSearch, setModalRoleSearch] = useState<string>('')
  const [modalRoleFilter, setModalRoleFilter] = useState<'all' | 'active' | 'never'>('all')
  const [thresholdDays, setThresholdDays] = useState<number>(90)

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)
  const [totalInstanceUsers, setTotalInstanceUsers] = useState<number>(6321)
  const [jumpPageInput, setJumpPageInput] = useState<string>('')

  // Filters & Search
  type SortOption = 'name_asc' | 'name_desc' | 'creation_desc' | 'creation_asc' | 'active_first' | 'inactive_first'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Yes' | 'No'>('All')
  const [sortBy, setSortBy] = useState<SortOption>('name_asc')
  const [exportingCsv, setExportingCsv] = useState(false)

  // Check config on mount
  useEffect(() => {
    fetch(`${SERVER_URL}/api/user-audit/config`)
      .then(res => res.json())
      .then(cfg => {
        if (cfg.host) setInstanceHost(cfg.host)
      })
      .catch(() => {})
  }, [])

  // Auto-fetch full authoritative assigned roles for selected user popup
  useEffect(() => {
    if (!selectedSessionUser) return
    let isMounted = true
    const uname = selectedSessionUser.userLogin

    fetch(`${SERVER_URL}/api/user-audit/user/${encodeURIComponent(uname)}/roles?threshold=${thresholdDays}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted || !data || !Array.isArray(data.assignedRoles)) return
        setSelectedSessionUser(prev => {
          if (!prev || prev.userLogin !== uname) return prev
          return {
            ...prev,
            assignedRoles: data.assignedRoles,
            roleAuditList: data.roleAuditList,
            roleLoginSessions: data.roleLoginSessions || prev.roleLoginSessions,
            activeRolesCount: data.activeRolesCount,
            inactiveRolesCount: data.inactiveRolesCount,
            roleActivitySummary: data.roleActivitySummary,
            lastLoginRole: data.lastLoginRole || prev.lastLoginRole
          }
        })

        // Also update in parent table employees list
        setEmployees(prevList => prevList.map(e => {
          if (e.userLogin === uname) {
            return {
              ...e,
              assignedRoles: data.assignedRoles,
              roleAuditList: data.roleAuditList,
              roleLoginSessions: data.roleLoginSessions || e.roleLoginSessions,
              activeRolesCount: data.activeRolesCount,
              inactiveRolesCount: data.inactiveRolesCount,
              roleActivitySummary: data.roleActivitySummary,
              lastLoginRole: data.lastLoginRole || e.lastLoginRole
            }
          }
          return e
        }))
      })
      .catch(err => {
        console.warn('Failed to fetch full user roles:', err)
      })

    return () => {
      isMounted = false
    }
  }, [selectedSessionUser?.userLogin, thresholdDays])

  async function handleLiveSync() {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${SERVER_URL}/api/user-audit/sync-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threshold: thresholdDays,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
          search: searchQuery.trim(),
          sortBy
        })
      })
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({ error: 'Live sync failed' }))
        throw new Error(errJson.error || `Sync error ${resp.status}`)
      }
      const result = await resp.json()
      setEmployees(result.employees || [])
      setStats(result.stats || null)
      if (result.pagination?.total !== undefined) {
        setTotalInstanceUsers(result.pagination.total)
      } else if (result.stats?.totalInstanceEmployees) {
        setTotalInstanceUsers(result.stats.totalInstanceEmployees)
      }
      setDataSource(result.source || 'oracle_cloud_live_sync')
      if (result.instance?.host) setInstanceHost(result.instance.host)
      setDataLoaded(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sync live with Oracle Cloud'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleFetchAudit(
    force = false, 
    page = currentPage, 
    size = pageSize, 
    threshold = thresholdDays,
    search = searchQuery,
    sort = sortBy
  ) {
    setLoading(true)
    setError(null)
    const offset = (page - 1) * size
    try {
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''
      const sortParam = `&sortBy=${encodeURIComponent(sort)}`
      const resp = await fetch(`${SERVER_URL}/api/user-audit/history?limit=${size}&offset=${offset}&threshold=${threshold}${searchParam}${sortParam}${force ? '&fresh=true' : ''}`)
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({ error: 'Failed to fetch audit history' }))
        throw new Error(errJson.error || `Server responded with ${resp.status}`)
      }
      const result = await resp.json()
      setEmployees(result.employees || [])
      setStats(result.stats || null)
      if (result.pagination?.total !== undefined) {
        setTotalInstanceUsers(result.pagination.total)
      } else if (result.stats?.totalInstanceEmployees) {
        setTotalInstanceUsers(result.stats.totalInstanceEmployees)
      }
      setDataSource(result.source || 'oracle_demo_instance')
      if (result.instance?.host) setInstanceHost(result.instance.host)
      setCurrentPage(page)
      setDataLoaded(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query Oracle Demo instance audit'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Trigger global search across all users with debounce
  useEffect(() => {
    if (!dataLoaded) return
    const timer = setTimeout(() => {
      handleFetchAudit(false, 1, pageSize, thresholdDays, searchQuery, sortBy)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  function handleSortChange(newSort: SortOption) {
    setSortBy(newSort)
    handleFetchAudit(false, 1, pageSize, thresholdDays, searchQuery, newSort)
  }

  const totalPages = Math.max(1, Math.ceil(totalInstanceUsers / pageSize))

  function onPageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return
    handleFetchAudit(false, newPage, pageSize)
  }

  function onPageSizeChange(newSize: number) {
    setPageSize(newSize)
    handleFetchAudit(false, 1, newSize)
  }

  function handleJumpPage(e: React.FormEvent) {
    e.preventDefault()
    const p = parseInt(jumpPageInput, 10)
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p)
      setJumpPageInput('')
    }
  }

  function getPageNumbers(current: number, total: number) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total]
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
    }
    return [1, '...', current - 1, current, current + 1, '...', total]
  }

  // Formatting helpers
  function formatDate(isoStr?: string | null) {
    if (!isoStr) return 'N/A'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return isoStr
    }
  }

  function formatDateTime(isoStr?: string | null) {
    if (!isoStr) return 'No recorded session'
    try {
      const d = new Date(isoStr)
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return isoStr
    }
  }

  function getRelativeTime(isoStr?: string | null) {
    if (!isoStr) return 'Never'
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays <= 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 30) return `${diffDays} days ago`
      const diffMonths = Math.floor(diffDays / 30)
      if (diffMonths < 12) return `${diffMonths} mo ago`
      return `${Math.floor(diffDays / 365)} yr ago`
    } catch {
      return ''
    }
  }

  // Filter & sort logic
  const filteredEmployees = employees
    .filter(emp => {
      if (statusFilter !== 'All' && emp.activityStatus !== statusFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const matchName = emp.employeeName.toLowerCase().includes(q)
      const matchEmail = emp.employeeEmail.toLowerCase().includes(q)
      const matchLogin = emp.userLogin.toLowerCase().includes(q)
      const matchRoles = emp.assignedRoles.some(r => r.toLowerCase().includes(q))
      return matchName || matchEmail || matchLogin || matchRoles
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.employeeName || '').localeCompare(b.employeeName || '')
      }
      if (sortBy === 'name_desc') {
        return (b.employeeName || '').localeCompare(a.employeeName || '')
      }
      if (sortBy === 'creation_asc') {
        return new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime()
      }
      if (sortBy === 'creation_desc') {
        return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
      }
      if (sortBy === 'active_first') {
        return (b.activityStatus === 'Yes' ? 1 : 0) - (a.activityStatus === 'Yes' ? 1 : 0)
      }
      if (sortBy === 'inactive_first') {
        return (a.activityStatus === 'Yes' ? 1 : 0) - (b.activityStatus === 'Yes' ? 1 : 0)
      }
      return (a.employeeName || '').localeCompare(b.employeeName || '')
    })

  // Export ALL users to CSV (Entire dataset across all pages)
  async function handleExportCsv() {
    setExportingCsv(true)
    try {
      const searchParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : ''
      const sortParam = `&sortBy=${encodeURIComponent(sortBy)}`
      const statusParam = statusFilter !== 'All' ? `&status=${statusFilter}` : ''
      const url = `${SERVER_URL}/api/user-audit/export-csv?threshold=${thresholdDays}${searchParam}${sortParam}${statusParam}`

      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`Export failed: ${resp.statusText}`)
      }
      const blob = await resp.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.setAttribute('download', `Oracle_User_Audit_All_Users_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.warn('Backend full CSV export failed, falling back to client-side page export:', err)
      if (!employees.length) return
      const headers = [
        'Employee Name', 
        'Username', 
        'Email', 
        'Person Number',
        'Creation Date', 
        'Assigned Roles', 
        'Per-Role Login Timestamps',
        'Last Logged-In Role',
        'Last Login Timestamp', 
        'Last Logout Timestamp', 
        'Login Statement',
        'Activity Status', 
        'Total Logins', 
        'Activity Reason'
      ]
      const rows = filteredEmployees.map(e => [
        `"${e.employeeName.replace(/"/g, '""')}"`,
        `"${e.userLogin}"`,
        `"${e.employeeEmail}"`,
        `"${e.personNumber || 'N/A'}"`,
        `"${e.creationDate}"`,
        `"${e.assignedRoles.join('; ').replace(/"/g, '""')}"`,
        `"${(e.roleAuditList && e.roleAuditList.length > 0 ? e.roleAuditList.map(r => `${r.roleName}: ${r.lastLoginDate ? formatDateTime(r.lastLoginDate) : 'Never'}`).join('; ') : e.assignedRoles.join('; ')).replace(/"/g, '""')}"`,
        `"${(e.lastLoginRole || e.assignedRoles[0] || 'N/A').replace(/"/g, '""')}"`,
        `"${e.lastLoginDate || 'Never'}"`,
        `"${e.lastLogoutDate || 'N/A'}"`,
        `"${(e.loginStatement || 'N/A').replace(/"/g, '""')}"`,
        `"${e.activityStatus}"`,
        `"${e.loginCount}"`,
        `"${(e.activityReason || '').replace(/"/g, '""')}"`
      ])

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Oracle_User_Audit_History_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setExportingCsv(false)
    }
  }

  // Export single user's roles audit to CSV
  function handleExportUserRolesCsv(user: EmployeeAuditRecord) {
    const roleList: RoleAuditItem[] = user.roleAuditList && user.roleAuditList.length > 0
      ? user.roleAuditList
      : user.assignedRoles.map((r, i) => ({
          roleName: r,
          lastLoginDate: i === 0 ? user.lastLoginDate : null,
          lastLogoutDate: i === 0 ? user.lastLogoutDate : null,
          isMostRecent: i === 0 && !!user.lastLoginDate,
          loginCount: i === 0 ? user.loginCount : 0
        }))

    const headers = ['Role Name', 'Is Latest Login', 'Last Login Timestamp', 'Last Logout Timestamp', 'Login Count', 'Status']
    const rows = roleList.map(r => [
      `"${r.roleName.replace(/"/g, '""')}"`,
      r.isMostRecent ? 'Yes' : 'No',
      `"${r.lastLoginDate || 'Never'}"`,
      `"${r.lastLogoutDate || 'N/A'}"`,
      r.loginCount,
      `"${r.lastLoginDate ? 'Historically Active' : 'Never Used'}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${user.userLogin}_Roles_Login_Audit_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen flex bg-white font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col px-4 sm:px-10 py-8 max-w-[1440px] mx-auto w-full overflow-y-auto" style={{ backgroundColor: 'var(--bg, #F4F6FA)' }}>
        
        {/* Navigation Breadcrumb & Back */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--mut, #586377)' }}>
            <button onClick={() => navigate('/upload')} className="hover:underline flex items-center gap-1" style={{ color: 'var(--acc, #1D4ED8)' }}>
              <ArrowLeft size={14} />
              Uploads
            </button>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--ink, #0F1B2D)' }}>User Audit & Activity Intelligence</span>
          </div>

          {/* Demo Instance Connected Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold shadow-xs" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Server size={13} />
            <span>Connected: <strong>{instanceHost}</strong></span>
          </div>
        </div>

        {/* Page Hero Header */}
        <div className="bg-white rounded-3xl p-8 mb-8 shadow-xs border relative overflow-hidden" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-bold mb-3" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)' }}>
                <UserCheck size={14} strokeWidth={2.5} />
                Oracle Cloud HCM Audit Framework
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight" style={{ color: 'var(--ink, #0F1B2D)' }}>
                User Audit & Activity Intelligence
              </h1>
              <p className="text-[14px] mt-2 font-medium max-w-2xl leading-relaxed" style={{ color: 'var(--mut, #586377)' }}>
                Inspect provisioned employees and user accounts from Oracle Fusion Cloud, including account creation dates, official corporate emails, assigned privileges/roles, and past login & logout activity status.
              </p>
            </div>

            {/* Primary Action Button: "Live Sync with Oracle" */}
            <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLiveSync}
                  disabled={loading}
                  className="flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-[14px] font-bold text-white shadow-md transition-all duration-300 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  style={{ 
                    background: 'linear-gradient(135deg, var(--acc, #1D4ED8) 0%, var(--acct, #1B3FA8) 100%)',
                  }}
                  title="Query Oracle Cloud Demo Pod in Real Time"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Syncing with Oracle Cloud…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="text-amber-200" />
                      <span>{dataLoaded ? 'Live Sync (Now)' : 'Live Sync with Oracle'}</span>
                    </>
                  )}
                </button>

                {dataLoaded && (
                  <button
                    onClick={() => handleFetchAudit(false)}
                    disabled={loading}
                    className="p-3.5 rounded-2xl border border-[var(--line, #E1E6EE)] text-[var(--ink, #0F1B2D)] hover:bg-black/5 transition cursor-pointer"
                    title="Refresh current page view"
                  >
                    <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                  </button>
                )}
              </div>

              {dataLoaded && stats && (
                <div className="flex flex-col items-start md:items-end gap-0.5 text-[11px] font-medium" style={{ color: 'var(--mut, #586377)' }}>
                  <span className="flex items-center gap-1.5 font-bold text-[var(--acc, #1D4ED8)]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Real-Time Oracle Data</span>
                    <span>•</span>
                    <span>Synced at {new Date(stats.generatedAt).toLocaleTimeString()}</span>
                  </span>
                  <span>{stats.totalEmployees} employees audited in this view</span>
                </div>
              )}
            </div>
          </div>

          {/* Decorative Corner Glow */}
          <div className="absolute -right-16 -top-16 w-52 h-52 rounded-full pointer-events-none opacity-40 blur-2xl" style={{ background: 'var(--accbg, #E7EEFF)' }} />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl flex items-center gap-3 text-[14px] font-medium" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c' }}>
            <ShieldAlert size={20} className="shrink-0" />
            <div className="flex-1">
              <strong>Audit Query Notice:</strong> {error}
            </div>
            <button onClick={() => handleFetchAudit(true)} className="px-3 py-1 rounded-lg text-[12px] font-bold bg-white border border-red-200 hover:bg-red-50">
              Retry
            </button>
          </div>
        )}

        {/* State A: Before clicking "User Audit History" */}
        {!dataLoaded && !loading && (
          <div className="bg-white rounded-3xl p-12 text-center border shadow-xs max-w-2xl mx-auto my-6" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)' }}>
              <History size={32} strokeWidth={2.2} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--ink, #0F1B2D)' }}>Ready to Run User Audit</h3>
            <p className="text-[14px] font-medium leading-relaxed max-w-md mx-auto mb-6" style={{ color: 'var(--mut, #586377)' }}>
              Click the <strong style={{ color: 'var(--acc, #1D4ED8)' }}>Live Sync with Oracle Cloud</strong> button to automatically retrieve live employee accounts, creation timestamps, real provisioned roles, and threshold-evaluated activity status.
            </p>
            <button
              onClick={handleLiveSync}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-[14px] text-white shadow-sm transition-all hover:shadow-md cursor-pointer"
              style={{ background: 'var(--acc, #1D4ED8)' }}
            >
              <Sparkles size={16} />
              <span>Live Sync with Oracle Cloud</span>
            </button>
          </div>
        )}

        {/* State B: Loading Skeleton */}
        {loading && (
          <div className="bg-white rounded-3xl p-10 border shadow-xs text-center" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
            <div className="inline-block p-4 rounded-2xl mb-4 animate-spin" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acc, #1D4ED8)' }}>
              <RefreshCw size={28} />
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--ink, #0F1B2D)' }}>Accessing Oracle Cloud Demo Instance</h3>
            <p className="text-[13px] font-medium" style={{ color: 'var(--mut, #586377)' }}>
              Querying <code>/hcmRestApi/resources/11.13.18.05/userAccounts</code> &amp; login logs…
            </p>
          </div>
        )}

        {/* State C: Data Loaded & Rendered */}
        {dataLoaded && !loading && (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Card 1: Total Users */}
              <div className="bg-white rounded-2xl p-5 border shadow-xs" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--mut, #586377)' }}>Total In Demo Pod</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acc, #1D4ED8)' }}>
                    <User size={16} />
                  </div>
                </div>
                <div className="text-2xl font-black" style={{ color: 'var(--ink, #0F1B2D)' }}>
                  {(stats?.totalInstanceEmployees || 6281).toLocaleString()}
                </div>
                <div className="text-[11px] font-medium mt-1" style={{ color: 'var(--mut, #586377)' }}>
                  Auditing latest {employees.length} provisioned accounts
                </div>
              </div>

              {/* Card 2: Active (Yes) */}
              <div className="bg-white rounded-2xl p-5 border shadow-xs" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#16a34a' }}>Active Status: YES</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-600">{stats?.activeUsers || 0}</div>
                <div className="text-[11px] font-medium mt-1 text-emerald-700/80">
                  {stats?.activePercentage || 0}% logged in within active window
                </div>
              </div>

              {/* Card 3: Inactive (No) */}
              <div className="bg-white rounded-2xl p-5 border shadow-xs" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#d97706' }}>Active Status: NO</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-600">{stats?.inactiveUsers || 0}</div>
                <div className="text-[11px] font-medium mt-1 text-amber-700/80">
                  Dormant users (&gt; 90 days or no session)
                </div>
              </div>

              {/* Card 4: License Optimization */}
              <div className="bg-white rounded-2xl p-5 border shadow-xs" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--acc, #1D4ED8)' }}>License Reclamation</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acct, #1B3FA8)' }}>
                    <Sparkles size={16} />
                  </div>
                </div>
                <div className="text-2xl font-black" style={{ color: 'var(--acc, #1D4ED8)' }}>
                  {stats?.inactiveUsers || 0} Seats
                </div>
                <div className="text-[11px] font-medium mt-1" style={{ color: 'var(--mut, #586377)' }}>Eligible for deprovisioning</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-2xl p-4 mb-3 border shadow-xs flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Search Input (Searches entire user base globally) */}
                <div className="relative flex-1 sm:w-88">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search all users across entire instance…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl text-[13px] font-medium border outline-none transition-all focus:border-[var(--acc, #1D4ED8)]"
                    style={{ borderColor: 'var(--line, #E1E6EE)', backgroundColor: 'var(--bg, #F4F6FA)', color: 'var(--ink, #0F1B2D)' }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        handleFetchAudit(false, 1, pageSize, thresholdDays, '', sortBy)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 cursor-pointer"
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Status Filter Buttons */}
                <div className="flex items-center p-1 rounded-xl" style={{ background: 'var(--accbg, #E7EEFF)' }}>
                  {(['All', 'Yes', 'No'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                        statusFilter === status 
                          ? 'bg-white shadow-xs text-[var(--acc, #1D4ED8)]' 
                          : 'text-[var(--mut, #586377)] hover:text-[var(--ink, #0F1B2D)]'
                      }`}
                    >
                      {status === 'All' ? 'All Users' : `Status: ${status}`}
                    </button>
                  ))}
                </div>

                {/* Role Activity Threshold Time Selector */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--line, #E1E6EE)] bg-[var(--bg, #F4F6FA)]">
                  <Clock size={13} className="text-[var(--acc, #1D4ED8)] shrink-0" />
                  <span className="text-[11px] font-bold text-[var(--mut, #586377)] uppercase tracking-wider shrink-0">
                    Threshold:
                  </span>
                  <select
                    value={thresholdDays}
                    onChange={e => {
                      const newTh = parseInt(e.target.value, 10);
                      setThresholdDays(newTh);
                      handleFetchAudit(false, currentPage, pageSize, newTh);
                    }}
                    className="text-xs font-bold bg-transparent outline-none text-[var(--acc, #1D4ED8)] cursor-pointer"
                    title="Threshold time to determine if a user has been active under a role"
                  >
                    <option value={30}>30 Days (Strict)</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days (Enterprise Standard)</option>
                    <option value={120}>120 Days</option>
                    <option value={180}>180 Days (Half Year)</option>
                    <option value={365}>365 Days (1 Year)</option>
                  </select>
                </div>
              </div>

              {/* Sort & Export CSV */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center gap-1 text-[12px] font-bold" style={{ color: 'var(--mut, #586377)' }}>
                  <span>Sort:</span>
                  <select
                    value={sortBy}
                    onChange={e => handleSortChange(e.target.value as any)}
                    className="px-3 py-2 rounded-xl text-[12px] font-bold border outline-none bg-white cursor-pointer"
                    style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
                  >
                    <option value="name_asc">Name: A to Z (Alphabetical)</option>
                    <option value="name_desc">Name: Z to A</option>
                    <option value="creation_desc">Creation Date: Newest First</option>
                    <option value="creation_asc">Creation Date: Oldest First</option>
                    <option value="active_first">Activity: Active First</option>
                    <option value="inactive_first">Activity: Inactive First</option>
                  </select>
                </div>

                <button
                  onClick={handleExportCsv}
                  disabled={exportingCsv}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border transition-colors hover:bg-black/5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
                  title="Export all users across the entire dataset to CSV"
                >
                  {exportingCsv ? <RefreshCw size={14} className="animate-spin text-[var(--acc, #1D4ED8)]" /> : <Download size={14} />}
                  <span>{exportingCsv ? 'Exporting All Users…' : 'Export Full CSV (All Users)'}</span>
                </button>
              </div>
            </div>

            {/* Global Search Status Banner */}
            {searchQuery.trim() && (
              <div className="mb-4 px-4 py-2.5 rounded-2xl flex items-center justify-between text-[12px] font-semibold" style={{ background: 'var(--accbg, #E7EEFF)', border: '1px solid #fbdac4', color: 'var(--acc, #1D4ED8)' }}>
                <div className="flex items-center gap-2">
                  <Search size={14} />
                  <span>Searching entire instance for &ldquo;<strong>{searchQuery}</strong>&rdquo; &bull; <strong>{totalInstanceUsers}</strong> {totalInstanceUsers === 1 ? 'user' : 'users'} found across all pages</span>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    handleFetchAudit(false, 1, pageSize, thresholdDays, '', sortBy)
                  }}
                  className="text-[11px] underline font-bold cursor-pointer hover:opacity-80"
                >
                  Clear Search
                </button>
              </div>
            )}

            {/* User Audit History Table */}
            <div className="bg-white rounded-3xl border shadow-xs overflow-hidden" style={{ borderColor: 'var(--line, #E1E6EE)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[12px] font-black uppercase tracking-wider" style={{ background: '#fdfbf9', color: 'var(--mut, #586377)', borderBottom: '1px solid var(--line, #E1E6EE)' }}>
                      <th 
                        onClick={() => handleSortChange(sortBy === 'creation_desc' ? 'creation_asc' : 'creation_desc')}
                        className="py-4 px-6 cursor-pointer select-none hover:text-[var(--acc, #1D4ED8)] transition-colors"
                        title="Click to sort by Creation Date"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Employee Creation Date</span>
                          {sortBy === 'creation_desc' ? <ArrowDown size={14} className="text-[var(--acc, #1D4ED8)]" /> : sortBy === 'creation_asc' ? <ArrowUp size={14} className="text-[var(--acc, #1D4ED8)]" /> : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortChange(sortBy === 'name_asc' ? 'name_desc' : 'name_asc')}
                        className="py-4 px-6 cursor-pointer select-none hover:text-[var(--acc, #1D4ED8)] transition-colors"
                        title="Click to sort by Employee Name"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Employee Name &amp; Mail</span>
                          {sortBy === 'name_asc' ? <ArrowUp size={14} className="text-[var(--acc, #1D4ED8)]" /> : sortBy === 'name_desc' ? <ArrowDown size={14} className="text-[var(--acc, #1D4ED8)]" /> : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                      <th className="py-4 px-6">Assigned Roles &amp; Activity</th>
                      <th className="py-4 px-6">Role Last Login &amp; Activity Status</th>
                      <th 
                        onClick={() => handleSortChange(sortBy === 'active_first' ? 'inactive_first' : 'active_first')}
                        className="py-4 px-4 text-center cursor-pointer select-none hover:text-[var(--acc, #1D4ED8)] transition-colors"
                        title="Click to sort by Activity Status"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Active (≤{thresholdDays}d)</span>
                          {sortBy === 'active_first' ? <ArrowDown size={14} className="text-[var(--acc, #1D4ED8)]" /> : sortBy === 'inactive_first' ? <ArrowUp size={14} className="text-[var(--acc, #1D4ED8)]" /> : <ArrowUpDown size={13} className="opacity-40" />}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line, #E1E6EE)] text-[13px]">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--mut, #586377)] font-medium">
                          No employee records match the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const initials = emp.employeeName
                          .split(' ')
                          .map(p => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()

                        const roleList: RoleAuditItem[] = emp.roleAuditList && emp.roleAuditList.length > 0
                          ? emp.roleAuditList
                          : emp.assignedRoles.map((r, i) => ({
                              roleName: r,
                              lastLoginDate: i === 0 ? emp.lastLoginDate : null,
                              lastLogoutDate: i === 0 ? emp.lastLogoutDate : null,
                              isMostRecent: i === 0 && !!emp.lastLoginDate,
                              loginCount: i === 0 ? emp.loginCount : 0
                            }))

                        const roleEvaluation = evaluateUserRoles(roleList, thresholdDays)
                        const isUserActiveUnderThreshold = roleEvaluation.activeCount > 0

                        return (
                          <tr key={emp.id} className="hover:bg-[var(--bg, #F4F6FA)]/60 transition-colors">
                            
                            {/* Column 1: Creation Date */}
                            <td className="py-4 px-6 whitespace-nowrap align-top">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acc, #1D4ED8)' }}>
                                  <Calendar size={14} />
                                </div>
                                <div>
                                  <div className="font-bold" style={{ color: 'var(--ink, #0F1B2D)' }}>
                                    {formatDate(emp.creationDate)}
                                  </div>
                                  <div className="text-[11px] font-medium" style={{ color: 'var(--mut, #586377)' }}>
                                    {getRelativeTime(emp.creationDate)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Column 2: Employee Name & Mail */}
                            <td className="py-4 px-6 align-top">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0" style={{ background: 'var(--accbg, #E7EEFF)', color: 'var(--acc, #1D4ED8)' }}>
                                  {initials}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[14px]" style={{ color: 'var(--ink, #0F1B2D)' }}>
                                      {emp.employeeName}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                      {emp.userLogin}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[12px] font-medium text-[var(--mut, #586377)]">
                                    <Mail size={12} className="shrink-0 text-slate-400" />
                                    <a href={`mailto:${emp.employeeEmail}`} className="hover:underline hover:text-[var(--acc, #1D4ED8)]">
                                      {emp.employeeEmail}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Column 3: Assigned Roles & Activity Under Threshold (Click to Open Popup) */}
                            <td className="py-4 px-6 max-w-[280px] align-top">
                              <div 
                                onClick={() => { setSelectedSessionUser(emp); setModalTab('roles'); }}
                                className="group p-2.5 -m-1.5 rounded-2xl border border-transparent hover:border-amber-200 hover:bg-amber-50/40 transition-all cursor-pointer space-y-2"
                                title="Click to view all assigned roles and their threshold activity in popup"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#f3ede6] text-[#5e4b3e] border border-[#e5dcd3] group-hover:bg-amber-100 group-hover:text-amber-900 group-hover:border-amber-300 transition-colors">
                                    {emp.assignedRoles.length} Roles Assigned
                                  </span>
                                  <span className="text-[10px] font-bold text-[var(--acc, #1D4ED8)] flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <span>Popup</span>
                                    <ExternalLink size={10} />
                                  </span>
                                </div>

                                {/* Active vs Inactive Roles Pill under threshold */}
                                <div>
                                  {roleEvaluation.activeCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 size={10} className="text-emerald-600" />
                                      <span>{roleEvaluation.activeCount} Active</span>
                                      <span className="text-slate-400 font-normal">/</span>
                                      <span className="text-slate-600">{roleEvaluation.inactiveCount} Inactive (≤{thresholdDays}d)</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-200">
                                      <XCircle size={10} className="text-rose-600" />
                                      <span>All {roleList.length} Inactive (&gt;{thresholdDays}d)</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  {emp.assignedRoles.slice(0, 3).map((role, rIdx) => {
                                    const isLastUsed = emp.lastLoginRole && (role.toLowerCase() === emp.lastLoginRole.toLowerCase())
                                    return (
                                      <span 
                                        key={rIdx} 
                                        className={`px-2 py-0.5 rounded text-[11px] font-medium truncate max-w-[210px] ${
                                          isLastUsed 
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold' 
                                            : 'bg-[#f5ede5] text-[#4a392d]'
                                        }`} 
                                        title={role}
                                      >
                                        {role}
                                      </span>
                                    )
                                  })}
                                  {emp.assignedRoles.length > 3 && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--acc, #1D4ED8)]/10 text-[var(--acc, #1D4ED8)] border border-[var(--acc, #1D4ED8)]/20 group-hover:bg-[var(--acc, #1D4ED8)] group-hover:text-white transition-colors" title={`View remaining ${emp.assignedRoles.length - 3} roles`}>
                                      +{emp.assignedRoles.length - 3} more ↗
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Column 4: Role Last Login & Activity Status Against Threshold (Click to Open Popup) */}
                            <td className="py-4 px-6 min-w-[320px] align-top">
                              {(() => {
                                const primaryRoleItem = roleEvaluation.evaluatedRoles.find(r => r.isMostRecent) || roleEvaluation.evaluatedRoles[0] || {
                                  roleName: emp.lastLoginRole || emp.assignedRoles[0] || 'Employee',
                                  lastLoginDate: emp.lastLoginDate,
                                  lastLogoutDate: emp.lastLogoutDate,
                                  isMostRecent: true,
                                  loginCount: emp.loginCount,
                                  daysSinceLastLogin: null,
                                  isActive: false,
                                  activityStatus: 'No' as const,
                                  activityReason: 'Never logged in'
                                }

                                return (
                                  <div 
                                    onClick={() => { setSelectedSessionUser(emp); setModalTab('roles'); }}
                                    className="group p-3 rounded-2xl border border-[var(--line, #E1E6EE)] bg-white hover:border-[var(--acc, #1D4ED8)]/50 hover:shadow-xs transition-all cursor-pointer space-y-2"
                                    title="Click to view all role login times and sessions in popup"
                                  >
                                    {/* Role Header & Activity Status */}
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span 
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 truncate max-w-[180px]"
                                        title={primaryRoleItem.roleName}
                                      >
                                        <KeyRound size={10} className="text-amber-700 shrink-0" />
                                        <span className="truncate">{primaryRoleItem.roleName}</span>
                                      </span>

                                      {/* Role Active Status Pill Under Threshold */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {primaryRoleItem.isActive ? (
                                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Active Role (Yes)
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                            <XCircle size={10} /> Inactive Role (No)
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Primary Login Timestamp & Inactivity Context */}
                                    {primaryRoleItem.lastLoginDate ? (
                                      <div className="space-y-0.5 text-[11px]">
                                        <div className="flex items-center gap-1.5 text-[var(--ink, #0F1B2D)]">
                                          <Clock size={11} className="text-slate-400 shrink-0" />
                                          <span>
                                            Logged in on <strong>{formatDateTime(primaryRoleItem.lastLoginDate)}</strong>
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            ({getRelativeTime(primaryRoleItem.lastLoginDate)})
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-[var(--mut, #586377)] pt-0.5">
                                          <span>Logout: {primaryRoleItem.lastLogoutDate ? formatDateTime(primaryRoleItem.lastLogoutDate) : 'Active'}</span>
                                          <span className="font-semibold text-slate-600">
                                            {primaryRoleItem.daysSinceLastLogin !== null && primaryRoleItem.daysSinceLastLogin !== undefined 
                                              ? `${primaryRoleItem.daysSinceLastLogin}d ago (${primaryRoleItem.daysSinceLastLogin <= thresholdDays ? `≤${thresholdDays}d` : `>${thresholdDays}d`})` 
                                              : ''}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 italic">
                                        <XCircle size={11} className="text-slate-300 shrink-0" />
                                        <span>Never logged in under this role</span>
                                      </div>
                                    )}

                                    {/* Clickable Popup Action Button */}
                                    <div className="pt-2 border-t border-[#f2ede7] flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500 font-medium">
                                        {roleList.length} role{roleList.length > 1 ? 's' : ''} evaluated
                                      </span>
                                      <span className="font-bold text-[var(--acc, #1D4ED8)] group-hover:underline flex items-center gap-1">
                                        <Eye size={11} />
                                        <span>View All {roleList.length} Roles Activity Status ↗</span>
                                      </span>
                                    </div>
                                  </div>
                                )
                              })()}
                            </td>

                            {/* Column 5: Activity Status (Yes / No based on threshold) */}
                            <td className="py-4 px-4 text-center align-top">
                              <div className="flex flex-col items-center justify-center pt-2">
                                {isUserActiveUnderThreshold ? (
                                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                                    <CheckCircle2 size={15} className="text-emerald-600" strokeWidth={2.5} />
                                    <span>Yes</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
                                    <XCircle size={15} className="text-rose-600" strokeWidth={2.5} />
                                    <span>No</span>
                                  </div>
                                )}
                                <span className="text-[11px] font-medium mt-1 text-[#736356] text-center whitespace-nowrap">
                                  {roleEvaluation.summary}
                                </span>
                              </div>
                            </td>

                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Enhanced Pagination Controls Bar */}
              <div className="py-4 px-6 bg-[#fdfbf9] border-t border-[var(--line, #E1E6EE)] flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Left: Summary & Page Size Selector */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--mut, #586377)]">
                  <span>
                    Showing <strong className="text-[var(--ink, #0F1B2D)]">{Math.min((currentPage - 1) * pageSize + 1, totalInstanceUsers)}</strong> – <strong className="text-[var(--ink, #0F1B2D)]">{Math.min(currentPage * pageSize, totalInstanceUsers)}</strong> of <strong className="text-[var(--acc, #1D4ED8)]">{totalInstanceUsers.toLocaleString()}</strong> users
                  </span>
                  <span className="hidden sm:inline text-slate-300">•</span>
                  
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Page Size:</span>
                    <select
                      value={pageSize}
                      onChange={e => onPageSizeChange(Number(e.target.value))}
                      disabled={loading}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-[var(--line, #E1E6EE)] text-[var(--ink, #0F1B2D)] outline-none cursor-pointer focus:border-[var(--acc, #1D4ED8)]"
                    >
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                      <option value={200}>200 per page</option>
                    </select>
                  </div>
                </div>

                {/* Right: Page Navigation Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 justify-center">
                  {/* First Page */}
                  <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1 || loading}
                    className="p-1.5 px-2.5 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 flex items-center gap-1"
                    style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
                    title="First Page"
                  >
                    <ChevronsLeft size={14} />
                    <span className="hidden sm:inline">First</span>
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="p-1.5 px-2.5 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 flex items-center gap-1"
                    style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} />
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  {/* Dynamic Page Number Pills */}
                  <div className="flex items-center gap-1 mx-1">
                    {getPageNumbers(currentPage, totalPages).map((p, idx) => (
                      typeof p === 'number' ? (
                        <button
                          key={idx}
                          onClick={() => onPageChange(p)}
                          disabled={loading}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                            currentPage === p
                              ? 'bg-[var(--acc, #1D4ED8)] text-white shadow-xs'
                              : 'text-[var(--ink, #0F1B2D)] hover:bg-black/5 border border-[var(--line, #E1E6EE)]'
                          }`}
                        >
                          {p}
                        </button>
                      ) : (
                        <span key={idx} className="px-1 text-slate-400 font-bold text-xs select-none">…</span>
                      )
                    ))}
                  </div>

                  {/* Next Page */}
                  <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className="p-1.5 px-2.5 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 flex items-center gap-1"
                    style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
                    title="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight size={14} />
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage >= totalPages || loading}
                    className="p-1.5 px-2.5 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 flex items-center gap-1"
                    style={{ borderColor: 'var(--line, #E1E6EE)', color: 'var(--ink, #0F1B2D)' }}
                    title="Last Page"
                  >
                    <span className="hidden sm:inline">Last</span>
                    <ChevronsRight size={14} />
                  </button>

                  {/* Quick Jump Input */}
                  <form onSubmit={handleJumpPage} className="flex items-center gap-1 ml-2">
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      placeholder={`1-${totalPages}`}
                      value={jumpPageInput}
                      onChange={e => setJumpPageInput(e.target.value)}
                      disabled={loading}
                      className="w-16 px-2 py-1 text-xs rounded-lg border border-[var(--line, #E1E6EE)] text-center font-bold outline-none focus:border-[var(--acc, #1D4ED8)]"
                    />
                    <button
                      type="submit"
                      disabled={loading || !jumpPageInput}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-[var(--acc, #1D4ED8)] hover:bg-[var(--acc, #1D4ED8)]/90 disabled:opacity-40 cursor-pointer"
                    >
                      Go
                    </button>
                  </form>
                </div>

              </div>

              {/* Pod metadata footer */}
              <div className="py-2.5 px-6 bg-[#f7f4ef] border-t border-[var(--line, #E1E6EE)] flex items-center justify-between text-[11px] font-semibold text-[var(--mut, #586377)]">
                <span>Page {currentPage} of {totalPages} ({employees.length} users loaded this slice)</span>
                <span>Oracle Cloud Demo Pod: <strong className="text-gray-700">{instanceHost}</strong> • {dataSource}</span>
              </div>
            </div>
          </>
        )}

        {/* Modal: Detailed Role Login Sessions & All Roles Audit Popup */}
        {selectedSessionUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between" style={{ background: '#fdfbf9' }}>
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm shrink-0" style={{ background: 'linear-gradient(135deg, var(--acc, #1D4ED8), var(--acc, #1D4ED8))' }}>
                    {selectedSessionUser.employeeName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        Oracle Cloud User Audit Profile
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                        {selectedSessionUser.userLogin}
                      </span>
                      {selectedSessionUser.personNumber && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500">
                          ID: {selectedSessionUser.personNumber}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mt-1">
                      {selectedSessionUser.employeeName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                      <Mail size={12} className="text-gray-400" />
                      <a href={`mailto:${selectedSessionUser.employeeEmail}`} className="hover:underline hover:text-[var(--acc, #1D4ED8)]">
                        {selectedSessionUser.employeeEmail}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportUserRolesCsv(selectedSessionUser)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                    title="Export this user's roles & login history to CSV"
                  >
                    <Download size={13} />
                    <span className="hidden sm:inline">Export User CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSessionUser(null)
                      setModalRoleSearch('')
                      setModalRoleFilter('all')
                    }}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {(() => {
                  const allRoles: RoleAuditItem[] = selectedSessionUser.roleAuditList && selectedSessionUser.roleAuditList.length > 0
                    ? selectedSessionUser.roleAuditList
                    : selectedSessionUser.assignedRoles.map((r, i) => ({
                        roleName: r,
                        lastLoginDate: i === 0 ? selectedSessionUser.lastLoginDate : null,
                        lastLogoutDate: i === 0 ? selectedSessionUser.lastLogoutDate : null,
                        isMostRecent: i === 0 && !!selectedSessionUser.lastLoginDate,
                        loginCount: i === 0 ? selectedSessionUser.loginCount : 0
                      }))

                  const modalEvaluation = evaluateUserRoles(allRoles, thresholdDays)

                  return (
                    <>
                      {/* 4 Summary Metric Cards with Role Activity Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                            Active Roles (Yes)
                          </div>
                          <div className="text-xl font-black text-emerald-700 mt-0.5 flex items-center gap-1.5">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span>{modalEvaluation.activeCount} Roles</span>
                          </div>
                          <div className="text-[10px] text-emerald-600/80 font-medium mt-0.5">
                            Logged in within ≤{thresholdDays} days
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200">
                          <div className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                            Inactive Roles (No)
                          </div>
                          <div className="text-xl font-black text-rose-700 mt-0.5 flex items-center gap-1.5">
                            <XCircle size={16} className="text-rose-600" />
                            <span>{modalEvaluation.inactiveCount} Roles</span>
                          </div>
                          <div className="text-[10px] text-rose-600/80 font-medium mt-0.5">
                            Exceeded &gt;{thresholdDays}d or never used
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[var(--bg, #F4F6FA)] border border-[var(--line, #E1E6EE)]">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--mut, #586377)]">Threshold Window</div>
                          <div className="flex items-center gap-1 mt-1">
                            <select
                              value={thresholdDays}
                              onChange={e => {
                                const newTh = parseInt(e.target.value, 10)
                                setThresholdDays(newTh)
                              }}
                              className="text-xs font-black text-[var(--acc, #1D4ED8)] bg-white border border-[var(--acc, #1D4ED8)]/30 rounded-lg px-2 py-0.5 outline-none cursor-pointer"
                            >
                              <option value={30}>30 Days (Strict)</option>
                              <option value={60}>60 Days</option>
                              <option value={90}>90 Days (Standard)</option>
                              <option value={120}>120 Days</option>
                              <option value={180}>180 Days (Half Year)</option>
                              <option value={365}>365 Days (1 Year)</option>
                            </select>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Change to re-evaluate live</div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[var(--bg, #F4F6FA)] border border-[var(--line, #E1E6EE)]">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--mut, #586377)]">Latest Role Session</div>
                          <div className="text-xs font-bold text-[var(--acc, #1D4ED8)] mt-1 truncate" title={selectedSessionUser.lastLoginRole || selectedSessionUser.assignedRoles[0] || 'Employee'}>
                            {selectedSessionUser.lastLoginRole || selectedSessionUser.assignedRoles[0] || 'Employee'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                            {selectedSessionUser.loginCount} total logins
                          </div>
                        </div>
                      </div>

                      {/* Tabs & Search / Filter Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
                        {/* Tabs */}
                        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
                          <button
                            onClick={() => setModalTab('roles')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              modalTab === 'roles' 
                                ? 'bg-white text-gray-900 shadow-xs' 
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            <KeyRound size={13} className={modalTab === 'roles' ? 'text-[var(--acc, #1D4ED8)]' : 'text-gray-400'} />
                            <span>Role Activity Status (≤{thresholdDays}d)</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">
                              {allRoles.length}
                            </span>
                          </button>

                          <button
                            onClick={() => setModalTab('sessions')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              modalTab === 'sessions' 
                                ? 'bg-white text-gray-900 shadow-xs' 
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            <History size={13} className={modalTab === 'sessions' ? 'text-[var(--acc, #1D4ED8)]' : 'text-gray-400'} />
                            <span>Session Audit Trail</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 text-gray-700 font-bold">
                              {selectedSessionUser.roleLoginSessions?.length || 0}
                            </span>
                          </button>
                        </div>

                        {/* Search & Filter inside modal when on roles tab */}
                        {modalTab === 'roles' && (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Filter roles..."
                                value={modalRoleSearch}
                                onChange={e => setModalRoleSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium outline-none focus:border-[var(--acc, #1D4ED8)] w-40 sm:w-52"
                              />
                            </div>

                            <select
                              value={modalRoleFilter}
                              onChange={e => setModalRoleFilter(e.target.value as any)}
                              className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold outline-none cursor-pointer bg-white text-gray-700"
                            >
                              <option value="all">All Roles ({allRoles.length})</option>
                              <option value="active">Active: Yes ({modalEvaluation.activeCount})</option>
                              <option value="never">Inactive: No ({modalEvaluation.inactiveCount})</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* TAB 1: Roles Table with Activity Status Under Threshold Time */}
                      {modalTab === 'roles' && (() => {
                        const filteredRoles = modalEvaluation.evaluatedRoles.filter(r => {
                          const matchesSearch = !modalRoleSearch || r.roleName.toLowerCase().includes(modalRoleSearch.toLowerCase())
                          if (!matchesSearch) return false
                          if (modalRoleFilter === 'active') return r.isActive
                          if (modalRoleFilter === 'never') return !r.isActive
                          return true
                        })

                        return (
                          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="text-[11px] font-black uppercase tracking-wider bg-gray-50 text-gray-500 border-b border-gray-200">
                                  <th className="py-3 px-4">Assigned Role Name</th>
                                  <th className="py-3 px-4">Last Login Timestamp</th>
                                  <th className="py-3 px-4">Last Logout</th>
                                  <th className="py-3 px-3 text-center">Logins</th>
                                  <th className="py-3 px-4 text-center">Role Active (≤{thresholdDays}d)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 text-xs">
                                {filteredRoles.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                                      No roles match your search or filter.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredRoles.map((r, idx) => (
                                    <tr key={idx} className={`hover:bg-amber-50/40 transition-colors ${r.isMostRecent ? 'bg-amber-50/20' : ''}`}>
                                      
                                      {/* Role Name */}
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${r.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                                            <KeyRound size={13} />
                                          </div>
                                          <div>
                                            <div className="font-bold text-gray-900 flex items-center gap-2">
                                              <span>{r.roleName}</span>
                                              {r.isMostRecent && (
                                                <span className="px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                  Latest Login
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>

                                      {/* Last Login Timestamp */}
                                      <td className="py-3 px-4">
                                        {r.lastLoginDate ? (
                                          <div className="space-y-0.5">
                                            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                                              <Clock size={12} className="text-gray-400" />
                                              <span>{formatDateTime(r.lastLoginDate)}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-medium">
                                              {getRelativeTime(r.lastLoginDate)}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-gray-400 italic flex items-center gap-1.5">
                                            <XCircle size={13} className="text-gray-300" />
                                            <span>Never logged in</span>
                                          </div>
                                        )}
                                      </td>

                                      {/* Last Logout */}
                                      <td className="py-3 px-4 text-gray-600">
                                        {r.lastLogoutDate ? (
                                          <span>{formatDateTime(r.lastLogoutDate)}</span>
                                        ) : r.lastLoginDate ? (
                                          <span className="text-emerald-700 font-semibold">Active Session</span>
                                        ) : (
                                          <span className="text-gray-300">—</span>
                                        )}
                                      </td>

                                      {/* Login Count */}
                                      <td className="py-3 px-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.loginCount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-400'}`}>
                                          {r.loginCount}
                                        </span>
                                      </td>

                                      {/* Role Active Status Under Threshold Time */}
                                      <td className="py-3 px-4 text-center">
                                        {r.isActive ? (
                                          <div className="flex flex-col items-center">
                                            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                                              <CheckCircle2 size={12} /> Yes
                                            </span>
                                            <span className="text-[10px] text-emerald-700 font-semibold mt-1">
                                              Active ({r.daysSinceLastLogin}d ago ≤ {thresholdDays}d)
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center">
                                            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-2xs">
                                              <XCircle size={12} /> No
                                            </span>
                                            <span className="text-[10px] text-rose-700 font-semibold mt-1">
                                              {r.daysSinceLastLogin !== null && r.daysSinceLastLogin !== undefined 
                                                ? `Inactive (${r.daysSinceLastLogin}d ago > ${thresholdDays}d)` 
                                                : 'Never used'}
                                            </span>
                                          </div>
                                        )}
                                      </td>

                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )
                      })()}
                    </>
                  )
                })()}

                {/* TAB 2: Historical Session Audit Trail */}
                {modalTab === 'sessions' && (
                  <div className="space-y-3">
                    {selectedSessionUser.roleLoginSessions && selectedSessionUser.roleLoginSessions.length > 0 ? (
                      <div className="space-y-2.5">
                        {selectedSessionUser.roleLoginSessions.map((session, sIdx) => (
                          <div 
                            key={sIdx}
                            className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-amber-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5">
                                  <KeyRound size={12} className="text-amber-700" />
                                  {session.role}
                                </span>
                                <span className="text-[11px] text-gray-400 font-medium">
                                  {session.sessionType || 'Web Session'}
                                </span>
                              </div>

                              <div className="text-xs text-gray-700 flex items-center gap-1.5">
                                <Clock size={13} className="text-gray-400" />
                                <span>Logged in: <strong>{formatDateTime(session.loginTime)}</strong></span>
                                <span className="text-gray-400 text-[11px]">({getRelativeTime(session.loginTime)})</span>
                              </div>
                            </div>

                            <div className="text-right text-xs text-gray-500 shrink-0">
                              <div>Logout: <strong>{session.logoutTime ? formatDateTime(session.logoutTime) : 'Session Active'}</strong></div>
                              <div className="text-[11px] font-bold text-emerald-700 mt-1">
                                Duration: {session.duration}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-gray-400">
                        No historical multi-session logs recorded for this account.
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50/80 flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-medium">
                  Audited against Oracle Cloud Instance: <strong className="text-gray-700">{instanceHost}</strong>
                </span>
                <button
                  onClick={() => {
                    setSelectedSessionUser(null)
                    setModalRoleSearch('')
                    setModalRoleFilter('all')
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black transition cursor-pointer shadow-xs"
                >
                  Close Window
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  )
}
