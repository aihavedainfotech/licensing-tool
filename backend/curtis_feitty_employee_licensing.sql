/* =========================================================================================
   Oracle Fusion Cloud - Employee Licensing Details Report
   Instance: Curtis Feitty Demo / GSE Environment
   Destination: Oracle BI Publisher Data Model -> Excel Export (.xlsx)
   Columns produced:
     1. SKU
     2. SERVICE
     3. SERVICE_LABEL
     4. USER_LOGIN
     5. USER_LOGIN_HASH
     6. PRIVILEGE
     7. ROLE_NAME
   ========================================================================================= */

WITH sku_priv_map AS (
    SELECT 'HWM_MANAGE_TIME_WORK_AREA_PRIV' AS privilege_code, 'B75365' AS sku, 'Oracle Fusion Time and Labor Cloud Service - Hosted Named User' AS service, '> B75365 Oracle Fusion Time and Labor Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HWM_TIME_MANAGEMENT_WORK_AREA_PRIV' AS privilege_code, 'B75365' AS sku, 'Oracle Fusion Time and Labor Cloud Service - Hosted Named User' AS service, '> B75365 Oracle Fusion Time and Labor Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'GTG_MASS_EDIT_SECURITY_ASSIGNMENTS_PRIV' AS privilege_code, 'B81510' AS sku, 'Oracle Fusion Financial Reporting Compliance Cloud Service - Hosted Named User' AS service, '** B81510 Oracle Fusion Financial Reporting Compliance Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'WLF_LEARNING_COMMON_PRIV' AS privilege_code, 'B85242' AS sku, 'Oracle Fusion Learning Cloud Service - Hosted Named User' AS service, '> B85242 Oracle Fusion Learning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'INV_MANAGE_ONHAND_QUANTITY_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'WIP_MANAGE_WORK_EXECUTION_WORK_AREA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'RCV_RECEIVE_GOODS_USING_RESPONSIVE_RECEIVING_PWA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'MNT_MANAGE_MAINTENANCE_MANAGEMENT_WORK_AREA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'INV_MONITOR_INVENTORY_MANAGEMENT_WORK_AREA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'CST_MANAGE_COST_ACCOUNTING_ACTIVITIES_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'WIS_MANAGE_WORK_DEFINITION_WORK_AREA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'CST_MAINTAIN_COST_ORGANIZATION_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'INV_RECORD_PHYSICAL_INVENTORY_TAGS_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'WSH_MANAGE_DELIVERY_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'RCV_RECEIVE_RECEIVING_SHIPMENT_LINE_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'RCV_INSPECT_GOODS_USING_RESPONSIVE_RECEIVING_PWA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'RCV_CREATE_RECEIVING_DOCK_LOG_PWA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'CST_MANAGE_COST_PLANNING_ACTIVITIES_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'CML_ANALYZE_LANDED_COST_CHARGES_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'INV_RECORD_CYCLE_COUNT_SEQUENCE_PWA_PRIV' AS privilege_code, 'B91057' AS sku, 'Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service, 'B91057 Oracle Fusion Supply Chain Execution Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'MSC_MONITOR_SUPPLY_PLANNING_WORK_AREA_PRIV' AS privilege_code, 'B91059' AS sku, 'Oracle Fusion Supply Planning Cloud Service - Hosted Named User' AS service, 'B91059 Oracle Fusion Supply Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'AP_MANAGE_PAYABLES_INVOICES_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJS_MANAGE_PROJECT_PERFORMANCE_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJS_REVIEW_PROJECT_PERFORMANCE_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'GL_MANAGE_GENERAL_ACCOUNTING_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJO_MANAGE_PROJECT_BUDGET_WORKING_VERSION_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'XCC_MANAGE_BUDGETARY_CONTROL_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJB_MANAGE_PROJECT_BILLING_EVENT_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'GL_MANAGE_PERIOD_CLOSE_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'CE_MANAGE_BANK_STATEMENT_AND_RECONCILIATION_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJO_MANAGE_PROJECT_FORECAST_WORKING_VERSION_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'IEX_MANAGE_COLLECTIONS_DASHBOARD_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'EXM_MANAGE_EXPENSES_SYSTEM_OPTION_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJT_MANAGE_PROJECT_WORK_PLAN_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJC_MANAGE_PROJECT_COST_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'AR_MANAGE_RECEIVABLES_BALANCES_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'AR_MANAGE_RECEIVABLES_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJF_UPDATE_PROJECT_DEFINITION_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJC_MANAGE_PROJECT_CAPITAL_ASSET_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJB_MAINTAIN_PROJECT_CONTRACT_REVENUE_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'AP_MANAGE_PAYABLES_ACTIVITIES_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'FA_MANAGE_FIXED_ASSET_FINANCIAL_TRANSACTIONS_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJB_MANAGE_PROJECT_CONTRACT_INVOICE_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'FLA_MANAGE_CONTRACT_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'EXM_AUDIT_EXPENSE_REPORT_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PJC_MANAGE_PROJECT_LABOR_DISTRIBUTIONS_PRIV' AS privilege_code, 'B91079' AS sku, 'Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service, 'B91079 Oracle Fusion Enterprise Resource Planning Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PO_VIEW_PURCHASING_WORKAREA_PRIV' AS privilege_code, 'B91082' AS sku, 'Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service, '> B91082 Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PON_SUBMIT_SUPPLIER_NEGOTIATION_PRIV' AS privilege_code, 'B91082' AS sku, 'Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service, '> B91082 Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PO_VIEW_PURCHASE_AGREEMENT_WORKAREA_PRIV' AS privilege_code, 'B91082' AS sku, 'Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service, '> B91082 Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'POQ_VIEW_SUPPLIER_QUALIFICATION_WORKAREA_PRIV' AS privilege_code, 'B91082' AS sku, 'Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service, '> B91082 Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PON_CREATE_SUPPLIER_NEGOTIATION_PRIV' AS privilege_code, 'B91082' AS sku, 'Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service, '> B91082 Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PON_COMPLETE_SUPPLIER_NEGOTIATION_AWARD_PRIV' AS privilege_code, 'B91082' AS sku, 'Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service, '> B91082 Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'PON_AWARD_SUPPLIER_NEGOTIATION_PRIV' AS privilege_code, 'B91082' AS sku, 'Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service, '> B91082 Oracle Fusion Procurement Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'POR_MANAGE_REQUISITION_PRIV' AS privilege_code, 'B91083' AS sku, 'Oracle Fusion Procurement for Self Service Cloud Service - Hosted Named User' AS service, 'B91083 Oracle Fusion Procurement for Self Service Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'FOM_VIEW_ORDERS_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'QP_MANAGE_PRICING_ADMINISTRATION_WORKAREA_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'DOO_MONITOR_SALES_ORDER_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'FOM_CREATE_ORDER_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'FOM_REVISE_ORDER_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'DOO_MANAGE_ORCHESTRATION_INFRASTRUCTURE_PROCESS_DEFINITION_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'FOM_VIEW_ORDER_TO_CASH_INFOLET_PAGE_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'DOO_MANAGE_ORDER_ORCHESTRATION_REQUEST_VIEW_MESSAGES_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'MSC_MONITOR_ORDER_PROMISING_WORK_AREA_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'DOO_MANAGE_ORCHESTRATION_PROCESS_DEFINITION_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'DOO_MANAGE_ORDER_DETAILS_WEB_SERVICE_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'DOO_MANAGE_ORDER_ORCHESTRATION_DECOMPOSITION_WEB_SERVICE_PRIV' AS privilege_code, 'B93429' AS sku, 'Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service, 'B93429 Oracle Fusion Order Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_REQUEST_FEEDBACK_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRG_MANAGE_DEVELOPMENT_GOAL_BY_WORKER_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_VIEW_PERFORMANCE_MANAGER_DASHBOARD_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_CREATE_PERFORMANCE_DOCUMENT_BY_WORKER_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRG_MANAGE_PERFORMANCE_GOAL_BY_WORKER_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_VIEW_WORKER_PERFORMANCE_MANAGEMENT_DOCUMENT_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_RESET_WORKER_PERFORMANCE_EVALUATION_STATUS_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_CREATE_PERFORMANCE_DOCUMENT_BY_MANAGER_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_DELETE_PARTICIPANT_FEEDBACK_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_APPROVE_WORKER_PERFORMANCE_DOCUMENT_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRT_VIEW_PERFORMANCE_OVERVIEW_BY_MANAGER_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_REOPEN_PERFORMANCE_DOCUMENT_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_CANCEL_WORKER_PERFORMANCE_DOCUMENT_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_WORKER_ELIGIBILITY_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MASS_PROCESS_PERFORMANCE_DOCUMENTS_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_CREATE_WORKER_PERFORMANCE_DOCUMENT_MASS_PROCESS_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_CREATE_PERFORMANCE_DOCUMENT_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_TRANSFER_PERFORMANCE_DOCUMENT_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_PERFORMANCE_ROLES_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_PERFORMANCE_TEMPLATE_SECTIONS_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_MATRIX_LAYOUT_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_ELIGIBILITY_BATCH_PROCESS_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_PERFORMANCE_TEMPLATE_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_PERFORMANCE_DOCUMENT_TYPE_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'HRA_MANAGE_PERFORMANCE_PROCESS_FLOW_DEFINITION_PRIV' AS privilege_code, 'B94925' AS sku, 'Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service, '> B94925 Oracle Fusion Talent Management Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'ACA_VIEW_SUPPLIER_CHANGE_ORDERS_PRIV' AS privilege_code, 'B95242' AS sku, 'Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service, '** B95242 Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'ENQ_REVIEW_QUALITY_ACTION_PRIV' AS privilege_code, 'B95242' AS sku, 'Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service, '** B95242 Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'ACA_VIEW_CORRECTIVE_ACTIONS_PRIV' AS privilege_code, 'B95242' AS sku, 'Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service, '** B95242 Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service_label FROM DUAL
    UNION ALL
    SELECT 'EGO_VIEW_NEW_ITEM_REQUEST_PRIV' AS privilege_code, 'B95242' AS sku, 'Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service, '** B95242 Oracle Fusion Product Management Reviewer Cloud Service - Hosted Named User' AS service_label FROM DUAL
),
user_role_privs AS (
    SELECT DISTINCT
        pu.username                                       AS user_login,
        ORA_HASH(pu.username)                             AS user_login_hash,
        ar.role_name                                      AS role_name,
        ap.privilege_code                                 AS privilege_code
    FROM per_users pu
    JOIN per_user_roles pur 
        ON pu.user_id = pur.user_id
    JOIN ase_role_vl ar 
        ON pur.role_id = ar.role_id
    /* Traverse role hierarchy (Job Role -> Duty Roles -> Function Privileges) */
    JOIN (
        /* Direct role privileges */
        SELECT role_id AS parent_role_id, role_id AS leaf_role_id 
        FROM ase_role_b
        UNION
        /* Inherited duty roles */
        SELECT parent_role_id, role_id AS leaf_role_id
        FROM ase_role_role_mbr
    ) r_hier 
        ON ar.role_id = r_hier.parent_role_id
    JOIN ase_priv_role_mbr prm 
        ON r_hier.leaf_role_id = prm.role_id
    JOIN ase_privilege_vl ap 
        ON prm.privilege_id = ap.privilege_id
    WHERE NVL(pu.suspended, 'N') = 'N'
      AND NVL(pur.active_flag, 'Y') = 'Y'
)
SELECT 
    m.sku                                                 AS "SKU",
    m.service                                             AS "SERVICE",
    m.service_label                                       AS "SERVICE_LABEL",
    u.user_login                                          AS "USER_LOGIN",
    u.user_login_hash                                     AS "USER_LOGIN_HASH",
    u.privilege_code                                      AS "PRIVILEGE",
    u.role_name                                           AS "ROLE_NAME"
FROM user_role_privs u
JOIN sku_priv_map m 
    ON u.privilege_code = m.privilege_code
ORDER BY 
    m.sku, 
    u.user_login, 
    u.privilege_code;
