export interface Employee {
  id: string
  name: string
  email: string
  department: string
  status: 'active' | 'inactive' | 'on-leave'
  avatar: string
  assignedRole?: string
  previousRole?: string
  isRemediated?: boolean
}

export interface Role {
  id: string
  name: string
  employeeCount: number
  licenseUsed: number
  licenseTotal: number
  employees: Employee[]
  isRemediated?: boolean
  originalRoleName?: string
  remediationNote?: string
}

export interface Privilege {
  id: string
  name: string
  description: string
  costPerUser: number
  totalCost: number
  usageCount: number
  usageLimit: number
  risk: 'high' | 'medium' | 'low'
  roles: Role[]
}

export interface Service {
  id: string
  name: string
  sku?: string
  vendor: string
  icon: string
  color: string
  bgGradient: string
  totalCost: number
  licenseCount: number
  billableQuantity?: number
  billingUnits?: number
  minimumQuantity?: number
  metric?: string
  unitCost?: number
  overageCost?: number
  privilegeCount: number
  overProvisioned: number
  subscribedQuantity?: number
  privileges: Privilege[]
}

export interface ParseResult {
  services: Service[]
}
