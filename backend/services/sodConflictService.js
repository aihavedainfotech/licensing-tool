/**
 * SoD (Segregation of Duties) & Functional Conflict Detection Service
 *
 * Implements two-tier hierarchical privilege conflict detection:
 *  User -> Assigned Roles -> Granted Privileges
 *
 * Step 1 (Intra-Role / Toxic Role Check):
 *   Checks pairwise within each role to detect whether a single role inherently
 *   grants two conflicting privileges (e.g. AP04 Enter Invoice + AP05 Approve Invoice).
 *
 * Step 2 (Inter-Role / Cross-Role Check):
 *   If a privilege does not conflict within its own role, it is evaluated against
 *   all privileges granted by OTHER roles assigned to that user.
 */

const fs = require('fs');
const path = require('path');
const { fetchUserAuditHistory } = require('./oracleAuditService');

const RULES_PATH = path.join(__dirname, '..', 'config', 'sod_rules.json');
const REMEDIATIONS_PATH = path.join(__dirname, '..', 'config', 'sod_remediations.json');
const ORACLE_MAPPINGS_PATH = path.join(__dirname, '..', 'config', 'oracle_sod_mappings.json');

let cachedOracleMappings = null;
function loadOracleMappings() {
  if (cachedOracleMappings) return cachedOracleMappings;
  try {
    if (fs.existsSync(ORACLE_MAPPINGS_PATH)) {
      cachedOracleMappings = JSON.parse(fs.readFileSync(ORACLE_MAPPINGS_PATH, 'utf8'));
      return cachedOracleMappings;
    }
  } catch (err) {
    console.warn('[sodConflictService] Could not load oracle_sod_mappings.json:', err.message);
  }
  return { funcToPriv: {}, ruleToPriv: {}, functions: {} };
}

// ─── Standard Oracle Cloud Privilege Registry ─────────────────────────────────
const PRIVILEGES = {
  AP04: {
    code: 'AP04',
    name: 'Enter Supplier Invoices',
    oraclePrivileges: ['AP_MANAGE_PAYABLES_INVOICES_ACTIVITIES_PRIV', 'AP_MANAGE_PAYABLES_ACTIVITIES_PRIV'],
    oraclePrivilegeCode: 'AP_MANAGE_PAYABLES_INVOICES_ACTIVITIES_PRIV',
    description: 'Create and edit payables supplier invoices'
  },
  AP05: {
    code: 'AP05',
    name: 'Approve Supplier Invoices',
    oraclePrivileges: ['AP_MANAGE_PAYABLES_INVOICES_ACTIVITIES_PRIV', 'AP_MANAGE_PAYABLES_ACTIVITIES_PRIV'],
    oraclePrivilegeCode: 'AP_MANAGE_PAYABLES_INVOICES_ACTIVITIES_PRIV',
    description: 'Approve supplier invoices for payment authorization'
  },
  AP08: {
    code: 'AP08',
    name: 'Process Payment Runs / Execute Financial Operations',
    oraclePrivileges: ['AP_MANAGE_PAYABLES_ACTIVITIES_PRIV'],
    oraclePrivilegeCode: 'AP_MANAGE_PAYABLES_ACTIVITIES_PRIV',
    description: 'Execute payment disbursements and cash release batches'
  },
  GL02: {
    code: 'GL02',
    name: 'Create Journals',
    oraclePrivileges: ['GL_MANAGE_GENERAL_ACCOUNTING_ACTIVITIES_PRIV'],
    oraclePrivilegeCode: 'GL_MANAGE_GENERAL_ACCOUNTING_ACTIVITIES_PRIV',
    description: 'Draft and record General Ledger journal entries'
  },
  GL03: {
    code: 'GL03',
    name: 'Approve Journals',
    oraclePrivileges: ['GL_MANAGE_GENERAL_ACCOUNTING_ACTIVITIES_PRIV'],
    oraclePrivilegeCode: 'GL_MANAGE_GENERAL_ACCOUNTING_ACTIVITIES_PRIV',
    description: 'Approve General Ledger journals for ledger posting'
  },
  HR07: {
    code: 'HR07',
    name: 'Hire Workers',
    oraclePrivileges: ['PER_HIRE_EMPLOYEE_PRIV', 'PER_MANAGE_PERSON_WORK_RELATIONSHIP_PRIV'],
    oraclePrivilegeCode: 'PER_HIRE_EMPLOYEE_PRIV',
    description: 'Create personnel files and onboard new employees/contingent workers'
  },
  HR12: {
    code: 'HR12',
    name: 'Maintain Salaries',
    oraclePrivileges: ['CMP_MANAGE_SALARY_PRIV', 'CMP_ADMINISTER_COMPENSATION_PRIV'],
    oraclePrivilegeCode: 'CMP_MANAGE_SALARY_PRIV',
    description: 'Administer base pay rates, grade steps, and worker compensation'
  },
  HR13: {
    code: 'HR13',
    name: 'Approve Salary Changes',
    oraclePrivileges: ['CMP_APPROVE_SALARY_CHANGE_PRIV', 'CMP_AUTHORIZE_COMPENSATION_PRIV'],
    oraclePrivilegeCode: 'CMP_APPROVE_SALARY_CHANGE_PRIV',
    description: 'Authorize and sign off on salary adjustments and promotions'
  },
  HR18: {
    code: 'HR18',
    name: 'Enter Time Cards',
    oraclePrivileges: ['HWM_MANAGE_TIME_WORK_AREA_PRIV', 'HWM_TIME_MANAGEMENT_WORK_AREA_PRIV'],
    oraclePrivilegeCode: 'HWM_MANAGE_TIME_WORK_AREA_PRIV',
    description: 'Enter and submit daily work hours and project timecards'
  },
  HR19: {
    code: 'HR19',
    name: 'Approve Time Cards',
    oraclePrivileges: ['HWM_MANAGE_TIME_WORK_AREA_PRIV', 'HWM_TIME_MANAGEMENT_WORK_AREA_PRIV'],
    oraclePrivilegeCode: 'HWM_MANAGE_TIME_WORK_AREA_PRIV',
    description: 'Approve worker timecards for payroll and cost accounting'
  },
  HR22: {
    code: 'HR22',
    name: 'Calculate Payroll',
    oraclePrivileges: ['PAY_RUN_PAYROLL_CALCULATION_PRIV', 'PAY_PROCESS_PAYROLL_BATCH_PRIV'],
    oraclePrivilegeCode: 'PAY_RUN_PAYROLL_CALCULATION_PRIV',
    description: 'Calculate gross-to-net payroll runs and prepayment deductions'
  },
  HR23: {
    code: 'HR23',
    name: 'Verify / Approve Payroll Results',
    oraclePrivileges: ['PAY_APPROVE_PAYROLL_RESULTS_PRIV', 'PAY_SIGN_OFF_PAYROLL_PRIV'],
    oraclePrivilegeCode: 'PAY_APPROVE_PAYROLL_RESULTS_PRIV',
    description: 'Review, verify and finalize payroll batches for EFT disbursement'
  },
  PO03: {
    code: 'PO03',
    name: 'Create / Amend Purchase Orders',
    oraclePrivileges: ['PO_VIEW_PURCHASING_WORKAREA_PRIV'],
    oraclePrivilegeCode: 'PO_VIEW_PURCHASING_WORKAREA_PRIV',
    description: 'Create, amend, and issue purchase orders to approved suppliers'
  },
  PO04: {
    code: 'PO04',
    name: 'Approve Purchase Orders',
    oraclePrivileges: ['PO_APPROVE_PURCHASE_ORDER_PRIV', 'PO_AUTHORIZE_PO_PRIV'],
    oraclePrivilegeCode: 'PO_APPROVE_PURCHASE_ORDER_PRIV',
    description: 'Authorize purchase orders and commitments above approval limits'
  },
  RC01: {
    code: 'RC01',
    name: 'Receive Goods & Services',
    oraclePrivileges: ['RCV_RECEIVE_RECEIVING_SHIPMENT_LINE_PRIV', 'RCV_RECEIVE_GOODS_USING_RESPONSIVE_RECEIVING_PWA_PRIV'],
    oraclePrivilegeCode: 'RCV_RECEIVE_RECEIVING_SHIPMENT_LINE_PRIV',
    description: 'Record physical goods receipts and inspection delivery notes'
  },
  SY02: {
    code: 'SY02',
    name: 'Assign Roles to Users',
    oraclePrivileges: ['SVC_UPDATE_SELF_SERVICE_ROLE_PRIV', 'SVC_UPDATE_SELF_SERVICE_ROLE_USING_REST_PRIV'],
    oraclePrivilegeCode: 'SVC_UPDATE_SELF_SERVICE_ROLE_PRIV',
    description: 'Grant, revoke, and modify security roles and entitlements on user accounts'
  }
};

/**
 * Resolves the authoritative Oracle Cloud privilege code from the SoD Rule Library Excel mapping.
 */
function getOraclePrivilegeCode(functionId, ruleId = null, side = 'A') {
  const mappings = loadOracleMappings();
  let candidateList = [];

  // 1. If ruleId is supplied, check rule-specific privilege from the Conflict Rules sheet
  if (ruleId && mappings.ruleToPriv && mappings.ruleToPriv[ruleId]) {
    const r = mappings.ruleToPriv[ruleId];
    const privs = side === 'A' ? r.privilegesA : r.privilegesB;
    if (privs && privs.length > 0) {
      candidateList = privs;
    }
  }

  // 2. Check function-to-privilege mapping from Privilege Mapping sheet
  if (candidateList.length === 0 && mappings.funcToPriv && mappings.funcToPriv[functionId]) {
    const p = mappings.funcToPriv[functionId];
    if (p.privilegeCodes && p.privilegeCodes.length > 0) {
      candidateList = p.privilegeCodes;
    }
  }

  if (candidateList.length > 0) {
    // Prefer more specific privilege code if multiple are mapped
    if (functionId === 'AP04' || functionId === 'AP05') {
      const invPriv = candidateList.find(p => p.includes('INVOICES'));
      if (invPriv) return invPriv;
    }
    if (functionId === 'SY02') {
      const rolePriv = candidateList.find(p => p === 'SVC_UPDATE_SELF_SERVICE_ROLE_PRIV');
      if (rolePriv) return rolePriv;
    }
    return candidateList[0];
  }

  // 3. Fallback to PRIVILEGES dictionary
  if (PRIVILEGES[functionId]) {
    return PRIVILEGES[functionId].oraclePrivilegeCode || PRIVILEGES[functionId].oraclePrivileges?.[0] || functionId;
  }
  return functionId;
}

// ─── Master Oracle Role-to-Privilege Entitlement Catalog ───────────────────────
const ROLE_PRIVILEGE_MAPPING = {
  // Super User & System Implementation Roles (Inherently toxic multi-pillar roles)
  'Application Implementation Consultant': ['SY02', 'AP08', 'AP04', 'GL02', 'PO03'],
  'Asm Application Implementation Consultant': ['SY02', 'AP08', 'AP04', 'GL02', 'PO03'],
  'Application Implementation Manager': ['SY02', 'AP08', 'AP05', 'GL03', 'PO04'],
  'Asm Application Implementation Manager': ['SY02', 'AP08', 'AP05', 'GL03', 'PO04'],
  'Application Administrator': ['SY02', 'AP08'],
  'It Security Manager': ['SY02'],
  'Security Administrator': ['SY02'],

  // Payables
  'Accounts Payable Manager': ['AP04', 'AP05', 'AP08'],
  'Payables Manager': ['AP04', 'AP05', 'AP08'],
  'Accounts Payable Supervisor': ['AP04', 'AP05'],
  'Payables Specialist': ['AP04'],
  'Accounts Payable Specialist': ['AP04'],
  'Payables Invoice Specialist': ['AP04'],
  'Payables Approver': ['AP05'],
  'Financial Approver': ['AP05'],
  'Disbursement Officer': ['AP08'],
  'Cash Manager': ['AP08'],

  // General Ledger, Projects & Assets
  'General Accounting Manager': ['GL03'],
  'General Ledger Supervisor': ['GL02', 'GL03'],
  'General Accountant': ['GL02'],
  'Project Administrator': ['GL03'],
  'Pjf Project Administrator': ['GL03'],
  'Project Accountant': ['GL02'],
  'Pjf Project Accountant': ['GL02'],
  'Asset Accountant': ['GL02'],
  'Fa Asset Accountant': ['GL02'],
  'Cost Accountant': ['GL02'],
  'Cst Cost Accountant': ['GL02'],

  // HCM - Human Resources & Core Administration
  'Human Resource Specialist': ['HR07'],
  'Human Resource Analyst': ['HR07'],
  'Human Capital Management Application Administrator': ['HR07', 'SY02'],
  'Hcm Applic Admin - View All Data': ['HR07', 'SY02'],

  // HCM - Compensation & Benefits
  'Compensation Administrator': ['HR12'],
  'Compensation Analyst': ['HR12'],
  'Compensation Analyst - View All Data': ['HR12'],
  'Benefits Administrator - View All Data': ['HR12'],
  'Compensation Manager': ['HR13'],
  'Benefits Manager - View All Data': ['HR13'],
  'Compensation Director': ['HR12', 'HR13'],

  // HCM - Time & Labor
  'Time and Labor Administrator': ['HR18'],
  'Employee': ['HR18'],
  'Line Manager': ['HR19'],

  // HCM - Payroll
  'Payroll Administrator': ['HR22'],
  'Payroll Specialist': ['HR22'],
  'Payroll Manager': ['HR23'],
  'Payroll Director': ['HR23'],
  'Payroll Supervisor': ['HR22', 'HR23'],

  // SCM - Procurement & Receiving
  'Procurement Specialist': ['PO03'],
  'Buyer': ['PO03'],
  'Po Procurement Application Admin': ['PO03'],
  'Poz Supplier Manager': ['PO03'],
  'Procurement Manager': ['PO04'],
  'Purchasing Manager': ['PO04'],
  'Purchasing Director': ['PO03', 'PO04'],
  'Receiving Agent': ['RC01'],
  'Rcv Receiving Agent': ['RC01'],
  'Inv Warehouse Manager': ['RC01'],
  'Inv Inventory Manager': ['RC01']
};

/**
 * Resolves privileges granted by a role using dictionary lookup and fuzzy pattern heuristics
 */
function getPrivilegesForRole(roleName = '') {
  if (!roleName) return [];
  const clean = roleName.trim();

  // 1. Exact catalog match
  if (ROLE_PRIVILEGE_MAPPING[clean]) {
    return ROLE_PRIVILEGE_MAPPING[clean].map(code => PRIVILEGES[code]).filter(Boolean);
  }

  // 2. Case-insensitive catalog match
  const lower = clean.toLowerCase();
  for (const [key, codes] of Object.entries(ROLE_PRIVILEGE_MAPPING)) {
    if (key.toLowerCase() === lower) {
      return codes.map(code => PRIVILEGES[code]).filter(Boolean);
    }
  }

  // 3. Fallback semantic heuristics for custom / modified enterprise roles
  const matchedCodes = new Set();

  if (lower.includes('security manager') || lower.includes('security admin')) {
    matchedCodes.add('SY02');
  }
  if (lower.includes('implementation consultant') || lower.includes('implementation manager') || (lower.includes('application') && lower.includes('admin'))) {
    matchedCodes.add('SY02');
    matchedCodes.add('AP08');
  }
  if (lower.includes('payable') && (lower.includes('specialist') || lower.includes('clerk') || lower.includes('entry'))) {
    matchedCodes.add('AP04');
  }
  if (lower.includes('payable') && (lower.includes('approv') || lower.includes('supervisor'))) {
    matchedCodes.add('AP05');
  }
  if (lower.includes('payable') && lower.includes('manager')) {
    matchedCodes.add('AP04');
    matchedCodes.add('AP05');
    matchedCodes.add('AP08');
  }
  if (lower.includes('disbursement') || lower.includes('cash manager')) {
    matchedCodes.add('AP08');
  }
  if (lower.includes('accountant') || (lower.includes('journal') && lower.includes('entry'))) {
    matchedCodes.add('GL02');
  }
  if (lower.includes('accounting manager') || (lower.includes('project') && lower.includes('admin'))) {
    matchedCodes.add('GL03');
  }
  if (lower.includes('human resource') || lower.includes('hr specialist') || lower.includes('personnel')) {
    matchedCodes.add('HR07');
  }
  if (lower.includes('compensation') && (lower.includes('analyst') || lower.includes('admin'))) {
    matchedCodes.add('HR12');
  }
  if (lower.includes('compensation') && (lower.includes('manager') || lower.includes('approv') || lower.includes('director'))) {
    matchedCodes.add('HR13');
  }
  if (lower.includes('benefits admin')) {
    matchedCodes.add('HR12');
  }
  if (lower.includes('benefits manager')) {
    matchedCodes.add('HR13');
  }
  if (lower.includes('time') && (lower.includes('entry') || lower.includes('admin') || lower.includes('clerk'))) {
    matchedCodes.add('HR18');
  }
  if (lower.includes('line manager') || (lower.includes('time') && lower.includes('approv'))) {
    matchedCodes.add('HR19');
  }
  if (lower.includes('payroll') && (lower.includes('admin') || lower.includes('specialist') || lower.includes('calculat'))) {
    matchedCodes.add('HR22');
  }
  if (lower.includes('payroll') && (lower.includes('manager') || lower.includes('director') || lower.includes('approv'))) {
    matchedCodes.add('HR23');
  }
  if (lower.includes('buyer') || lower.includes('procurement specialist') || lower.includes('procurement admin')) {
    matchedCodes.add('PO03');
  }
  if (lower.includes('purchasing manager') || lower.includes('procurement manager')) {
    matchedCodes.add('PO04');
  }
  if (lower.includes('receiving') || lower.includes('warehouse') || lower.includes('inventory manager')) {
    matchedCodes.add('RC01');
  }
  if (lower === 'employee' || lower.includes('employee self service')) {
    matchedCodes.add('HR18');
  }

  return Array.from(matchedCodes).map(code => PRIVILEGES[code]).filter(Boolean);
}

/**
 * Load conflict rules from JSON configuration
 */
function loadSodRules() {
  try {
    if (fs.existsSync(RULES_PATH)) {
      const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
      return rules.map(r => {
        // Ensure privilege codes are extracted even if not explicitly stored
        const codeA = r.privilegeCodeA || (r.functionA.match(/\(([A-Z0-9]+)\)/) || [])[1] || 'AP04';
        const codeB = r.privilegeCodeB || (r.functionB.match(/\(([A-Z0-9]+)\)/) || [])[1] || 'AP05';
        return {
          ...r,
          privilegeCodeA: codeA,
          privilegeCodeB: codeB
        };
      });
    }
  } catch (err) {
    console.error('Failed to load SOD rules:', err.message);
  }
  return [];
}

/**
 * Load remediation audit registry (persisted history)
 */
function loadRemediations() {
  try {
    if (fs.existsSync(REMEDIATIONS_PATH)) {
      return JSON.parse(fs.readFileSync(REMEDIATIONS_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load remediations registry:', err.message);
  }
  return [];
}

/**
 * Record a successfully remediated conflict so it is never deleted from data
 */
function recordRemediation(entry) {
  try {
    const list = loadRemediations();
    const existingIndex = list.findIndex(r => r.id === entry.id || (r.user === entry.user && r.ruleId === entry.ruleId));

    const record = {
      ...entry,
      status: 'SUCCEEDED',
      remediatedAt: entry.remediatedAt || new Date().toISOString(),
      method: entry.method || 'Privilege Stripping (Role Engineering)'
    };

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...record };
    } else {
      list.push(record);
    }

    fs.writeFileSync(REMEDIATIONS_PATH, JSON.stringify(list, null, 2), 'utf8');
    return record;
  } catch (err) {
    console.error('Failed to save remediation entry:', err.message);
    return null;
  }
}

/**
 * Scan all Oracle users, identify functional conflicts using the two-tier privilege algorithm,
 * and merge remediation audit history.
 *
 * Hierarchy:
 *  User -> Assigned Roles -> Granted Privileges
 *   - Check 1 (Intra-Role): Privilege vs Privilege within the same role.
 *   - Check 2 (Inter-Role): If a privilege does not conflict within its role,
 *     evaluate against privileges of all OTHER assigned roles.
 */
async function detectFunctionalConflicts(options = {}) {
  const sodRules = loadSodRules();
  const remediations = loadRemediations();
  const remediatedMap = new Map();
  remediations.forEach(r => {
    if (r.id) remediatedMap.set(r.id, r);
    if (r.user && r.ruleId) remediatedMap.set(`${r.user}_${r.ruleId}`, r);
  });

  const auditResult = await fetchUserAuditHistory(options);
  const users = auditResult.employees || [];

  const conflicts = [];
  const processedConflictKeys = new Set();

  for (const user of users) {
    const userRoles = user.assignedRoles || [];
    if (userRoles.length === 0) continue;

    // Map each role assigned to this user to its granted privileges
    const rolePrivilegeMap = userRoles.map(role => ({
      role,
      privileges: getPrivilegesForRole(role)
    }));

    // Track which rules triggered an INTRA-ROLE conflict for each role
    const intraConflictRulesByRole = new Map(); // roleName -> Set of ruleIds
    const recordedPairKeys = new Set();

    // ──────────────────────────────────────────────────────────────────────────
    // TIER 1: INTRA-ROLE CONFLICT DETECTION (Within Each Assigned Role)
    // "checking 1 privilige with another privilige of that role for conflict affect"
    // ──────────────────────────────────────────────────────────────────────────
    for (const { role, privileges } of rolePrivilegeMap) {
      if (!privileges || privileges.length < 2) continue;
      const privCodeSet = new Set(privileges.map(p => p.code));

      for (const rule of sodRules) {
        const codeA = rule.privilegeCodeA;
        const codeB = rule.privilegeCodeB;

        // If the role grants BOTH conflicting privileges inherently:
        if (privCodeSet.has(codeA) && privCodeSet.has(codeB)) {
          const pObjA = privileges.find(p => p.code === codeA);
          const pObjB = privileges.find(p => p.code === codeB);

          const conflictId = `${user.userLogin}_${rule.ruleId}_INTRA_${role.replace(/[^a-zA-Z0-9]/g, '_')}`;
          processedConflictKeys.add(conflictId);
          processedConflictKeys.add(`${user.userLogin}_${rule.ruleId}`);
          const rem = remediatedMap.get(conflictId) || remediatedMap.get(`${user.userLogin}_${rule.ruleId}`);

          if (!intraConflictRulesByRole.has(role)) {
            intraConflictRulesByRole.set(role, new Set());
          }
          intraConflictRulesByRole.get(role).add(rule.ruleId);

          const oraclePriv1 = getOraclePrivilegeCode(codeA, rule.ruleId, 'A');
          const oraclePriv2 = getOraclePrivilegeCode(codeB, rule.ruleId, 'B');

          conflicts.push({
            id: conflictId,
            ruleId: rule.ruleId,
            module: rule.module || 'ERP',
            conflictType: 'INTRA_ROLE',
            conflictTypeLabel: 'Intra-Role (Same Role)',
            user: user.userLogin,
            userName: user.employeeName,
            userEmail: user.employeeEmail,
            assignedRole1: role,
            function1: pObjA ? `${pObjA.name} (${pObjA.code})` : rule.functionA,
            privilegeCode1: codeA,
            privilegeName1: pObjA?.name || codeA,
            oraclePrivilege1: oraclePriv1,
            assignedRole2: role, // Same role!
            function2: pObjB ? `${pObjB.name} (${pObjB.code})` : rule.functionB,
            privilegeCode2: codeB,
            privilegeName2: pObjB?.name || codeB,
            oraclePrivilege2: oraclePriv2,
            conflict: `${rule.name} [${rule.rating}]`,
            rating: rule.rating,
            description: rule.riskDescription,
            howDetected: `Intra-Role Conflict: The single role "${role}" inherently grants both conflicting privileges: "${pObjA?.name || codeA}" and "${pObjB?.name || codeB}".`,
            targetRoleToRevoke: role,
            actionRequired: `De-provision "${role}" or customize duty entitlements to remove "${pObjB?.name || codeB}".`,
            status: rem ? 'SUCCEEDED' : 'ACTIVE',
            isRemediated: Boolean(rem),
            remediatedAt: rem ? rem.remediatedAt : null
          });
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TIER 2: INTER-ROLE CONFLICT DETECTION (Across Different Assigned Roles)
    // "and also if that privilige does not have any effect with another priviliges of that role
    // we need to check the other priviliges of other roles..."
    // ──────────────────────────────────────────────────────────────────────────
    for (let i = 0; i < rolePrivilegeMap.length; i++) {
      const r1 = rolePrivilegeMap[i];
      const intraRules1 = intraConflictRulesByRole.get(r1.role) || new Set();

      for (let j = i + 1; j < rolePrivilegeMap.length; j++) {
        const r2 = rolePrivilegeMap[j];
        const intraRules2 = intraConflictRulesByRole.get(r2.role) || new Set();

        const privCodes1 = new Set(r1.privileges.map(p => p.code));
        const privCodes2 = new Set(r2.privileges.map(p => p.code));

        for (const rule of sodRules) {
          const codeA = rule.privilegeCodeA;
          const codeB = rule.privilegeCodeB;

          // Check if r1 has codeA and r2 has codeB, or r1 has codeB and r2 has codeA
          const matchForward = privCodes1.has(codeA) && privCodes2.has(codeB);
          const matchReverse = privCodes1.has(codeB) && privCodes2.has(codeA);

          if (matchForward || matchReverse) {
            // User requirement: If the privilege pair already caused an INTRA-ROLE conflict
            // within role 1 or within role 2, it already had an internal effect.
            // Only check across roles if not already satisfied internally within that single role!
            if (intraRules1.has(rule.ruleId) || intraRules2.has(rule.ruleId)) {
              continue;
            }

            const roleA = matchForward ? r1.role : r2.role;
            const roleB = matchForward ? r2.role : r1.role;
            const pObjA = (matchForward ? r1.privileges : r2.privileges).find(p => p.code === codeA);
            const pObjB = (matchForward ? r2.privileges : r1.privileges).find(p => p.code === codeB);

            const pairKey = `${rule.ruleId}_${roleA}_${roleB}`;
            if (recordedPairKeys.has(pairKey)) continue;
            recordedPairKeys.add(pairKey);

            const conflictId = `${user.userLogin}_${rule.ruleId}_INTER_${roleA.slice(0, 8)}_${roleB.slice(0, 8)}`.replace(/[^a-zA-Z0-9]/g, '_');
            processedConflictKeys.add(conflictId);
            processedConflictKeys.add(`${user.userLogin}_${rule.ruleId}`);
            const rem = remediatedMap.get(conflictId) || remediatedMap.get(`${user.userLogin}_${rule.ruleId}`);

            const oraclePriv1 = getOraclePrivilegeCode(codeA, rule.ruleId, 'A');
            const oraclePriv2 = getOraclePrivilegeCode(codeB, rule.ruleId, 'B');

            conflicts.push({
              id: conflictId,
              ruleId: rule.ruleId,
              module: rule.module || 'ERP',
              conflictType: 'INTER_ROLE',
              conflictTypeLabel: 'Inter-Role (Cross-Role)',
              user: user.userLogin,
              userName: user.employeeName,
              userEmail: user.employeeEmail,
              assignedRole1: roleA,
              function1: pObjA ? `${pObjA.name} (${pObjA.code})` : rule.functionA,
              privilegeCode1: codeA,
              privilegeName1: pObjA?.name || codeA,
              oraclePrivilege1: oraclePriv1,
              assignedRole2: roleB,
              function2: pObjB ? `${pObjB.name} (${pObjB.code})` : rule.functionB,
              privilegeCode2: codeB,
              privilegeName2: pObjB?.name || codeB,
              oraclePrivilege2: oraclePriv2,
              conflict: `${rule.name} [${rule.rating}]`,
              rating: rule.rating,
              description: rule.riskDescription,
              howDetected: `Inter-Role Conflict: Privilege "${pObjA?.name || codeA}" in role "${roleA}" conflicts with privilege "${pObjB?.name || codeB}" in role "${roleB}".`,
              targetRoleToRevoke: roleB,
              actionRequired: rule.action || `Revoke role "${roleB}" to enforce segregation of duties.`,
              status: rem ? 'SUCCEEDED' : 'ACTIVE',
              isRemediated: Boolean(rem),
              remediatedAt: rem ? rem.remediatedAt : null
            });
          }
        }
      }
    }
  }

  // IMPORTANT: Keep remediated records for audit trail (never delete from UI)
  for (const rem of remediations) {
    const key = rem.id || `${rem.user}_${rem.ruleId}`;
    if (!processedConflictKeys.has(key)) {
      const matchingRule = sodRules.find(r => r.ruleId === rem.ruleId) || {};
      conflicts.unshift({
        id: key,
        ruleId: rem.ruleId || 'SOD-RULE',
        module: rem.module || matchingRule.module || 'HCM',
        conflictType: rem.conflictType || 'INTER_ROLE',
        conflictTypeLabel: rem.conflictType === 'INTRA_ROLE' ? 'Intra-Role (Same Role)' : 'Inter-Role (Cross-Role)',
        user: rem.user,
        userName: rem.userName || rem.user,
        userEmail: rem.userEmail || `${rem.user.toLowerCase()}@oraclepdemos.com`,
        assignedRole1: rem.assignedRole1 || matchingRule.roleKeywordA || 'Employee',
        function1: rem.function1 || matchingRule.functionA || 'Business Operation',
        privilegeCode1: rem.privilegeCode1 || matchingRule.privilegeCodeA || 'P01',
        privilegeName1: rem.privilegeName1 || rem.function1,
        oraclePrivilege1: rem.oraclePrivilege1 || getOraclePrivilegeCode(matchingRule.privilegeCodeA || rem.privilegeCode1 || 'P01', rem.ruleId, 'A'),
        assignedRole2: rem.assignedRole2 || rem.revokedRole || 'Conflicting Duty',
        function2: rem.function2 || matchingRule.functionB || 'Supervisory Action',
        privilegeCode2: rem.privilegeCode2 || matchingRule.privilegeCodeB || 'P02',
        privilegeName2: rem.privilegeName2 || rem.function2,
        oraclePrivilege2: rem.oraclePrivilege2 || getOraclePrivilegeCode(matchingRule.privilegeCodeB || rem.privilegeCode2 || 'P02', rem.ruleId, 'B'),
        conflict: `${matchingRule.name || 'Segregation of Duties Conflict'} [${matchingRule.rating || 'High'}]`,
        rating: matchingRule.rating || 'High',
        description: matchingRule.riskDescription || 'Remediated segregation of duties violation.',
        howDetected: 'Remediated via Oracle Cloud Automated Bot: Conflicting role successfully unlinked.',
        targetRoleToRevoke: rem.revokedRole || rem.assignedRole2,
        actionRequired: 'Role revoked via Bot',
        status: 'SUCCEEDED',
        isRemediated: true,
        remediatedAt: rem.remediatedAt || new Date().toISOString()
      });
      processedConflictKeys.add(key);
    }
  }

  // Sort conflicts in alphabetical order A-Z by User / Employee Name, then by Rule ID
  conflicts.sort((a, b) => {
    const userA = String(a.userName || a.user || '').trim().toUpperCase();
    const userB = String(b.userName || b.user || '').trim().toUpperCase();
    const cmp = userA.localeCompare(userB);
    if (cmp !== 0) return cmp;
    return String(a.ruleId || '').localeCompare(String(b.ruleId || ''));
  });

  // Calculate summary statistics
  const activeConflicts = conflicts.filter(c => c.status === 'ACTIVE');
  const intraCount = conflicts.filter(c => c.conflictType === 'INTRA_ROLE' && c.status === 'ACTIVE').length;
  const interCount = conflicts.filter(c => c.conflictType === 'INTER_ROLE' && c.status === 'ACTIVE').length;
  const succeededCount = conflicts.filter(c => c.status === 'SUCCEEDED').length;
  const highRisk = conflicts.filter(c => c.rating === 'High' && c.status === 'ACTIVE').length;
  const mediumRisk = conflicts.filter(c => c.rating === 'Medium' && c.status === 'ACTIVE').length;
  const affectedUsers = new Set(activeConflicts.map(c => c.user)).size;

  return {
    ok: true,
    totalConflicts: conflicts.length,
    activeConflictsCount: activeConflicts.length,
    intraRoleCount: intraCount,
    interRoleCount: interCount,
    succeededCount: succeededCount,
    highRiskCount: highRisk,
    mediumRiskCount: mediumRisk,
    affectedUsersCount: affectedUsers,
    totalUsersScanned: users.length,
    source: auditResult.source || 'oracle_demo_instance',
    instance: auditResult.instance || {},
    conflicts,
    rulesCount: sodRules.length,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  detectFunctionalConflicts,
  loadSodRules,
  recordRemediation,
  loadRemediations,
  getPrivilegesForRole,
  getOraclePrivilegeCode,
  PRIVILEGES,
  ROLE_PRIVILEGE_MAPPING
};
