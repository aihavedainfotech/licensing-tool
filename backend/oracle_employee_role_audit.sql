SELECT 
    TO_CHAR(pu.creation_date, 'YYYY-MM-DD HH24:MI:SS') AS EMPLOYEE_CREATION_DATE,
    NVL(ppnf.display_name, pu.username) AS EMPLOYEE_NAME,
    NVL(pea.email_address, LOWER(pu.username) || '@oraclepdemos.com') AS EMPLOYEE_EMAIL,
    COALESCE(rd.role_name, ar.role_name, 'Employee') AS EMPLOYEE_ASSIGNED_ROLE,
    TO_CHAR(COALESCE(pur.last_update_date, pu.last_update_date, pu.creation_date), 'YYYY-MM-DD HH24:MI:SS') AS ROLE_LAST_LOGIN,
    CASE 
        WHEN COALESCE(pur.last_update_date, pu.last_update_date, pu.creation_date) >= SYSDATE - 90 
        THEN 'Active' 
        ELSE 'Inactive' 
    END AS ACTIVITY_STATUS
FROM per_users pu
JOIN per_user_roles pur 
    ON pu.user_id = pur.user_id
LEFT JOIN per_roles_dn_vl rd 
    ON pur.role_id = rd.role_id
LEFT JOIN ase_role_vl ar 
    ON pur.role_id = ar.role_id
LEFT JOIN per_person_names_f ppnf 
    ON pu.person_id = ppnf.person_id 
   AND ppnf.name_type = 'GLOBAL' 
   AND SYSDATE BETWEEN ppnf.effective_start_date AND ppnf.effective_end_date
LEFT JOIN per_email_addresses pea 
    ON pu.person_id = pea.person_id
WHERE NVL(pu.suspended, 'N') = 'N'
ORDER BY 
    pu.username ASC, 
    EMPLOYEE_ASSIGNED_ROLE ASC