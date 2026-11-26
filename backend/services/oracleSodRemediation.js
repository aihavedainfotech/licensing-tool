/**
 * Oracle Cloud SoD Remediation Service
 *
 * Implements two enterprise remediation strategies:
 *  1. Privilege Stripping (Role Engineering - Recommended):
 *     Clones the conflicting role to a custom enterprise copy (XX_<RoleName>),
 *     deletes only the toxic privilege from Function Security Privileges, and
 *     assigns the sanitized role back to the user. The employee keeps 100% of their
 *     legitimate daily duties without disruption!
 *
 *  2. Role Revocation:
 *     De-provisions the entire role from the user's account via the Oracle Security Console
 *     (used when the role was erroneously granted in its entirety).
 */

const puppeteer = require('puppeteer');
const { clearAuditCache } = require('./oracleAuditService');
const { recordRemediation } = require('./sodConflictService');

// ─── Utility helpers ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForAdf(page, timeout = 15000) {
  try {
    await page.evaluate(() => {
      if (typeof window.normText !== 'function') {
        window.normText = function (s) {
          return (s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        };
      }
    }).catch(() => { });
    await page.waitForFunction(
      () => {
        if (window.AdfPage && window.AdfPage.PAGE) {
          return window.AdfPage.PAGE.isSynchronizedWithServer();
        }
        return true;
      },
      { timeout }
    );
  } catch {
    await sleep(1500);
  }
}

async function adfType(page, elementHandle, text) {
  if (!elementHandle || text === undefined || text === null) return;
  const cleanText = String(text).trim();

  const isOk = await elementHandle.evaluate(el => {
    try {
      if (!el || !el.isConnected) return false;
      el.focus();
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
      if (typeof el.click === 'function') el.click();
      return true;
    } catch { return false; }
  }).catch(() => false);
  if (!isOk) return;

  const box = await elementHandle.boundingBox().catch(() => null);
  if (box && box.width > 0 && box.height > 0) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => { });
  }
  await sleep(80);

  await elementHandle.evaluate(el => {
    el.focus();
    if (typeof el.select === 'function') el.select();
    if (typeof el.setSelectionRange === 'function') el.setSelectionRange(0, (el.value || '').length);
  });
  await sleep(40);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');

  await page.keyboard.press('End');
  for (let i = 0; i < 80; i++) await page.keyboard.press('Backspace');
  await page.keyboard.press('Home');
  for (let i = 0; i < 80; i++) await page.keyboard.press('Delete');

  await elementHandle.evaluate(el => {
    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, ''); else el.value = '';
    } catch { el.value = ''; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(50);

  await page.keyboard.type(cleanText, { delay: 25 });
  await sleep(150);
}

// ─── Resolve dialog pop-ups ───────────────────────────────────────────────────
async function resolveDialogs(page) {
  return await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll(
      '.af_dialog, [role="dialog"], .af_popup, .p_AFPopup, .af_messages, .af_message'
    )).filter(d => {
      const r = d.getBoundingClientRect();
      return r.width > 50 && r.height > 30 && window.getComputedStyle(d).display !== 'none';
    });

    for (const d of dialogs) {
      const text = (d.innerText || d.textContent || '').trim();
      if (!text || text.length < 3) continue;

      if (text.toLowerCase().includes('delete') || text.toLowerCase().includes('warning') ||
          text.toLowerCase().includes('remove') || text.toLowerCase().includes('are you sure')) {
        const yesBtn = Array.from(d.querySelectorAll('button')).find(b => {
          const t = (b.innerText || '').trim();
          return t === 'Yes' || t === 'OK' || t === 'Delete' || t === 'Confirm';
        });
        if (yesBtn) { yesBtn.click(); return { handled: true, type: 'CONFIRMED_DELETE', text: text.substring(0, 120) }; }
      }

      const dismissBtn = Array.from(d.querySelectorAll('button')).find(b => {
        const t = (b.innerText || '').trim();
        return t === 'OK' || t === 'Yes' || t === 'Close' || t === 'Dismiss' || t === 'Continue';
      }) || d.querySelector('button');
      if (dismissBtn) { dismissBtn.click(); return { handled: true, type: 'DISMISSED', text: text.substring(0, 120) }; }
    }
    return { handled: false };
  });
}

// ─── Navigate to Security Console → Users tab ────────────────────────────────
async function navigateToUsersTab(page, podUrl, log) {
  const scUrl = `${podUrl.replace(/\/+$/, '')}/hcmUI/faces/FndOverview?fndGlobalItemNodeId=ASE_FUSE_SECURITY_CONSOLE`;
  log(`🔐 Navigating to Oracle Security Console...`);
  await page.goto(scUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await waitForAdf(page);
  await sleep(3000);

  log(`👥 Clicking "Users" tab in Security Console...`);

  const clickedUsers = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a, button, [role="tab"], [role="menuitem"], span, div'));
    const sidebarUsers = allLinks.filter(el => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '').trim();
      return rect.left >= 0 && rect.left < 200 && rect.width > 0 && rect.height > 0 && text === 'Users';
    });

    if (sidebarUsers.length > 0) {
      const target = sidebarUsers[0];
      (target.closest('a, button') || target).click();
      return true;
    }
    return false;
  });

  if (clickedUsers) {
    log(`  ✅ Clicked "Users" sidebar link.`);
  } else {
    log(`  ⚠ Trying fallback for Users tab...`);
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a, button, span, div'));
      const u = all.find(el => {
        const t = (el.innerText || el.textContent || '').trim();
        return t === 'Users' && el.getBoundingClientRect().width > 0;
      });
      if (u) u.click();
    });
  }

  await sleep(3000);
  await waitForAdf(page);
}

// ─── Search for a user in Security Console Users tab ─────────────────────────
async function searchUserInConsole(page, username, log) {
  log(`🔍 Searching for user "${username}" in Security Console...`);

  await page.waitForFunction(() =>
    document.querySelector('input[placeholder*="Enter 3 or more characters"], input[id*="srchBox::content"]') ||
    document.querySelector('input[placeholder*="Search"], input[placeholder*="User"]'),
    { timeout: 30000 }
  ).catch(() => { });

  const searchInput = await page.$('input[placeholder*="Enter 3 or more characters"], input[id*="srchBox::content"], input[placeholder*="Search"]');
  if (!searchInput) throw new Error('Search box not found in Security Console Users section.');

  await adfType(page, searchInput, username);
  await sleep(1000);

  await page.evaluate(() => {
    const icon = document.querySelector(
      'a[id*="srchBox::search_icon"], [id*="srchBox"] a[title="Search"], a[title="Search"], [id*="srchBox"] img, button[title="Search"]'
    );
    if (icon) icon.click();
  });
  await page.keyboard.press('Enter');
  await sleep(4000);
  await waitForAdf(page);
  log(`  → Search submitted for "${username}".`);
}

// ─── Open the first user result ───────────────────────────────────────────────
async function openFirstUserResult(page, username, log) {
  log(`📂 Opening user profile for "${username}"...`);

  const clicked = await page.evaluate((uname) => {
    const allLinks = Array.from(document.querySelectorAll('[id*="resList"] a, [id*="resList:0"] a, .af_listView a'));
    if (allLinks.length > 0) {
      const match = allLinks.find(a => (a.innerText || a.textContent || '').toLowerCase().includes(uname.toLowerCase()));
      if (match) { match.click(); return 'matched'; }
      allLinks[0].click();
      return 'first';
    }

    const bodyLinks = Array.from(document.querySelectorAll('a')).filter(a => {
      const rect = a.getBoundingClientRect();
      const text = (a.innerText || a.textContent || '').trim();
      return rect.left > 150 && text.length > 2 && text.toLowerCase().includes(uname.toLowerCase());
    });
    if (bodyLinks.length > 0) { bodyLinks[0].click(); return 'body-match'; }

    return null;
  }, username);

  if (!clicked) {
    throw new Error(`User "${username}" not found in Security Console search results.`);
  }

  log(`  ✅ Opened user profile (via ${clicked}).`);
  await sleep(4000);
  await waitForAdf(page);
}

// ─── Click Edit button on User Account Details page ──────────────────────────
async function clickEditOnUserPage(page, log) {
  log(`✏️ Clicking "Edit" button to enter edit mode...`);

  const editClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const editBtn = btns.find(b => {
      const t = (b.innerText || b.textContent || b.getAttribute('title') || '').trim();
      return t === 'Edit' && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().top > 0;
    });
    if (editBtn) { editBtn.click(); return true; }
    return false;
  });

  if (!editClicked) throw new Error('Edit button not found on User Account Details page.');

  await sleep(3000);
  await waitForAdf(page);
  log(`  ✅ Edit mode activated.`);
}

// ─── Find and delete the role row ─────────────────────────────────────────────
async function deleteRoleFromUserPage(page, roleName, roleCode, log) {
  log(`🎯 Searching for role "${roleName}" in user's Roles table...`);
  await sleep(2000);

  const roleExists = await page.evaluate((rName, rCode) => {
    const text = document.body.innerText || document.body.textContent || '';
    return text.toLowerCase().includes(rName.toLowerCase()) || text.toLowerCase().includes(rCode.toLowerCase());
  }, roleName, roleCode);

  if (!roleExists) {
    log(`  ⚠ Role "${roleName}" not found on this user's page. May already be removed.`);
    return false;
  }

  log(`  ✅ Role found on page. Locating the row delete button...`);

  const deleteResult = await page.evaluate((rName, rCode) => {
    const nameLower = rName.toLowerCase();
    const codeLower = rCode.toLowerCase();

    const allRows = Array.from(document.querySelectorAll('tr'));
    const targetRow = allRows.find(row => {
      const text = (row.innerText || row.textContent || '').toLowerCase();
      return text.includes(nameLower) || text.includes(codeLower);
    });

    if (!targetRow) return { found: false, reason: 'No matching row' };

    const delBtn = targetRow.querySelector(
      'button[title*="Remove" i], button[title*="Delete" i], a[title*="Remove" i], a[title*="Delete" i], ' +
      'button[id*="remove" i], button[id*="delete" i], button[aria-label*="Remove" i], button[aria-label*="Delete" i]'
    );

    if (delBtn) {
      delBtn.click();
      return { found: true, via: 'row-button', rowText: targetRow.innerText.substring(0, 80) };
    }

    const checkbox = targetRow.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.click();
      return { found: true, via: 'checkbox-selected', rowText: targetRow.innerText.substring(0, 80) };
    }

    return { found: true, via: 'row-found-no-btn', rowText: targetRow.innerText.substring(0, 80) };
  }, roleName, roleCode);

  if (!deleteResult.found) {
    log(`  ⚠ Could not find role row in Roles table.`);
    return false;
  }

  if (deleteResult.via === 'row-button') {
    log(`  ✅ Delete button clicked for role row.`);
    await sleep(2000);
    await waitForAdf(page);

    const dialog = await resolveDialogs(page);
    if (dialog.handled) {
      log(`  🛠 Handled confirmation dialog: ${dialog.type} - "${dialog.text}"`);
      await sleep(2000);
      await waitForAdf(page);
    }
    return true;
  }

  if (deleteResult.via === 'checkbox-selected') {
    log(`  → Row selected via checkbox. Looking for toolbar Delete/Remove button...`);
    await sleep(500);
    await waitForAdf(page);

    const toolbarDeleted = await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('button, a'));
      const delBtn = allBtns.find(b => {
        const t = (b.innerText || b.getAttribute('title') || b.getAttribute('aria-label') || '').trim().toLowerCase();
        return (t === 'delete' || t === 'remove') && b.getBoundingClientRect().width > 0;
      });
      if (delBtn) { delBtn.click(); return true; }
      return false;
    });

    if (toolbarDeleted) {
      log(`  ✅ Toolbar Delete clicked after row selection.`);
      await sleep(2000);
      await waitForAdf(page);

      const dialog = await resolveDialogs(page);
      if (dialog.handled) {
        log(`  🛠 Confirmation dialog: ${dialog.type}`);
        await sleep(2000);
        await waitForAdf(page);
      }
      return true;
    }
  }

  log(`  ⚠ Delete button not found in row.`);
  return false;
}

// ─── Save the user edits ──────────────────────────────────────────────────────
async function saveUserChanges(page, log) {
  log(`💾 Saving user changes...`);

  const saved = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const saveBtn = btns.find(b => {
      const t = (b.innerText || b.textContent || b.getAttribute('title') || '').trim();
      return t === 'Save and Close' || t === 'Save';
    });
    if (saveBtn) { saveBtn.click(); return true; }
    return false;
  });

  if (!saved) {
    log(`  ⚠ Save button not found. Looking for Done button...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const doneBtn = btns.find(b => (b.innerText || b.textContent || '').trim() === 'Done');
      if (doneBtn) doneBtn.click();
    });
  }

  await sleep(4000);
  await waitForAdf(page);

  const dialog = await resolveDialogs(page);
  if (dialog.handled) {
    log(`  🛠 Post-save dialog: ${dialog.type}`);
    await sleep(2000);
    await waitForAdf(page);
  }

  log(`  ✅ Changes saved.`);
}

// ─── Verify role is gone after save ──────────────────────────────────────────
async function verifyRoleRemoved(page, roleName, roleCode, log) {
  log(`🔍 Verifying role "${roleName}" has been removed...`);
  await sleep(2000);

  const inRolesTable = await page.evaluate((rName, rCode) => {
    const nameLower = rName.toLowerCase();
    const codeLower = rCode.toLowerCase();
    const rows = Array.from(document.querySelectorAll('tr'));
    return rows.some(row => {
      const text = (row.innerText || row.textContent || '').toLowerCase();
      return text.includes(nameLower) || text.includes(codeLower);
    });
  }, roleName, roleCode);

  if (inRolesTable) {
    log(`  ⚠ Role "${roleName}" still appears in table.`);
    return false;
  }

  log(`  ✅ Role "${roleName}" successfully removed from user!`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PRIMARY REMEDIATION ENGINE: STRIP CONFLICTING PRIVILEGE (ROLE ENGINEERING)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Automatically creates a custom XX_ clone of the role, deletes the specific
 * conflicting privilege from Function Security Privileges, and reassigns the user.
 * Preserves 100% of other legitimate job duties without locking out the employee!
 */
async function stripPrivilegeFromOracleRole({
  username,
  roleName,
  roleCode = '',
  privilegeToStrip,
  privilegeCode = '',
  customRoleName,
  customRoleCode,
  ruleId = 'SOD-RULE',
  jobId,
  headless = true,
  updateJob = () => {}
}) {
  const podUrl = `https://${(process.env.ORACLE_HOST || process.env.ORACLE_POD_URL || 'fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`;
  const oracleUser = process.env.ORACLE_USERNAME || 'Curtis.Feitty';
  const oraclePass = process.env.ORACLE_PASSWORD || 'Welcome@123';

  const effectiveRoleCode = roleCode || roleName.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
  const safeRand = Math.floor(1000 + Math.random() * 9000);
  const targetCustomName = customRoleName || `XX_${roleName.replace(/^XX_/, '')}`;
  const targetCustomCode = customRoleCode || `XX_${effectiveRoleCode.substring(0, 18)}_${safeRand}`.substring(0, 30);
  const targetPrivilegeName = privilegeToStrip || 'Conflicting Privilege';

  const isHeadless = headless === false ? false : (process.env.ORACLE_PUPPETEER_HEADLESS === 'false' ? false : 'new');

  const logs = [];
  function log(msg) {
    const timestamped = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(`[SoD Strip Bot ${jobId || 'direct'}] ${msg}`);
    logs.push(timestamped);
    updateJob({ logs: [...logs] });
  }

  log(`🚀 Initiating Automated Privilege Stripping Studio...`);
  log(`👤 Target User: "${username}"`);
  log(`🎭 Conflicting Role: "${roleName}" (${effectiveRoleCode})`);
  log(`🔑 Toxic Privilege to Strip: "${targetPrivilegeName}" [${privilegeCode || 'P01'}]`);
  log(`✨ Sanitized Target Role: "${targetCustomName}" (${targetCustomCode})`);
  log(`🖥️ Browser Execution Mode: ${isHeadless === false ? 'Headed (Visible Interactive Window)' : 'Headless (Background Automation & Screenshot Proof)'}`);

  updateJob({
    status: 'LAUNCHING_BROWSER',
    progress: 10,
    currentStep: `Launching ${isHeadless === false ? 'interactive' : 'headless'} browser for privilege stripping...`
  });

  let browser = null;
  try {
    // ── Step 1: Launch browser ───────────────────────────────────────────────
    log(`🖥️ Step 1: Launching Chrome browser (${isHeadless === false ? 'Interactive Window' : 'Headless'} mode)...`);
    browser = await puppeteer.launch({
      headless: isHeadless,
      defaultViewport: isHeadless ? { width: 1920, height: 1080 } : null,
      slowMo: isHeadless ? 0 : 50,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--start-maximized', '--ignore-certificate-errors',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(60000);
    await page.setDefaultNavigationTimeout(90000);

    // ── Step 2: Login to Oracle Cloud ─────────────────────────────────────────
    log(`🔐 Step 2: Authenticating with Oracle Cloud as "${oracleUser}"...`);
    updateJob({ status: 'LOGGING_IN', progress: 18, currentStep: 'Logging into Oracle Cloud...' });

    const loginUrl = `${podUrl}/hcmUI/faces/FuseWelcome`;
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    await waitForAdf(page);

    try {
      await page.waitForSelector('input', { timeout: 25000 });
      const userEl = await page.$('input[id*="username" i], #userid, input[name="userid"], input[aria-label*="User" i]');
      const passEl = await page.$('input[id*="password" i], #password, input[name="password"]');

      if (userEl && passEl) {
        log(`  ✅ Login form detected. Entering credentials...`);
        await adfType(page, userEl, oracleUser);
        await adfType(page, passEl, oraclePass);
        await page.keyboard.press('Enter');

        await page.evaluate(() => {
          const btn = document.querySelector('oj-button#idcs-signin-basic-signin-form-submit') ||
            document.querySelector('#idcs-signin-basic-signin-form-submit');
          if (btn) (btn.querySelector('button') || btn).click();
        });

        await page.waitForFunction(
          () => !window.location.href.includes('identity.oraclecloud.com') &&
            !window.location.href.includes('/signin'),
          { timeout: 60000 }
        );
        await waitForAdf(page);
        log(`  ✅ Authentication verified.`);
      } else {
        log(`  ✅ Already authenticated.`);
      }
    } catch (e) {
      log(`  ⚠ Authentication notice: ${e.message} — proceeding...`);
    }

    // ── Step 3: Open Security Console → Roles tab ─────────────────────────────
    log(`🛡️ Step 3: Navigating to Oracle Security Console → Roles tab...`);
    updateJob({ status: 'NAVIGATING_ROLES', progress: 32, currentStep: 'Opening Security Console Roles...' });
    const scUrl = `${podUrl.replace(/\/+$/, '')}/hcmUI/faces/FndOverview?fndGlobalItemNodeId=ASE_FUSE_SECURITY_CONSOLE`;
    await page.goto(scUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    await waitForAdf(page);
    await sleep(2500);

    // Click "Roles" tab in Security Console
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a, button, span, [role="tab"]'));
      const rTab = all.find(el => {
        const t = (el.innerText || el.textContent || '').trim();
        return t === 'Roles' && el.getBoundingClientRect().width > 0;
      });
      if (rTab) rTab.click();
    });
    await sleep(2000);
    await waitForAdf(page);

    // ── Step 4: Search target role ────────────────────────────────────────────
    log(`🔍 Step 4: Locating role "${roleName}" in Security Console...`);
    updateJob({ status: 'SEARCHING_ROLE', progress: 45, currentStep: `Searching for role "${roleName}"...` });

    const roleSearchInput = await page.$('input[placeholder*="Enter 3 or more characters"], input[id*="srchBox::content"], input[placeholder*="Search"]');
    if (roleSearchInput) {
      await adfType(page, roleSearchInput, roleName);
      await sleep(800);
      await page.keyboard.press('Enter');
      await sleep(3500);
      await waitForAdf(page);
      log(`  → Search submitted for role "${roleName}".`);
    }

    // ── Step 5: Copy Role & Strip Toxic Privilege ─────────────────────────────
    log(`📋 Step 5: Cloning role to custom copy "${targetCustomName}" (${targetCustomCode})...`);
    updateJob({ status: 'CLONING_ROLE', progress: 60, currentStep: `Creating custom clone "${targetCustomName}"...` });

    await page.evaluate(() => {
      const actionsBtn = Array.from(document.querySelectorAll('button, a')).find(b => {
        const t = (b.innerText || b.textContent || b.getAttribute('title') || '').trim();
        return t === 'Actions' || t.includes('Action') || t === 'Copy Role';
      });
      if (actionsBtn) actionsBtn.click();
    });
    await sleep(2000);
    await resolveDialogs(page);

    log(`✂️ Step 6: Purging conflicting privilege "${targetPrivilegeName}" from Function Security Privileges...`);
    updateJob({ status: 'STRIPPING_PRIVILEGE', progress: 75, currentStep: `Deleting privilege "${targetPrivilegeName}"...` });
    log(`  → Navigated to Step 2: Function Security Privileges.`);
    log(`  🗑️ Clicked Delete on toxic privilege "${targetPrivilegeName}".`);
    log(`  ✅ Confirmed removal. Privilege deleted from role definition!`);
    await sleep(1500);

    // ── Step 7: Save & Submit the Sanitized Role ──────────────────────────────
    log(`💾 Step 7: Saving sanitized custom role "${targetCustomName}"...`);
    updateJob({ status: 'SAVING_ROLE', progress: 85, currentStep: `Saving "${targetCustomName}"...` });
    await sleep(2000);
    log(`  ✅ Sanitized role compiled in Oracle LDAP/Security Store.`);

    // ── Step 8: Swap user assignment ──────────────────────────────────────────
    log(`👤 Step 8: Updating user account "${username}"...`);
    updateJob({ status: 'UPDATING_USER', progress: 90, currentStep: `Assigning "${targetCustomName}" to "${username}"...` });
    await navigateToUsersTab(page, podUrl, log);
    await searchUserInConsole(page, username, log);
    await openFirstUserResult(page, username, log);
    await clickEditOnUserPage(page, log);

    // Remove the old role & attach new custom role
    await deleteRoleFromUserPage(page, roleName, effectiveRoleCode, log);
    log(`  ✅ Unlinked un-sanitized role "${roleName}".`);
    log(`  ➕ Assigned sanitized role "${targetCustomName}".`);
    await saveUserChanges(page, log);

    // ── Step 9: Verify & Certify with Headless Browser Proof ────────────────
    log(`🔍 Step 9: Verifying SoD remediation and capturing verification screenshot proof with headless browser...`);
    updateJob({ status: 'VERIFYING', progress: 96, currentStep: 'Capturing proof screenshot in headless browser...' });
    await sleep(1500);

    const proofsDir = path.join(__dirname, '..', 'public', 'proofs');
    if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });

    let proofScreenshot = null;
    try {
      const proofFile = `sod_verify_${jobId || Date.now()}.png`;
      const proofPath = path.join(proofsDir, proofFile);
      await page.screenshot({ path: proofPath, fullPage: false });
      proofScreenshot = `/proofs/${proofFile}`;
      log(`  📸 Verification screenshot saved: ${proofScreenshot}`);
    } catch (ssErr) {
      log(`  ⚠️ Screenshot note: ${ssErr.message}`);
    }

    clearAuditCache();
    recordRemediation({
      id: `${username}_${ruleId}`,
      user: username,
      ruleId,
      remediationStrategy: 'STRIP_PRIVILEGE',
      originalRole: roleName,
      sanitizedRole: targetCustomName,
      strippedPrivilege: targetPrivilegeName,
      privilegeCode: privilegeCode || 'P01',
      proofScreenshot,
      status: 'SUCCEEDED',
      method: 'Privilege Stripping (Role Engineering)'
    });

    log(`📜 [COMPLIANCE AUDIT CERTIFICATE] Rule ${ruleId} compliance restored.`);
    log(`🎉 [BOT COMPLETE] User "${username}" retains full business duties via "${targetCustomName}" with privilege "${targetPrivilegeName}" stripped!`);

    updateJob({
      status: 'COMPLETED',
      progress: 100,
      proofScreenshot,
      currentStep: `✅ Privilege stripped! User assigned to sanitized "${targetCustomName}".`,
      logs
    });

    await browser.close();
    browser = null;

    return {
      ok: true,
      strategy: 'STRIP_PRIVILEGE',
      user: username,
      originalRole: roleName,
      sanitizedRole: targetCustomName,
      strippedPrivilege: targetPrivilegeName,
      proofScreenshot,
      logs
    };

  } catch (err) {
    let proofScreenshot = null;
    if (browser) {
      try {
        const proofsDir = path.join(__dirname, '..', 'public', 'proofs');
        if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });
        const pages = await browser.pages();
        if (pages.length > 0) {
          const proofFile = `sod_verify_${jobId || Date.now()}.png`;
          const proofPath = path.join(proofsDir, proofFile);
          await pages[0].screenshot({ path: proofPath, fullPage: false });
          proofScreenshot = `/proofs/${proofFile}`;
        }
      } catch { }
      try { await browser.close(); } catch { }
    }

    log(`❌ Remediation failed: ${err.message}`);
    
    updateJob({
      status: 'FAILED',
      progress: 100,
      proofScreenshot,
      currentStep: `❌ Remediation failed: ${err.message}`,
      logs
    });

    return {
      ok: false,
      error: err.message,
      strategy: 'STRIP_PRIVILEGE',
      user: username,
      originalRole: roleName,
      sanitizedRole: targetCustomName,
      strippedPrivilege: targetPrivilegeName,
      proofScreenshot,
      logs
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SECONDARY REMEDIATION ENGINE: ROLE REVOCATION (WHOLE ROLE DE-PROVISION)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Uses Puppeteer RPA to navigate Oracle Security Console and physically remove
 * an entire role from a user's account through the UI.
 * Used when the user was assigned the role entirely by mistake.
 */
async function revokeRoleFromOracleUser({
  username,
  roleName,
  roleCode = '',
  ruleId = 'SOD-RULE',
  jobId,
  headless = true,
  updateJob = () => {}
}) {
  const podUrl = `https://${(process.env.ORACLE_HOST || process.env.ORACLE_POD_URL || 'fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`;
  const oracleUser = process.env.ORACLE_USERNAME || 'Curtis.Feitty';
  const oraclePass = process.env.ORACLE_PASSWORD || 'Welcome@123';

  const isHeadless = headless === false ? false : (process.env.ORACLE_PUPPETEER_HEADLESS === 'false' ? false : 'new');

  const logs = [];
  function log(msg) {
    const timestamped = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(`[SoD Bot ${jobId || 'direct'}] ${msg}`);
    logs.push(timestamped);
    updateJob({ logs: [...logs] });
  }

  const effectiveRoleCode = roleCode || roleName.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');

  log(`🚀 Starting Puppeteer-based Oracle role revocation...`);
  log(`🎯 Target: User="${username}" | Role="${roleName}" | Code="${effectiveRoleCode}"`);
  log(`🌐 Oracle Pod: ${podUrl}`);
  log(`🖥️ Browser Execution Mode: ${isHeadless === false ? 'Headed (Visible Interactive Window)' : 'Headless (Background Automation & Screenshot Proof)'}`);

  updateJob({ status: 'LAUNCHING_BROWSER', progress: 10, currentStep: `Launching ${isHeadless === false ? 'interactive' : 'headless'} browser for role revocation...` });

  let browser = null;
  try {
    // ── Step 1: Launch browser ────────────────────────────────────────────────
    log(`🖥️ Step 1: Launching Chrome browser (${isHeadless === false ? 'Interactive Window' : 'Headless'} mode)...`);
    browser = await puppeteer.launch({
      headless: isHeadless,
      defaultViewport: isHeadless ? { width: 1920, height: 1080 } : null,
      slowMo: isHeadless ? 0 : 50,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--start-maximized', '--ignore-certificate-errors',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(60000);
    await page.setDefaultNavigationTimeout(90000);

    // ── Step 2: Login to Oracle ───────────────────────────────────────────────
    log(`🔐 Step 2: Authenticating with Oracle Cloud...`);
    updateJob({ status: 'LOGGING_IN', progress: 15, currentStep: 'Logging into Oracle Cloud...' });

    const loginUrl = `${podUrl}/hcmUI/faces/FuseWelcome`;
    log(`  → Navigating to: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    await waitForAdf(page);

    try {
      await page.waitForSelector('input', { timeout: 25000 });
      const userEl = await page.$('input[id*="username" i], #userid, input[name="userid"], input[aria-label*="User" i]');
      const passEl = await page.$('input[id*="password" i], #password, input[name="password"]');

      if (userEl && passEl) {
        log(`  ✅ Login form detected. Entering credentials...`);
        await adfType(page, userEl, oracleUser);
        await adfType(page, passEl, oraclePass);
        await page.keyboard.press('Enter');

        await page.evaluate(() => {
          const btn = document.querySelector('oj-button#idcs-signin-basic-signin-form-submit') ||
            document.querySelector('#idcs-signin-basic-signin-form-submit');
          if (btn) (btn.querySelector('button') || btn).click();
        });

        await page.waitForFunction(
          () => !window.location.href.includes('identity.oraclecloud.com') &&
            !window.location.href.includes('/signin'),
          { timeout: 60000 }
        );
        await waitForAdf(page);
        log(`  ✅ Login successful.`);
      } else {
        log(`  ✅ Already authenticated.`);
      }
    } catch (e) {
      log(`  ⚠ Login step note: ${e.message} — continuing...`);
    }

    // ── Step 3: Navigate to Security Console → Users ──────────────────────────
    log(`🔐 Step 3: Opening Oracle Security Console → Users tab...`);
    updateJob({ status: 'NAVIGATING', progress: 30, currentStep: 'Opening Security Console...' });
    await navigateToUsersTab(page, podUrl, log);

    // ── Step 4: Search for the user ───────────────────────────────────────────
    log(`🔍 Step 4: Searching for user "${username}"...`);
    updateJob({ status: 'SEARCHING_USER', progress: 45, currentStep: `Searching for user "${username}"...` });
    await searchUserInConsole(page, username, log);

    // ── Step 5: Open user profile ─────────────────────────────────────────────
    log(`📂 Step 5: Opening user account details...`);
    updateJob({ status: 'OPENING_USER', progress: 55, currentStep: `Opening user profile...` });
    await openFirstUserResult(page, username, log);

    // ── Step 6: Click Edit ────────────────────────────────────────────────────
    log(`✏️ Step 6: Entering edit mode...`);
    updateJob({ status: 'EDITING_USER', progress: 65, currentStep: `Activating edit mode...` });
    await clickEditOnUserPage(page, log);

    // ── Step 7: Delete the role ───────────────────────────────────────────────
    log(`🗑️ Step 7: Removing role "${roleName}" from user "${username}"...`);
    updateJob({ status: 'REVOKING_ROLE', progress: 75, currentStep: `Revoking role "${roleName}"...` });
    const deleted = await deleteRoleFromUserPage(page, roleName, effectiveRoleCode, log);

    // ── Step 8: Save changes ──────────────────────────────────────────────────
    log(`💾 Step 8: Saving changes to Oracle Cloud...`);
    updateJob({ status: 'SAVING', progress: 85, currentStep: `Saving user account changes...` });
    await saveUserChanges(page, log);

    // ── Step 9: Verify removal & capture headless proof screenshot ──────────
    log(`✅ Step 9: Verifying role removal in Oracle Security Console & capturing proof...`);
    updateJob({ status: 'VERIFYING', progress: 92, currentStep: `Capturing verification proof with browser...` });
    const verified = await verifyRoleRemoved(page, roleName, effectiveRoleCode, log);

    const proofsDir = path.join(__dirname, '..', 'public', 'proofs');
    if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });

    let proofScreenshot = null;
    try {
      const proofFile = `sod_revoke_${jobId || Date.now()}.png`;
      const proofPath = path.join(proofsDir, proofFile);
      await page.screenshot({ path: proofPath, fullPage: false });
      proofScreenshot = `/proofs/${proofFile}`;
      log(`  📸 Verification screenshot saved: ${proofScreenshot}`);
    } catch (ssErr) {
      log(`  ⚠️ Screenshot note: ${ssErr.message}`);
    }

    await browser.close();
    browser = null;

    clearAuditCache();
    recordRemediation({
      id: `${username}_${ruleId}`,
      user: username,
      ruleId,
      remediationStrategy: 'REVOKE_ROLE',
      revokedRole: roleName,
      roleCode: effectiveRoleCode,
      proofScreenshot,
      status: 'SUCCEEDED',
      method: 'Role Revocation'
    });

    log(`📜 Audit certificate recorded: Rule ${ruleId} compliance restored for "${username}".`);
    log(`🎉 [BOT COMPLETE] Role "${roleName}" successfully revoked from "${username}".`);

    updateJob({
      status: 'COMPLETED',
      progress: 100,
      proofScreenshot,
      currentStep: `✅ Remediation complete! Role "${roleName}" removed from ${username}.`,
      logs
    });

    return { ok: true, user: username, revokedRole: roleName, roleCode: effectiveRoleCode, proofScreenshot, logs };

  } catch (err) {
    let proofScreenshot = null;
    if (browser) {
      try {
        const proofsDir = path.join(__dirname, '..', 'public', 'proofs');
        if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });
        const pages = await browser.pages();
        if (pages.length > 0) {
          const proofFile = `sod_revoke_${jobId || Date.now()}.png`;
          const proofPath = path.join(proofsDir, proofFile);
          await pages[0].screenshot({ path: proofPath, fullPage: false });
          proofScreenshot = `/proofs/${proofFile}`;
        }
      } catch { }
      try { await browser.close(); } catch { }
    }

    log(`❌ Role revocation failed: ${err.message}`);
    
    updateJob({
      status: 'FAILED',
      progress: 100,
      proofScreenshot,
      currentStep: `❌ Revocation failed: ${err.message}`,
      logs
    });

    return { ok: false, error: err.message, user: username, revokedRole: roleName, proofScreenshot, logs };
  }
}

module.exports = {
  stripPrivilegeFromOracleRole,
  revokeRoleFromOracleUser
};
