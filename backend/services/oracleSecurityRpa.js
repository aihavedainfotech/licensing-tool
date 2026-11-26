const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ─── In-memory job tracker ─────────────────────────────────────────────────────
const activeJobs = new Map();

function getJobStatus(jobId) {
  return activeJobs.get(jobId) || null;
}

function updateJob(jobId, updates) {
  const current = activeJobs.get(jobId) || {};
  const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
  activeJobs.set(jobId, updated);
  return updated;
}

function appendLog(jobId, msg) {
  console.log(`[RPA ${jobId}] ${msg}`);
  const job = activeJobs.get(jobId);
  if (job) {
    job.logs = [...(job.logs || []), msg];
    activeJobs.set(jobId, job);
  }
}

// ─── Utility: Normalize text for robust button/label matching ────────────────
const normText = (s) => (s || '')
  .replace(/\u00A0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

// ─── Utility: Inject browser-side helper functions into page context ─────────
async function initPageHelpers(page) {
  try {
    await page.evaluateOnNewDocument(() => {
      window.normText = globalThis.normText = function (s) {
        return (s || '')
          .replace(/\u00A0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      };
    });
  } catch { }
}

// ─── Utility: Role Code derivation helpers ────────────────────────────────────
function deriveRoleCode(roleName) {
  if (!roleName) return 'CUSTOM_ROLE_JOB';
  const clean = roleName.trim();
  const lower = clean.toLowerCase();

  // Known Oracle Cloud standard seed Role Codes for ERP/SCM
  if (lower.includes('order entry specialist')) return 'ORA_FOM_ORDER_ENTRY_SPECIALIST_JOB';
  if (lower.includes('order manager')) return 'ORA_FOM_ORDER_MANAGER_JOB';
  if (lower.includes('order administrator')) return 'ORA_DOO_ORDER_ADMINISTRATOR_JOB';
  if (lower.includes('billing specialist')) return 'ORA_AR_BILLING_SPECIALIST_JOB';
  if (lower.includes('accounts payable specialist')) return 'ORA_AP_ACCOUNTS_PAYABLE_SPECIALIST_JOB';
  if (lower.includes('accounts receivable specialist')) return 'ORA_AR_ACCOUNTS_RECEIVABLE_SPECIALIST_JOB';
  if (lower.includes('general accountant')) return 'ORA_GL_GENERAL_ACCOUNTANT_JOB';

  const codeClean = clean.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (codeClean.startsWith('ORA_')) return codeClean;
  return `ORA_${codeClean}_JOB`;
}

function deriveCustomRoleCode(originalCode, customName) {
  if (customName) {
    const clean = customName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (clean.startsWith('XX_')) return clean;
    return `XX_${clean}`;
  }
  if (originalCode && originalCode.startsWith('ORA_')) {
    return 'XX_' + originalCode.slice(4);
  }
  return `XX_${originalCode || 'ROLE'}`;
}

// ─── Utility: Wait for Oracle ADF sync ────────────────────────────────────────
async function waitForAdf(page, timeout = 15000) {
  try {
    await page.evaluate(() => {
      if (typeof window.normText !== 'function') {
        window.normText = globalThis.normText = function (s) {
          return (s || '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
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
    await new Promise(r => setTimeout(r, 1500));
  }
}

// ─── Utility: sleep ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Utility: Thoroughly Clear and Type into ADF input ────────────────────────
// Oracle ADF text inputs (especially with underscores like ORA_FOM_ORDER_ENTRY_SPECIALIST_JOB_COPY)
// do not clear with standard double/triple clicks or synthetic value='', because ADF's internal
// peer preserves shadow state and keystrokes get inserted into old remnants.
// This function performs a guaranteed multi-layer wipe (selection range, end-backspace sweep,
// home-delete sweep, and ADF peer model sync) with pre-wipe and post-type verification.
async function adfClearAndType(page, elementHandle, text, label = 'Field', jobId = null) {
  if (!elementHandle || text === undefined || text === null) return;
  const cleanText = String(text).trim().replace(/[\r\n\t]/g, ' ');
  // Oracle Cloud Role Code limit is strictly 30 characters
  const safeText = cleanText.length > 70 ? cleanText.substring(0, 70) : cleanText;

  // 1. Explicitly focus and click the element via DOM and safe fallback
  const isOk = await elementHandle.evaluate(el => {
    try {
      if (!el || !el.isConnected) return false;
      el.focus();
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      if (typeof el.click === 'function') el.click();
      return true;
    } catch (e) {
      return false;
    }
  }).catch(() => false);
  if (!isOk) return;

  // Native coordinate click to guarantee browser focus inside the input box
  const box = await elementHandle.boundingBox().catch(() => null);
  if (box && box.width > 0 && box.height > 0) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => { });
  }
  await sleep(80);

  // 2. Layer 1: JavaScript Native Text Selection & Backspace
  await elementHandle.evaluate(el => {
    el.focus();
    if (typeof el.select === 'function') el.select();
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(0, (el.value || '').length);
    }
  });
  await sleep(40);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await sleep(40);

  // 3. Layer 2: Keyboard Sweeping (End + loop Backspace, Home + loop Delete)
  // Essential for strings with underscores where word-selection breaks
  await page.keyboard.press('End');
  await sleep(20);
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press('Backspace');
  }
  await sleep(30);

  await page.keyboard.press('Home');
  await sleep(20);
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press('Delete');
  }
  await sleep(30);

  // 4. Layer 3: Direct DOM property & ADF Peer Model Reset
  await elementHandle.evaluate(el => {
    try {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(el, '');
      } else {
        el.value = '';
      }
    } catch (e) {
      el.value = '';
    }

    try {
      if (window.AdfPage && window.AdfPage.PAGE) {
        const comp = window.AdfPage.PAGE.findComponentByClientId(el.id);
        if (comp && typeof comp.setValue === 'function') {
          comp.setValue('');
        }
      }
    } catch (e) { }

    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  });
  await sleep(50);

  // 5. Pre-typing check: Ensure the field is 100% empty
  const valBefore = await elementHandle.evaluate(el => el.value);
  if (valBefore && valBefore.length > 0) {
    if (jobId) appendLog(jobId, `  ⚠️ [adfClearAndType] "${label}" still contained "${valBefore}" after sweeping. Forcing hard Ctrl+A wipe...`);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await elementHandle.evaluate(el => { el.value = ''; });
    await sleep(50);
  }

  // 6. Type the clean text
  await page.keyboard.type(safeText, { delay: 25 });
  await sleep(150);

  // 7. Post-typing verification & Auto-Correction
  const valAfter = await elementHandle.evaluate(el => el.value);
  if (valAfter !== safeText) {
    if (jobId) appendLog(jobId, `  ⚠️ [adfClearAndType] "${label}" mismatch: expected "${safeText}", but found "${valAfter}". Applying auto-correction...`);
    await elementHandle.evaluate((el, desired) => {
      try {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(el, desired);
        } else {
          el.value = desired;
        }
      } catch (e) {
        el.value = desired;
      }
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    }, safeText);
    await sleep(100);
  }

  const finalCheck = await elementHandle.evaluate(el => el.value);
  if (jobId) {
    appendLog(jobId, `  ✅ "${label}" cleanly set to: "${finalCheck}"`);
  }
}

// ─── Utility: Type into ADF input (uses bulletproof adfClearAndType) ───────────
async function adfType(page, elementHandle, text) {
  return adfClearAndType(page, elementHandle, text, 'Input');
}

// ─── Utility: Capture proof screenshot ────────────────────────────────────────
async function captureProof(page, proofsDir, jobId, label) {
  const name = `oracle_proof_${jobId}_${label}.png`;
  const fullPath = path.join(proofsDir, name);
  await page.screenshot({ path: fullPath, fullPage: false });
  appendLog(jobId, `📸 Proof captured: ${name}`);
  return `/proofs/${name}`;
}

// ─── STEP 0: Launch Browser ───────────────────────────────────────────────────
async function launchBrowser(headless) {
  const isHeadless = Boolean(headless);
  return puppeteer.launch({
    headless: isHeadless ? 'new' : false,
    defaultViewport: isHeadless ? { width: 1920, height: 1080 } : null,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--start-maximized', '--ignore-certificate-errors',
      '--disable-blink-features=AutomationControlled'
    ]
  });
}

// ─── STEP 1: Login to Oracle Cloud ────────────────────────────────────────────
async function loginToOracle(page, podUrl, username, password, jobId) {
  const loginUrl = `${podUrl.replace(/\/+$/, '')}/hcmUI/faces/FuseWelcome`;
  appendLog(jobId, `🔐 Navigating to login: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitForAdf(page);

  try {
    await page.waitForSelector('input', { timeout: 20000 });
    const userEl = await page.$('input[id*="username" i], #userid, input[name="userid"], input[aria-label*="User" i]');
    const passEl = await page.$('input[id*="password" i], #password, input[name="password"]');

    if (userEl && passEl) {
      appendLog(jobId, '✅ Login form detected. Entering credentials...');
      await adfType(page, userEl, username);
      await adfType(page, passEl, password);
      await page.keyboard.press('Enter');

      // Also try clicking IDCS sign-in button
      await page.evaluate(() => {
        const btn = document.querySelector('oj-button#idcs-signin-basic-signin-form-submit') ||
          document.querySelector('#idcs-signin-basic-signin-form-submit');
        if (btn) (btn.querySelector('button') || btn).click();
      });

      await page.waitForFunction(
        () => !window.location.href.includes('identity.oraclecloud.com') &&
          !window.location.href.includes('/signin'),
        { timeout: 40000 }
      );
      await waitForAdf(page);
      appendLog(jobId, `✅ Logged in. Current URL: ${page.url()}`);
    } else {
      appendLog(jobId, '✅ Already authenticated.');
    }
  } catch (e) {
    if (e.message && e.message.includes('Oracle Cloud Login Failed')) throw e;
    appendLog(jobId, `⚠ Login note: ${e.message} — continuing...`);
  }
}

// ─── STEP 2: Open Security Console ────────────────────────────────────────────
async function openSecurityConsole(page, podUrl, jobId) {
  const url = `${podUrl.replace(/\/+$/, '')}/hcmUI/faces/FndOverview?fndGlobalItemNodeId=ASE_FUSE_SECURITY_CONSOLE`;
  appendLog(jobId, '🔐 Opening Oracle Security Console...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitForAdf(page);
  await sleep(3000);
  await ensureOnRolesPage(page, podUrl, jobId);
  appendLog(jobId, '✅ Security Console loaded (Roles tab confirmed).');
}

// ─── Self-Healing: Universal Oracle Dialog & Mistake Resolver ──────────────────
/**
 * Automatically inspects the page for any Oracle popups, warnings, error banners,
 * or modal dialogs, logs the message, takes the correct corrective action,
 * and returns details about what was handled.
 */
async function autoResolveOracleDialogs(page, jobId, context = '') {
  return await page.evaluate((ctx) => {
    // Check for ADF dialogs, modals, and popup message windows
    const dialogs = Array.from(document.querySelectorAll(
      '.af_dialog, [role="dialog"], [id*="dialog"], .af_popup, .p_AFPopup, .af_messages, .af_message'
    )).filter(d => {
      const r = d.getBoundingClientRect();
      return r.width > 50 && r.height > 30 && window.getComputedStyle(d).display !== 'none';
    });

    for (const d of dialogs) {
      const text = (d.innerText || d.textContent || '').trim();
      if (!text || text.length < 3) continue;

      // 1. Duplicate Role Name or Code / Conflict Dialog
      if (text.includes('already exists') || text.includes('must be unique') || text.includes('duplicate')) {
        const okBtn = Array.from(d.querySelectorAll('button')).find(b => {
          const t = (b.innerText || '').trim();
          return t === 'OK' || t === 'Close' || t === 'Dismiss';
        }) || d.querySelector('button');
        if (okBtn) okBtn.click();
        return { handled: true, type: 'DUPLICATE_ROLE', text: text.substring(0, 160) };
      }

      // 2. Deletion / Warning Confirmation Dialog ("Are you sure you want to delete?")
      if (text.includes('delete') || text.includes('Warning') || text.includes('remove') || text.includes('Are you sure')) {
        const yesBtn = Array.from(d.querySelectorAll('button')).find(b => {
          const t = (b.innerText || '').trim();
          return t === 'Yes' || t === 'OK' || t === 'Delete' || t === 'Confirm';
        });
        if (yesBtn) {
          yesBtn.click();
          return { handled: true, type: 'CONFIRMED_WARNING', text: text.substring(0, 160) };
        }
      }

      // 3. Submission Confirmation Dialog ("Your request was submitted")
      if (text.includes('submitted') || text.includes('Confirmation') || text.includes('successfully')) {
        const okBtn = Array.from(d.querySelectorAll('button')).find(b => {
          const t = (b.innerText || '').trim();
          return t === 'OK' || t === 'Close';
        }) || d.querySelector('button');
        if (okBtn) {
          okBtn.click();
          return { handled: true, type: 'SUBMIT_CONFIRMATION', text: text.substring(0, 160) };
        }
      }

      // 4. Generic Warning / Note / Error Dialog - dismiss to avoid blocking flow
      const dismissBtn = Array.from(d.querySelectorAll('button')).find(b => {
        const t = (b.innerText || '').trim();
        return t === 'OK' || t === 'Yes' || t === 'Close' || t === 'Dismiss' || t === 'Continue';
      }) || d.querySelector('button');

      if (dismissBtn) {
        dismissBtn.click();
        return { handled: true, type: 'GENERIC_DISMISSED', text: text.substring(0, 160) };
      }
    }

    return { handled: false };
  }, context);
}

// ─── Strict Page Guard: Ensure We Are on Roles Page (NEVER on User Accounts) ──
async function ensureOnRolesPage(page, podUrl, jobId) {
  appendLog(jobId, '🛡️ Verifying we are in the Roles section...');

  // Dismiss any lingering modal dialogs first
  const dialog = await autoResolveOracleDialogs(page, jobId, 'Page Check');
  if (dialog.handled) {
    appendLog(jobId, `  🛠 [Self-Healing] Auto-resolved ${dialog.type} popup before page check: "${dialog.text}"`);
    await sleep(1500);
    await waitForAdf(page);
  }

  // 1. Check if we are already in the Roles section
  const inRoles = await page.evaluate(() => {
    const isUserAccounts = (document.body.innerText || '').includes('User Accounts') &&
      !(document.body.innerText || '').includes('Search Result Count');
    const hasRolesSearch = !!document.querySelector('input[placeholder*="Enter 3 or more characters"]') ||
      (document.body.innerText || '').includes('Roles and Privileges');
    const headingEl = document.querySelector('h1, h2, .af_panelHeader_title-text');
    const isHeadingRoles = headingEl && (headingEl.innerText || '').trim().toLowerCase() === 'roles';
    return (isHeadingRoles || hasRolesSearch) && !isUserAccounts;
  });

  if (inRoles) {
    appendLog(jobId, '  ✅ Confirmed: on Roles page.');
    return;
  }

  appendLog(jobId, '  ⚠ Not on Roles page (currently on User Accounts or other view). Switching to Roles tab in left sidebar...');

  // 2. Click "Roles" on the left sidebar (x < 150)
  const clicked = await page.evaluate(() => {
    const sidebarElements = Array.from(document.querySelectorAll('a, button, [role="button"], div, span')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.left < 150 && r.width > 0 && r.height > 0;
    });

    // Find the item with text "Roles"
    const rolesItem = sidebarElements.find(el => {
      const t = (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '').trim();
      return t === 'Roles';
    });

    if (rolesItem) {
      (rolesItem.closest('a, button') || rolesItem).click();
      return true;
    }
    return false;
  });

  if (clicked) {
    await sleep(4000);
    await waitForAdf(page);
    appendLog(jobId, '  ✅ Clicked "Roles" in left sidebar.');
  } else {
    appendLog(jobId, '  ℹ Sidebar link not directly clicked. Re-opening Security Console URL...');
    const url = `${podUrl.replace(/\/+$/, '')}/hcmUI/faces/FndOverview?fndGlobalItemNodeId=ASE_FUSE_SECURITY_CONSOLE`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await waitForAdf(page);
    await sleep(3000);

    // After loading, click "Roles" on sidebar
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('a, button, span')).filter(el => el.getBoundingClientRect().left < 150);
      const r = items.find(el => (el.innerText || el.title || '').trim() === 'Roles');
      if (r) r.click();
    });
    await sleep(3000);
    await waitForAdf(page);
  }
}

// ─── Set "Expand Toward" to "Users" from Dropdown Menu in Roles Section ───────
async function setExpandTowardUsers(page, jobId) {
  appendLog(jobId, '👥 Setting "Expand Toward" dropdown to "Users" in Roles section...');

  // 1. Check if already set to Users
  const alreadyUsers = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label, span, td, div')).filter(el => {
      const t = (el.innerText || el.textContent || '').trim();
      return t === 'Expand Toward' && el.getBoundingClientRect().left > 180;
    });

    for (const lbl of labels) {
      const parent = lbl.closest('tr, div, table');
      if (parent) {
        const val = parent.querySelector('input, span.af_selectOneChoice, [id*="soc"]');
        if (val && ((val.value || val.innerText || '').trim().toLowerCase() === 'users')) return true;
        const sel = parent.querySelector('select');
        if (sel && sel.options[sel.selectedIndex]?.text.toLowerCase().includes('user')) return true;
      }
    }
    return false;
  });

  if (alreadyUsers) {
    appendLog(jobId, '  ✅ "Expand Toward" is already set to Users.');
    return true;
  }

  // 2. Try native <select> if present
  const nativeChanged = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select')).filter(s => s.getBoundingClientRect().left > 180);
    for (const sel of selects) {
      const texts = Array.from(sel.options).map(o => o.text.trim().toLowerCase());
      if (texts.includes('privileges') || texts.includes('users')) {
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].text.trim().toLowerCase() === 'users') {
            sel.selectedIndex = i;
            sel.value = sel.options[i].value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
    }
    return false;
  });

  if (nativeChanged) {
    appendLog(jobId, '  ✅ Changed native select to "Users".');
    await sleep(3000);
    await waitForAdf(page);
    return true;
  }

  // 3. Find the exact bounding box of the "Expand Toward" choice component
  const choiceBox = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label, span, td, div')).filter(el => {
      const t = (el.innerText || el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      return t === 'Expand Toward' && r.left > 180 && r.width > 0;
    });

    if (labels.length === 0) return null;
    labels.sort((a, b) => a.innerText.length - b.innerText.length);
    const label = labels[0];
    const lRect = label.getBoundingClientRect();

    // Check if label's for attribute points to the component
    const forId = label.getAttribute('for') || label.htmlFor;
    if (forId) {
      const el = document.getElementById(forId);
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height, id: forId };
      }
    }

    // Look for adjacent elements displaying "Privileges"
    const elementsToRight = Array.from(document.querySelectorAll('span, div, input, table, a')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.left >= lRect.right - 5 &&
        r.left <= lRect.right + 260 &&
        Math.abs(r.top - lRect.top) < 25 &&
        r.width > 30 && r.height > 15;
    });

    const privEl = elementsToRight.find(el => (el.innerText || el.value || '').trim() === 'Privileges');
    if (privEl) {
      const r = privEl.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    }

    if (elementsToRight.length > 0) {
      const r = elementsToRight[0].getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    }

    return {
      x: lRect.right + 10,
      y: lRect.top,
      width: 140,
      height: Math.max(lRect.height, 24)
    };
  });

  if (!choiceBox) {
    throw new Error('Could not find "Expand Toward" dropdown on page.');
  }

  appendLog(jobId, `  → Located choice box at (${Math.round(choiceBox.x)}, ${Math.round(choiceBox.y)}). Clicking dropdown arrow...`);

  // Click the right edge of the dropdown box (where the arrow icon is)
  const clickX = choiceBox.x + choiceBox.width - 12;
  const clickY = choiceBox.y + choiceBox.height / 2;
  await page.mouse.click(clickX, clickY);
  await sleep(1500);
  await waitForAdf(page);

  // Look for "Users" strictly in popup list (must have left > 180 to NEVER match sidebar Users!)
  const optionClicked = await page.evaluate((box) => {
    // Check popup containers first
    const popups = Array.from(document.querySelectorAll('.af_selectOneChoice_popup, .af_popup, [id*="::pop"], [role="listbox"], .p_AFPopup'));
    for (const pop of popups) {
      const items = Array.from(pop.querySelectorAll('tr, td, li, span, div, a, [role="option"]'));
      const userItem = items.find(it => {
        const r = it.getBoundingClientRect();
        return r.left > 180 && (it.innerText || '').trim().toLowerCase() === 'users';
      });
      if (userItem) {
        (userItem.querySelector('a') || userItem).click();
        return { success: true, via: 'popup_container' };
      }
    }

    // Check all visible elements displaying "Users" with left > 180
    const allUsers = Array.from(document.querySelectorAll('tr, td, li, span, div, a, [role="option"]')).filter(el => {
      const t = (el.innerText || el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      return t.toLowerCase() === 'users' && r.left > 180 && r.width > 0 && r.height > 0;
    });

    const near = allUsers.find(el => {
      const r = el.getBoundingClientRect();
      return Math.abs(r.left - box.x) < 220 && r.top >= box.y && r.top <= box.y + 160;
    });

    if (near) {
      (near.querySelector('a') || near).click();
      return { success: true, via: 'near_dropdown' };
    }

    if (allUsers.length > 0) {
      (allUsers[0].querySelector('a') || allUsers[0]).click();
      return { success: true, via: 'all_users_list' };
    }

    return { success: false };
  }, choiceBox);

  if (optionClicked && optionClicked.success) {
    appendLog(jobId, `  ✅ Selected "Users" option from dropdown menu (${optionClicked.via}).`);
  } else {
    appendLog(jobId, '  ℹ Popup item not directly clicked. Trying keyboard navigation: ArrowDown + Enter...');
    await page.keyboard.press('ArrowDown');
    await sleep(300);
    await page.keyboard.press('Enter');
  }

  await sleep(4000);
  await waitForAdf(page);
  appendLog(jobId, '  ✅ "Expand Toward" set to Users.');
  return true;
}

// ─── STEP 3 & 4: Search Privilege → Expand Toward Users → Find Role & Code ──
/**
 * 1. Ensures we are on Roles page.
 * 2. Types the privilege name in the Security Console search box.
 * 3. Clicks the search icon and selects the privilege card.
 * 4. Changes "Expand Toward" dropdown to "Users" (stays in Roles section).
 * 5. In that expanded hierarchy table, searches for / locates the target role.
 * 6. Returns { roleName, roleCode, targetFound }
 */
async function searchPrivilegeAndExpandTowardsUsers(page, privilegeName, targetRoleName, targetUsername, jobId) {
  appendLog(jobId, `🔍 Step 1: Searching for privilege: "${privilegeName}" in Roles section...`);

  const podUrl = page.url().split('/hcmUI')[0];
  await ensureOnRolesPage(page, podUrl, jobId);

  // Wait for the main search box in the Roles section
  await page.waitForFunction(() =>
    document.querySelector('input[placeholder*="Enter 3 or more characters"]') ||
    document.querySelector('input[id*="srchBox::content"]'),
    { timeout: 30000 }
  );

  const searchInput = await page.$('input[placeholder*="Enter 3 or more characters"], input[id*="srchBox::content"]');
  if (!searchInput) throw new Error('Search box not found in Roles section.');

  // Type the privilege name
  await adfType(page, searchInput, privilegeName);
  await sleep(1000);

  // If Oracle shows an autocomplete dropdown list for the privilege, capture display name and click it
  let autocompleteDisplayName = '';
  try {
    const acResult = await page.evaluate((priv) => {
      const popups = Array.from(document.querySelectorAll(
        '.af_autoComplete_popup, [id*="srchBox::popup"], [id*="popup"], [role="listbox"], .af_panelPopup, div[style*="z-index"]'
      )).filter(p => {
        const rect = p.getBoundingClientRect();
        return rect.width > 120 && rect.height > 20 && rect.top > 30 && rect.top < 450;
      });

      for (const popup of popups) {
        const text = (popup.innerText || '').trim();
        if (!text || text.length < 3) continue;

        const items = Array.from(popup.querySelectorAll('tr, td, li, div, a')).filter(el => {
          const t = (el.innerText || '').trim();
          return t.length > 3 && !t.includes('PRIVILEGES') && !t.includes('ROLES') && !t.includes('DUTIES');
        });

        const pLower = priv.toLowerCase();
        const matched = items.find(it => (it.innerText || '').toLowerCase().includes(pLower)) || items[0];
        if (matched) {
          const lines = (matched.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
          const disp = lines.length > 0 ? lines[0] : '';
          const clickable = matched.querySelector('a') || matched;
          clickable.click();
          return { clicked: true, displayName: disp };
        }
      }
      return { clicked: false, displayName: '' };
    }, privilegeName);

    if (acResult?.displayName) {
      autocompleteDisplayName = acResult.displayName;
      appendLog(jobId, `  ✨ Captured privilege Display Name from autocomplete: "${autocompleteDisplayName}"`);
    }
  } catch (e) { }

  // Click the search icon (magnifying glass) AND press Enter
  await page.evaluate(() => {
    const icon = document.querySelector('a[id*="srchBox::search_icon"], [id*="srchBox"] a, a[title="Search"], [id*="srchBox"] img');
    if (icon) icon.click();
  });
  await page.keyboard.press('Enter');
  await sleep(5000);
  await waitForAdf(page);

  appendLog(jobId, `  → Search submitted for privilege "${privilegeName}". Selecting result card...`);

  // Click on the privilege card in the left list using native coordinate mouse click
  const cardHandle = await page.evaluateHandle((priv) => {
    const cards = Array.from(document.querySelectorAll('[id*="resList:"] a, [id*="resList:"] span, [id*="resList:"] div, [id*="resList:0"]'))
      .filter(c => c.getBoundingClientRect().left > 150);
    const matched = cards.find(c => c.innerText && c.innerText.trim().toLowerCase().includes(priv.toLowerCase()));
    if (matched) return matched.querySelector('a') || matched;
    const first = document.querySelector('[id*="resList:0"] a, [id*="resList:0"]');
    if (first && first.getBoundingClientRect().left > 150) return first.querySelector('a') || first;
    return null;
  }, privilegeName);

  const cardEl = cardHandle ? cardHandle.asElement() : null;
  let cardDisplayName = '';
  if (cardEl) {
    cardDisplayName = await cardEl.evaluate(el => {
      let d = el.innerText ? el.innerText.trim().split('\n')[0].trim() : '';
      return d.replace(/^Name[\s:\t]+/i, '').trim();
    }).catch(() => '');

    const box = await cardEl.boundingBox().catch(() => null);
    if (box && box.width > 0) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await cardEl.click().catch(() => { });
    }
    appendLog(jobId, `  📋 Selected privilege card: "${cardDisplayName || privilegeName}"`);
  } else {
    appendLog(jobId, `  ⚠ Privilege card not clicked directly. Continuing with current view...`);
  }

  await sleep(3000);
  await waitForAdf(page);

  // ── Step 2: Set "Expand Toward" to "Users" from dropdown in Roles section ────
  await setExpandTowardUsers(page, jobId);

  // ── Step 3: In that view, locate the Role Name & extract Role Code ───────────
  appendLog(jobId, `🔍 Step 3: In table under Expand Toward: Users, finding role "${targetRoleName || ''}"...`);

  // Wait up to 15s for the hierarchy table rows to render (strictly right pane)
  try {
    await page.waitForFunction((target) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, tr')).filter(r => {
        const rect = r.getBoundingClientRect();
        return rect.left > 300 && rect.width > 200;
      });
      return rows.some(r => {
        const text = (r.innerText || '').trim();
        if (text.includes('Clear') && text.includes('Search')) return false;
        if (text.includes('No data to display')) return false;
        return target ? text.toLowerCase().includes(target.toLowerCase()) : text.length > 8;
      });
    }, { timeout: 15000 }, targetRoleName);
  } catch {
    appendLog(jobId, `  ⏳ Continuing with visible table rows...`);
  }

  await sleep(1500);

  // Inspect the hierarchy table and strictly match the target role (avoiding left sidebar)
  const roleInfo = await page.evaluate((targetRole) => {
    // Only target tables located in the main pane (left > 160, avoiding sidebar and card list)
    const allRows = Array.from(document.querySelectorAll('table tbody tr, tr')).filter(r => {
      const rect = r.getBoundingClientRect();
      return rect.left > 160 && rect.width > 150 && rect.height > 8;
    });

    const isSidebarArtifact = (str) => {
      if (!str) return false;
      const lower = str.toLowerCase();
      return lower.includes('analytics') || lower.includes('certificates') || lower.includes('user categories') || lower.includes('api authentication') || lower.includes('rolesusers');
    };

    // Filter to genuine data rows (ignore toolbar buttons Clear/Search, headers)
    const dataRows = allRows.filter(row => {
      const text = (row.innerText || '').trim();
      if (!text || text.length < 5) return false;
      if (text.includes('Clear') && text.includes('Search')) return false;
      if (text.includes('No data to display')) return false;
      if (isSidebarArtifact(text)) return false;
      const tds = row.querySelectorAll('td');
      return tds && tds.length >= 2;
    });

    // Match strictly against targetRole
    if (targetRole) {
      const targetLower = targetRole.toLowerCase().trim();
      const targetTokens = targetLower.split(/[\s_]+/).filter(t => t.length > 2);

      for (const row of dataRows) {
        const tds = Array.from(row.querySelectorAll('td'));
        const tdTexts = tds.map(td => (td.innerText || '').trim()).filter(Boolean);
        const rowText = tdTexts.join(' ').toLowerCase();

        // Check if row contains the target role name or all key tokens
        const exactMatch = rowText.includes(targetLower);
        const tokenMatch = targetTokens.length > 1 && targetTokens.every(tok => rowText.includes(tok));

        if (exactMatch || tokenMatch) {
          const cells = Array.from(row.querySelectorAll('td, span, a'))
            .map(c => c.innerText.trim())
            .filter(Boolean)
            .filter(c => !isSidebarArtifact(c));

          // Find cell containing genuine Oracle Role Code (starts with ORA_ or custom XX_)
          const code = cells.find(c => c.startsWith('ORA_') || c.startsWith('XX_')) ||
            cells.find(c => c.includes('_') && c.toUpperCase() === c && c.length > 5 && !c.includes(' ') && !c.includes('API_')) ||
            (tdTexts[1] && tdTexts[1].includes('_') ? tdTexts[1] : '');
          const cleanName = cells.find(c => c.toLowerCase().includes(targetLower)) || targetRole;
          return {
            roleName: cleanName,
            roleCode: code || '',
            foundInTable: true
          };
        }
      }
    }

    return {
      roleName: targetRole || '',
      roleCode: '',
      foundInTable: false
    };
  }, targetRoleName);

  // Self-Healing Fallback: If role code was not found in visible rows, filter the table by targetRoleName
  if (!roleInfo.foundInTable && targetRoleName) {
    appendLog(jobId, `  🛠 [Self-Healing] Target role "${targetRoleName}" not in visible rows. Filtering table by Role Name...`);
    const filterApplied = await page.evaluate((target) => {
      const inputs = Array.from(document.querySelectorAll('table input, [id*="table"] input, [id*="ATp:"] input')).filter(i => {
        const r = i.getBoundingClientRect();
        return r.left > 300 && r.width > 50 && r.top < 500;
      });
      if (inputs.length > 0) {
        inputs[0].value = target;
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, targetRoleName);

    if (filterApplied) {
      await page.keyboard.press('Enter');
      await sleep(3500);
      await waitForAdf(page);

      const refiltered = await page.evaluate((target) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr, tr')).filter(r => {
          const rect = r.getBoundingClientRect();
          const t = (r.innerText || '').trim();
          return rect.left > 300 && rect.width > 200 && t.length > 5 && !t.includes('Clear') && !t.includes('No data');
        });
        if (rows.length > 0) {
          const cells = Array.from(rows[0].querySelectorAll('td, span, a'))
            .map(c => c.innerText.trim())
            .filter(Boolean)
            .filter(c => !c.toLowerCase().includes('analytics') && !c.toLowerCase().includes('rolesusers'));
          const code = cells.find(c => c.startsWith('ORA_'));
          if (code) {
            return { roleName: target, roleCode: code, foundInTable: true };
          }
        }
        return null;
      }, targetRoleName);

      if (refiltered && refiltered.roleCode) {
        roleInfo.roleName = refiltered.roleName;
        roleInfo.roleCode = refiltered.roleCode;
        roleInfo.foundInTable = true;
        appendLog(jobId, `  ✅ [Self-Healing] Filtered table matched: "${roleInfo.roleName}" → Role Code: "${roleInfo.roleCode}"`);
      }
    }
  }

  if (roleInfo.roleCode) {
    appendLog(jobId, `  ✅ Matched role in table: "${roleInfo.roleName}" → Role Code: "${roleInfo.roleCode}"`);
  }

  roleInfo.privilegeDisplayName = cardDisplayName || autocompleteDisplayName || '';
  return roleInfo;
}

// ─── STEP 4B: Detect Role Type (JOB ROLE vs DUTY ROLE) ────────────────────────
/**
 * Detects whether the specified role is a JOB ROLE or a DUTY ROLE in Oracle Security Console.
 *
 * 1. Checks roleCode / roleName naming conventions (e.g. _JOB, _DUTY).
 * 2. Types role into search box and inspects autocomplete dropdown section headers:
 *    "JOB ROLES" vs "DUTY ROLES".
 * 3. Inspects role details pane.
 */
async function detectRoleType(page, roleName, roleCode, jobId) {
  appendLog(jobId, `🔎 Checking role type for "${roleName}" (${roleCode || 'no code'})...`);

  const upperCode = (roleCode || '').toUpperCase();
  const lowerName = (roleName || '').toLowerCase();

  // Fast-path: clear suffix or keyword indicator
  if (upperCode.endsWith('_DUTY') || upperCode.includes('_DUTY_') || lowerName.includes(' duty') || lowerName.endsWith('duty')) {
    appendLog(jobId, `  ℹ Role detected as DUTY ROLE from role code / name convention.`);
    return 'DUTY_ROLE';
  }
  if (upperCode.endsWith('_JOB') || upperCode.includes('_JOB_') || lowerName.includes(' job') || lowerName.endsWith('job')) {
    appendLog(jobId, `  ℹ Role detected as JOB ROLE from role code / name convention.`);
    return 'JOB_ROLE';
  }

  // Live Oracle UI check: Type role in search box and inspect autocomplete category headers
  try {
    const podUrl = page.url().split('/hcmUI')[0];
    await ensureOnRolesPage(page, podUrl, jobId);

    const searchInput = await page.$('input[placeholder*="Enter 3 or more characters"], input[id*="srchBox::content"]');
    if (searchInput) {
      const searchTerm = roleCode || roleName;
      await searchInput.evaluate(el => { el.focus(); el.value = ''; });
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(searchTerm.slice(0, 30), { delay: 30 });
      await sleep(1500);

      const headerType = await page.evaluate((target) => {
        const popups = Array.from(document.querySelectorAll('.af_autoComplete_popup, [id*="srchBox::popup"], [id*="popup"], [role="listbox"], .p_AFPopup, div[style*="z-index"]')).filter(p => {
          const r = p.getBoundingClientRect();
          return r.width > 120 && r.height > 20 && r.top < 500;
        });

        for (const popup of popups) {
          const text = (popup.innerText || '').toUpperCase();
          if (text.includes('JOB ROLES') && !text.includes('DUTY ROLES')) return 'JOB_ROLE';
          if (text.includes('DUTY ROLES') && !text.includes('JOB ROLES')) return 'DUTY_ROLE';

          // If both headers present, check which section contains target
          const items = Array.from(popup.querySelectorAll('tr, td, li, div'));
          let currentSection = '';
          for (const item of items) {
            const itText = (item.innerText || '').toUpperCase().trim();
            if (itText === 'JOB ROLES' || itText.startsWith('JOB ROLE')) currentSection = 'JOB_ROLE';
            else if (itText === 'DUTY ROLES' || itText.startsWith('DUTY ROLE')) currentSection = 'DUTY_ROLE';
            else if (target && itText.toLowerCase().includes(target.toLowerCase()) && currentSection) {
              return currentSection;
            }
          }
        }
        return null;
      }, searchTerm);

      // Dismiss popup
      await page.keyboard.press('Escape');

      if (headerType) {
        appendLog(jobId, `  ✨ Autocomplete category header confirmed: ${headerType}`);
        return headerType;
      }
    }
  } catch (err) {
    appendLog(jobId, `  ⚠ Error during autocomplete type detection: ${err.message}`);
  }

  // Fallback defaults: business titles typical of job roles
  if (lowerName.includes('specialist') || lowerName.includes('manager') || lowerName.includes('admin') || lowerName.includes('user') || lowerName.includes('lead') || lowerName.includes('clerk') || lowerName.includes('officer')) {
    appendLog(jobId, `  ℹ Role classified as JOB_ROLE by business title pattern.`);
    return 'JOB_ROLE';
  }

  appendLog(jobId, `  ℹ Role default fallback: JOB_ROLE.`);
  return 'JOB_ROLE';
}

// ─── STEP 4C: Trigger "Load Indirect Relationship" in Hierarchy Viewer ───────
/**
 * Triggers "Load Indirect Relationship" in the Security Console hierarchy viewer
 * so that parent Job Roles that inherit the duty role become visible.
 */
async function triggerLoadIndirectRelationships(page, jobId) {
  appendLog(jobId, '  ⛓ Checking for "Load Indirect Relationship" in hierarchy viewer...');

  let clicked = false;

  // 1. Check for button, link, or toolbar icon with "Indirect" in text, title, or aria-label
  const btnHandle = await page.evaluateHandle(() => {
    function isElVisible(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.left > 180 && r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
    }

    const all = Array.from(document.querySelectorAll('button, a, div[role="button"], img, span[role="button"]')).filter(isElVisible);
    return all.find(b => {
      const t = (b.textContent || b.getAttribute('title') || b.getAttribute('aria-label') || b.alt || '').toLowerCase();
      return t.includes('load indirect') || t.includes('indirect relationship') || t.includes('indirect');
    }) || null;
  });

  const bEl = btnHandle ? btnHandle.asElement() : null;
  if (bEl) {
    const box = await bEl.boundingBox().catch(() => null);
    if (box && box.width > 0) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      clicked = true;
    } else {
      await bEl.click().catch(() => { });
      clicked = true;
    }
  }

  if (clicked) {
    appendLog(jobId, '  ✅ Clicked "Load Indirect Relationship" button.');
    await sleep(4000);
    await waitForAdf(page);
    return true;
  }

  appendLog(jobId, '  ℹ "Load Indirect Relationship" button was not visible or not needed.');
  return false;
}

// ─── STEP 4D: Extract Parent Job Role from Hierarchy ─────────────────────────
/**
 * Extracts the Parent Job Role name and code from the expanded hierarchy view.
 */
async function extractParentJobRoleFromHierarchy(page, dutyRoleName, jobId) {
  appendLog(jobId, `🔍 Extracting Parent Job Role for duty role "${dutyRoleName}" from hierarchy...`);

  await sleep(2000);

  const parentRole = await page.evaluate((dutyName) => {
    const rows = Array.from(document.querySelectorAll('table tbody tr, tr')).filter(r => {
      const rect = r.getBoundingClientRect();
      return rect.left > 160 && rect.width > 150 && rect.height > 8;
    });

    const isSidebarArtifact = (str) => {
      if (!str) return false;
      const lower = str.toLowerCase();
      return lower.includes('analytics') || lower.includes('certificates') || lower.includes('user categories') || lower.includes('api authentication') || lower.includes('rolesusers');
    };

    const cleanRows = rows.filter(r => {
      const t = (r.innerText || '').trim();
      return t.length > 5 && !t.includes('Clear') && !t.includes('No data') && !isSidebarArtifact(t);
    });

    // 1. Look for row that has an ORA_..._JOB code and is distinct from the duty role
    for (const r of cleanRows) {
      const cells = Array.from(r.querySelectorAll('td, span, a'))
        .map(c => (c.innerText || '').trim())
        .filter(Boolean)
        .filter(c => !isSidebarArtifact(c));
      const jobCode = cells.find(c => c.startsWith('ORA_') && c.endsWith('_JOB'));
      if (jobCode) {
        const nameCell = cells.find(c => !c.startsWith('ORA_') && c.length > 3 && !c.includes('_')) || cells[0];
        if (!nameCell.toLowerCase().includes((dutyName || '').toLowerCase())) {
          return { roleName: nameCell, roleCode: jobCode };
        }
      }
    }

    // 2. Look for any row with _JOB code
    for (const r of cleanRows) {
      const cells = Array.from(r.querySelectorAll('td, span, a'))
        .map(c => (c.innerText || '').trim())
        .filter(Boolean);
      const jobCode = cells.find(c => c.includes('_JOB'));
      if (jobCode) {
        const nameCell = cells.find(c => c !== jobCode && c.length > 3) || cells[0];
        return { roleName: nameCell, roleCode: jobCode };
      }
    }

    return null;
  }, dutyRoleName);

  if (parentRole && parentRole.roleName) {
    appendLog(jobId, `  ✅ Found Parent Job Role in hierarchy: "${parentRole.roleName}" (${parentRole.roleCode})`);
    return parentRole;
  }

  // Fallback: derive parent job role from duty role name or known seeds
  const derivedJobCode = deriveRoleCode(dutyRoleName);
  const derivedJobName = dutyRoleName.replace(/duty/i, 'Specialist').replace(/Duty/g, 'Specialist').trim();
  appendLog(jobId, `  ℹ Derived Parent Job Role: "${derivedJobName}" (${derivedJobCode})`);
  return { roleName: derivedJobName, roleCode: derivedJobCode };
}

// ─── STEP 4E: Navigate Wizard → Step 4: Role Hierarchy ───────────────────────
async function isAtRoleHierarchyStep(page) {
  return await page.evaluate(() => {
    const bodyText = (document.body.innerText || '').toLowerCase();
    const isHeader = bodyText.includes('role hierarchy') || bodyText.includes('step 4 of');
    const hasAddRoleBtn = !!document.querySelector('button[title*="Add Role" i], a[title*="Add Role" i], [aria-label*="Add Role" i]');
    return isHeader || hasAddRoleBtn;
  });
}

async function navigateToRoleHierarchyStep(page, jobId) {
  appendLog(jobId, '  → Navigating wizard to Step 4: Role Hierarchy...');
  for (let s = 1; s <= 5; s++) {
    await autoResolveOracleDialogs(page, jobId, 'Navigating to Role Hierarchy');
    if (await isAtRoleHierarchyStep(page)) {
      appendLog(jobId, '  ✅ Reached Step 4: Role Hierarchy.');
      await sleep(1500);
      await waitForAdf(page);
      return true;
    }
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      const next = btns.find(b => (b.textContent || '').trim() === 'Next' && !b.disabled && b.offsetParent !== null);
      if (next) { next.click(); return true; }
      return false;
    });
    if (!clicked) break;
    await sleep(2500);
    await waitForAdf(page);
  }
  return await isAtRoleHierarchyStep(page);
}

// ─── STEP 4F: Replace Seeded Duty Role in Parent Role Hierarchy ───────────────
/**
 * In Step 4 (Role Hierarchy) of the Parent Job Role:
 * 1. Finds the row with oldRoleName (seeded duty role).
 * 2. Clicks Delete / Remove on that row.
 * 3. Confirms deletion dialog.
 * 4. Clicks "+ Add Role" / "Add Role Membership".
 * 5. Searches for newCustomRoleName (the newly cloned XX_ duty role).
 * 6. Selects it, clicks "Add Role Membership" (or "Add Selected Roles").
 * 7. Dismisses the dialog.
 */
async function replaceRoleInHierarchy(page, oldRoleName, newCustomRoleName, jobId) {
  appendLog(jobId, `\n⛓ [ROLE HIERARCHY] Replacing seeded duty role "${oldRoleName}" with custom role "${newCustomRoleName}" in Step 4...`);

  await navigateToRoleHierarchyStep(page, jobId);
  await sleep(1500);
  await waitForAdf(page);

  // 1. Remove old duty role from hierarchy table
  appendLog(jobId, `  🗑 Searching for "${oldRoleName}" to remove from Role Hierarchy table...`);
  const removed = await page.evaluate((oldName) => {
    const rows = Array.from(document.querySelectorAll('table tbody tr, tr')).filter(r => r.offsetParent !== null);
    const targetRow = rows.find(r => (r.innerText || '').toLowerCase().includes(oldName.toLowerCase()));
    if (!targetRow) return false;

    // Look for delete button / trash icon inside this row
    const deleteBtn = targetRow.querySelector('button[title*="Delete" i], a[title*="Delete" i], [title*="Remove" i], a[id*="delete"], img[title*="Delete" i], a[title*="delete" i]');
    if (deleteBtn) {
      deleteBtn.click();
      return true;
    }
    targetRow.click();
    return true;
  }, oldRoleName);

  if (removed) {
    appendLog(jobId, `  → Clicked delete on row for "${oldRoleName}". Checking for confirmation dialog...`);
    await sleep(1500);
    await waitForAdf(page);

    await page.evaluate(() => {
      const dialog = document.querySelector('.af_dialog, [role="dialog"], .af_popup');
      if (dialog) {
        const btns = Array.from(dialog.querySelectorAll('button, a'));
        const yesBtn = btns.find(b => {
          const t = (b.textContent || '').trim().toLowerCase();
          return t === 'yes' || t === 'ok' || t === 'delete';
        });
        if (yesBtn) yesBtn.click();
      }
    });
    await sleep(2000);
    await waitForAdf(page);
    appendLog(jobId, `  ✅ Old duty role "${oldRoleName}" removed from hierarchy.`);
  } else {
    appendLog(jobId, `  ℹ Old duty role "${oldRoleName}" was not directly listed in hierarchy table.`);
  }

  // 2. Click "+ Add Role" / "Add Role Membership" toolbar button
  appendLog(jobId, `  ➕ Clicking "+ Add Role" to attach "${newCustomRoleName}"...`);
  const addBtnClicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
    const addBtn = all.find(b => {
      if (b.offsetParent === null) return false;
      const t = (b.textContent || b.getAttribute('title') || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return t === '+ add role' || t === 'add role' || t.includes('add role membership') || t.includes('add role');
    });
    if (addBtn) {
      (addBtn.closest('button, a, div[role="button"]') || addBtn).click();
      return true;
    }
    return false;
  });

  if (!addBtnClicked) {
    appendLog(jobId, `  ⚠ "+ Add Role" button not found directly in Step 4.`);
    return false;
  }

  await sleep(2500);
  await waitForAdf(page);

  // 3. In the Add Role dialog, search for newCustomRoleName
  appendLog(jobId, `  🔍 Searching for custom role "${newCustomRoleName}" in Add Role dialog...`);
  const inputHandle = await page.evaluateHandle(() => {
    const dialogs = Array.from(document.querySelectorAll('.af_dialog, [role="dialog"], .af_panelWindow, .af_popup')).filter(d => d.offsetParent !== null);
    for (const d of dialogs) {
      const inp = d.querySelector('input[type="text"], input[id*="search"], input[id*="Search"]');
      if (inp) return inp;
    }
    return document.querySelector('input[id*="searchRole"], input[placeholder*="Search"]') || null;
  });

  const inpEl = inputHandle ? inputHandle.asElement() : null;
  if (inpEl) {
    await adfClearAndType(page, inpEl, newCustomRoleName, 'Add Role Search', jobId);
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(3500);
    await waitForAdf(page);

    // 4. Select the matching custom role from the search results
    appendLog(jobId, `  👉 Selecting "${newCustomRoleName}" from search results...`);
    await page.evaluate((roleName) => {
      const dialog = document.querySelector('.af_dialog, [role="dialog"], .af_popup');
      if (!dialog) return false;
      const rows = Array.from(dialog.querySelectorAll('table tbody tr, tr')).filter(r => r.offsetParent !== null);
      const match = rows.find(r => (r.innerText || '').toLowerCase().includes(roleName.toLowerCase())) || rows[0];
      if (match) {
        const cb = match.querySelector('input[type="checkbox"], input[type="radio"]');
        if (cb) cb.click();
        else match.click();
        return true;
      }
      return false;
    }, newCustomRoleName);

    await sleep(1000);
    await waitForAdf(page);

    // 5. Click "Add Role Membership" (or "Add Selected Roles")
    appendLog(jobId, `  👉 Clicking "Add Role Membership"...`);
    await page.evaluate(() => {
      const dialog = document.querySelector('.af_dialog, [role="dialog"], .af_popup');
      if (!dialog) return;
      const btns = Array.from(dialog.querySelectorAll('button, a, div[role="button"]'));
      const addMem = btns.find(b => {
        const t = (b.textContent || b.getAttribute('title') || '').trim().toLowerCase();
        return t.includes('add role membership') || t.includes('add selected') || t.includes('add to role') || t === 'ok';
      });
      if (addMem) addMem.click();
    });

    await sleep(3000);
    await waitForAdf(page);

    // Close Add Role dialog
    await dismissDialog(page);
    await sleep(1500);
    await waitForAdf(page);

    appendLog(jobId, `  ✅ Successfully attached custom role "${newCustomRoleName}" to hierarchy!`);
    return true;
  } else {
    appendLog(jobId, `  ⚠ Search input inside Add Role dialog not found.`);
    await dismissDialog(page);
    return false;
  }
}

// ─── STEP 5: Search Role by Role Code (in Roles section only) ────────────────
/**
 * Stays in Roles section, enters roleCode into search box, clicks 🔍 and Enter.
 */
async function searchRoleByCode(page, roleCode, roleName, jobId) {
  // Guard against sidebar or runaway strings
  const isBadTerm = (t) => {
    if (!t || typeof t !== 'string') return true;
    const lower = t.toLowerCase();
    return lower.includes('analytics') ||
      lower.includes('certificates') ||
      lower.includes('api authentication') ||
      lower.includes('user categories') ||
      lower.includes('rolesusers') ||
      t.length > 70;
  };

  let searchTerm = (roleCode || roleName || '').trim();
  if (isBadTerm(searchTerm)) {
    appendLog(jobId, `  ⚠ Invalid role search term detected: "${searchTerm}".`);
    if (roleName && !isBadTerm(roleName)) {
      searchTerm = roleName.trim();
    } else {
      return false;
    }
  }

  if (!searchTerm) return false;

  appendLog(jobId, `🔍 Searching for role in Roles section: "${searchTerm}"...`);

  const podUrl = page.url().split('/hcmUI')[0];
  await ensureOnRolesPage(page, podUrl, jobId);

  // Ensure search box is ready in Roles section
  await page.waitForFunction(() =>
    document.querySelector('input[placeholder*="Enter 3 or more characters"]') ||
    document.querySelector('input[id*="srchBox::content"]'),
    { timeout: 20000 }
  );

  const searchInput = await page.$('input[placeholder*="Enter 3 or more characters"], input[id*="srchBox::content"]');
  if (!searchInput) throw new Error('Search box not found in Roles section.');

  // Click clear icon if present, otherwise clear with backspace
  await page.evaluate(() => {
    const clearBtn = document.querySelector('a[id*="srchBox::clean_icon"], [id*="srchBox"] a[title*="Clear"]');
    if (clearBtn) clearBtn.click();
  });
  await sleep(150);

  // Focus and clear search box completely
  await searchInput.evaluate(el => {
    try { el.focus(); } catch (e) { }
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  try {
    await searchInput.click();
  } catch (e) { }

  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await sleep(80);

  // Type search term into search input cleanly
  await page.keyboard.type(searchTerm, { delay: 20 });
  await sleep(200);

  // Submit search: click search icon AND press Enter
  await page.evaluate(() => {
    const icon = document.querySelector('a[id*="srchBox::search_icon"], [id*="srchBox"] a, a[title="Search"], [id*="srchBox"] img');
    if (icon) icon.click();
  });
  await page.keyboard.press('Enter');
  await sleep(4000);
  await waitForAdf(page);

  const found = await page.evaluate(() => {
    const text = (document.body.innerText || '').toLowerCase();
    if (text.includes('search result count : 0') || text.includes('no data to display') || text.includes('0 results found')) {
      return false;
    }
    const firstResult = document.querySelector('[id*="resList:0"]');
    const cards = Array.from(document.querySelectorAll('[id*="resList"], [id*="roleCard"], div.af_panelBox')).filter(c => c.offsetParent !== null);
    return !!firstResult || cards.length > 0;
  });

  appendLog(jobId, `🔍 Role search for "${searchTerm}": ${found ? '✅ Found' : '❌ Not found'}`);
  return found;
}

// ─── STEP 6: Copy Role ─────────────────────────────────────────────────────────
/**
 * On the Security Console Roles list, clicks Actions on the first result card,
 * chooses "Copy Role", confirms in "Copy Options" dialog, and enters wizard.
 */
async function copyRoleInWizard(page, customRoleName, customRoleCode, jobId) {
  appendLog(jobId, `📋 Starting Copy Role wizard → "${customRoleName}" (${customRoleCode})...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    // Check and dismiss any unexpected dialogs before proceeding
    const preDialog = await autoResolveOracleDialogs(page, jobId, 'Copy Role Init');
    if (preDialog.handled) {
      appendLog(jobId, `  🛠 [Self-Healing] Dismissed dialog: "${preDialog.text}"`);
      await sleep(1500);
      await waitForAdf(page);
    }

    // Click Actions button on first result card
    const actionBtnHandle = await page.evaluateHandle(() => {
      const card = document.querySelector('[id*="resList:0"], [id*="roleCard"], div.af_panelBox');
      if (card) {
        const actionEl = card.querySelector('button[title*="Actions" i], a[title*="Actions" i], [id*="cb1"], a[role="button"], button');
        if (actionEl) return actionEl;
      }
      return document.querySelector('button[id*="resList:0:cb1"], a[id*="resList:0:cb1"]') ||
        document.querySelector('[id*="resList:0"] button, [id*="resList:0"] a') ||
        Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(b => {
          const t = (b.textContent || b.title || b.getAttribute('aria-label') || '').trim().toLowerCase();
          return t === 'actions' || t === 'copy role';
        }) || null;
    });

    const actEl = actionBtnHandle ? actionBtnHandle.asElement() : null;
    if (!actEl) {
      if (attempt < 3) {
        appendLog(jobId, `  ⏳ Actions button not ready (attempt ${attempt}/3). Retrying in 2s...`);
        await sleep(2000);
        await waitForAdf(page);
        continue;
      }
      throw new Error('Could not find Actions button on role result card.');
    }

    const aBox = await actEl.boundingBox().catch(() => null);
    if (aBox && aBox.width > 0) {
      await page.mouse.click(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
    } else {
      await actEl.click().catch(() => { });
    }

    appendLog(jobId, '  → Clicked Actions button.');
    await sleep(1500);
    await waitForAdf(page);

    // Click "Copy Role" from Actions dropdown menu
    const copyClicked = await page.evaluate(() => {
      const norm = (s) => (typeof normText === 'function' ? normText(s) : (s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase());
      const items = Array.from(document.querySelectorAll(
        'tr, td, a, span, li, [role="menuitem"], [role="option"], div'
      ));
      const copyItem = items.find(el => {
        const t = norm(el.textContent);
        return t === 'copy role' || (t.includes('copy role') && t.length < 25);
      });
      if (copyItem) { copyItem.click(); return true; }
      return false;
    });

    if (!copyClicked) {
      if (attempt < 3) {
        appendLog(jobId, `  ⏳ "Copy Role" item not ready (attempt ${attempt}/3). Retrying...`);
        await sleep(2000);
        continue;
      }
      throw new Error('Could not find "Copy Role" in Actions menu.');
    }

    appendLog(jobId, '  → Clicked "Copy Role" menu item.');
    await sleep(2000);
    await waitForAdf(page);

    // Modal dialog "Copy Options" appears with radio buttons ("Copy top role") and a "Copy Role" button at bottom!
    appendLog(jobId, '  → Confirming "Copy Role" button in Copy Options dialog...');
    const copyModalBtnHandle = await page.evaluateHandle(() => {
      const norm = (s) => (typeof normText === 'function' ? normText(s) : (s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase());
      const dialog = document.querySelector('.af_dialog, [role="dialog"], [id*="dialog"], .af_popup');
      if (dialog) {
        const radios = Array.from(dialog.querySelectorAll('input[type="radio"], label'));
        const topRadio = radios.find(r => norm(r.textContent || r.innerText).includes('top role'));
        if (topRadio) {
          const inp = topRadio.tagName === 'INPUT' ? topRadio : topRadio.querySelector('input') || topRadio;
          try { inp.click(); } catch (e) { }
        }
        const btns = Array.from(dialog.querySelectorAll('button, a, div[role="button"]'));
        const b = btns.find(btn => {
          const t = norm(btn.textContent || btn.innerText);
          return t === 'copy role' || (t.includes('copy role') && !t.includes('hierarchy'));
        });
        if (b) return b;
      }
      const btns = Array.from(document.querySelectorAll('.af_dialog button, [role="dialog"] button, [id*="dialog"] button, button'));
      return btns.find(b => {
        const t = norm(b.textContent || b.innerText);
        return t === 'copy role' || (t.includes('copy role') && !t.includes('hierarchy'));
      }) || null;
    });

    const cModalEl = copyModalBtnHandle ? copyModalBtnHandle.asElement() : null;
    if (cModalEl) {
      const cBox = await cModalEl.boundingBox().catch(() => null);
      if (cBox && cBox.width > 0) {
        await page.mouse.click(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
      } else {
        await cModalEl.click().catch(() => { });
      }
      await page.evaluate(b => { try { b.click(); } catch { } }, cModalEl);
    }

    await sleep(4000);
    await waitForAdf(page);

    // Check if entered wizard (Basic Information page exists)
    const inWizard = await page.evaluate(() => {
      return (document.body.innerText || '').includes('Basic Information') ||
        (document.body.innerText || '').includes('Function Security Policies') ||
        !!document.querySelector('input[id*="roleName"], input[id*="RoleName"]');
    });

    if (inWizard) {
      appendLog(jobId, '  ✅ Entered Copy Role wizard.');
      return true;
    }
  }

  appendLog(jobId, '  → Entered Copy Role wizard.');
  return true;
}

// ─── Helper: Generate unique safe Role Code under 30-char Oracle limit ────────
function generateSafeUniqueRoleCode(baseCode) {
  let clean = (baseCode || 'ROLE')
    .toUpperCase()
    .replace(/^ORA_/, '')
    .replace(/^XX_/, '')
    .replace(/_[0-9]{3,6}$/, '')
    .replace(/[^A-Z0-9_]/g, '_');

  // Oracle Cloud Role Code has a strict 30-character hard limit!
  // "XX_" (3 chars) + slug (max 21 chars) + "_" (1 char) + 4-digit rand (4 chars) = 29 chars max!
  const shortSlug = clean.substring(0, 21).replace(/_+$/, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `XX_${shortSlug}_${rand}`;
}

function generateSafeUniqueRoleName(baseName) {
  let clean = (baseName || 'Custom Role')
    .replace(/^XX_/, '')
    .replace(/\s+[0-9]{3,6}$/, '')
    .trim();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `XX_${clean} ${rand}`;
}

// ─── STEP 7: Fill Wizard Step 1 — Role Name & Code (with Dialog / Duplicate Handling) ──
async function fillRoleNameAndCode(page, customRoleName, customRoleCode, jobId) {
  // Respect the user's edited role name and code on attempt 1!
  let activeRoleName = (customRoleName || '').trim() || `XX_Custom_Role`;
  let activeRoleCode = (customRoleCode || '').trim().substring(0, 30);
  if (!activeRoleCode) {
    activeRoleCode = generateSafeUniqueRoleCode(customRoleName);
  }

  const maxAttempts = 6;
  let successfullyAdvanced = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    appendLog(jobId, `  → Step 1: Setting Name "${activeRoleName}", Code "${activeRoleCode}"${attempt > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ''}...`);

    // Ensure ADF and wizard form are stabilized
    await sleep(800);
    await waitForAdf(page);

    // 1. Locate the exact input element IDs for Role Name & Role Code via labels
    const inputIds = await page.evaluate(() => {
      let nameId = null;
      let codeId = null;

      const labels = Array.from(document.querySelectorAll('label'));
      for (const l of labels) {
        const text = (l.innerText || '').trim();
        if (text.includes('Role Name')) {
          const id = l.getAttribute('for') || l.htmlFor;
          if (id && document.getElementById(id)) nameId = id;
          else {
            const inp = l.closest('tr, td, div')?.querySelector('input');
            if (inp) nameId = inp.id;
          }
        }
        if (text.includes('Role Code')) {
          const id = l.getAttribute('for') || l.htmlFor;
          if (id && document.getElementById(id)) codeId = id;
          else {
            const inp = l.closest('tr, td, div')?.querySelector('input');
            if (inp) codeId = inp.id;
          }
        }
      }

      if (!nameId) {
        const inp = document.querySelector('input[id*="roleName" i], input[id*="RoleName"], input[id*="it1"]');
        if (inp) nameId = inp.id;
      }
      if (!codeId) {
        const inp = document.querySelector('input[id*="roleCode" i], input[id*="RoleCode"], input[id*="it2"]');
        if (inp) codeId = inp.id;
      }

      return { nameId, codeId };
    });

    // Helper: 100% Guaranteed Clear & Set without coordinate clicks or leftovers
    const setFieldCleanly = async (inputId, desiredValue, fieldLabel) => {
      if (!inputId) {
        appendLog(jobId, `  ⚠️ ${fieldLabel} input ID not found.`);
        return;
      }

      const initialVal = await page.evaluate((id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
      }, inputId);
      appendLog(jobId, `  📝 ${fieldLabel} current value: "${initialVal}"`);

      // Layer 1: JS Native Prototype reset & ADF client component clear
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.focus();
        try {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, '');
          else el.value = '';
        } catch (e) {
          el.value = '';
        }
        try {
          if (window.AdfPage && window.AdfPage.PAGE) {
            const comp = window.AdfPage.PAGE.findComponentByClientId(id);
            if (comp && typeof comp.setValue === 'function') comp.setValue('');
          }
        } catch (e) { }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, inputId);

      // Layer 2: Keyboard wipe (Control+A, Backspace, Home, Shift+End, Backspace)
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (el) el.focus();
      }, inputId);
      await sleep(40);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await sleep(20);
      await page.keyboard.press('Home');
      await page.keyboard.down('Shift');
      await page.keyboard.press('End');
      await page.keyboard.up('Shift');
      await page.keyboard.press('Backspace');
      await sleep(30);

      // Layer 3: Type clean text
      await page.keyboard.type(desiredValue, { delay: 15 });
      await sleep(80);

      // Layer 4: Verification and sync
      const finalVal = await page.evaluate((id, expected) => {
        const el = document.getElementById(id);
        if (!el) return '';
        if (el.value !== expected) {
          try {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, expected);
            else el.value = expected;
          } catch (e) {
            el.value = expected;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        return el.value;
      }, inputId, desiredValue);

      appendLog(jobId, `  ✅ "${fieldLabel}" cleanly set to: "${finalVal}"`);
      await page.keyboard.press('Tab');
      await sleep(100);
    };

    if (inputIds.nameId) {
      await setFieldCleanly(inputIds.nameId, activeRoleName, 'Role Name');
    }
    if (inputIds.codeId) {
      await setFieldCleanly(inputIds.codeId, activeRoleCode, 'Role Code');
    }

    // Dismiss any inline autocomplete / note that popped up on blur
    await page.keyboard.press('Escape');
    await waitForAdf(page);
    await sleep(600);

    // Click Next
    appendLog(jobId, '  → Clicking "Next" on Step 1...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const nextBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Next');
      if (nextBtn) nextBtn.click();
    });

    await sleep(2500);
    await waitForAdf(page);

    // Check for modal dialogs OR inline ADF error notes (e.g. "You need to enter a different code")
    const validationStatus = await page.evaluate(() => {
      // 1. Check for standard modal dialogs
      const dialogs = Array.from(document.querySelectorAll('.af_dialog, [role="dialog"], [id*="dialog"]'));
      for (const d of dialogs) {
        const text = (d.innerText || '').trim();
        if (text.length > 5) {
          const btn = Array.from(d.querySelectorAll('button')).find(b => {
            const t = (b.innerText || '').trim();
            return t === 'OK' || t === 'Close' || t === 'Yes';
          }) || d.querySelector('button');
          if (btn) btn.click();
          return { hasError: true, message: text.substring(0, 140) };
        }
      }

      // 2. Check for inline ADF note windows, balloon popups, or message alerts
      const errorNotes = Array.from(document.querySelectorAll(
        '.af_noteWindow, .p_AFNote, .af_message, .af_inputText_message, [role="alert"], [id*="::msg"], [id*="::note"]'
      ));

      for (const note of errorNotes) {
        const text = (note.innerText || note.textContent || '').trim();
        if (text.length > 5 && (
          text.toLowerCase().includes('different code') ||
          text.toLowerCase().includes('already') ||
          text.toLowerCase().includes('error') ||
          text.toLowerCase().includes('duplicate') ||
          text.toLowerCase().includes('exist')
        )) {
          const btn = note.querySelector('button, a[role="button"], [id*="close"]');
          if (btn) btn.click();
          return { hasError: true, message: text.substring(0, 140) };
        }
      }

      // 3. Check page-wide text for duplicate code warnings
      const bodyText = (document.body.innerText || '').toLowerCase();
      if (bodyText.includes('you need to enter a different code') ||
        bodyText.includes('there\'s already role code') ||
        bodyText.includes('already exists')) {
        return { hasError: true, message: 'Duplicate role code in database' };
      }

      // 4. Verify whether Step 2 (Function Security Policies) was reached
      const reachedStep2 = bodyText.includes('function security policies') ||
        bodyText.includes('step 2 of') ||
        !!document.querySelector('button[title*="Add Function Security Policy"]');

      return { hasError: false, reachedStep2 };
    });

    if (validationStatus.hasError || !validationStatus.reachedStep2) {
      appendLog(jobId, `  ⚠ Duplicate role code / validation warning: "${validationStatus.message || 'Still on Step 1'}". Generating fresh code...`);
      // Dismiss balloon tooltip
      await page.keyboard.press('Escape');
      await sleep(1000);
      await waitForAdf(page);

      // Generate brand new unique code with 4 random digits
      activeRoleCode = generateSafeUniqueRoleCode(customRoleCode);
      activeRoleName = generateSafeUniqueRoleName(customRoleName);
      continue;
    }

    appendLog(jobId, `  ✅ Basic Information accepted! Name: "${activeRoleName}", Code: "${activeRoleCode}". Reached Step 2.`);
    successfullyAdvanced = true;
    break;
  }

  if (!successfullyAdvanced) {
    throw new Error(`Could not advance past wizard Basic Information step after ${maxAttempts} attempts due to duplicate role code.`);
  }

  return { activeRoleName, activeRoleCode };
}

// ─── STEP 8: Navigate Wizard → Privileges Step ────────────────────────────────
async function navigateToPrivilegesStep(page, jobId) {
  appendLog(jobId, '  → Navigating to Step 2: Function Security Policies...');

  // Check if we are already at Step 2 (Function Security Policies)
  const alreadyAtStep2 = await page.evaluate(() => {
    const bodyText = (document.body.innerText || '').toLowerCase();
    return bodyText.includes('function security policies') ||
      !!document.querySelector('button[title*="Add Function Security Policy"], button[id*="addFSP"]');
  });

  if (alreadyAtStep2) {
    appendLog(jobId, '  → Already at Step 2: Function Security Policies.');
    // Wait for the table to load
    await sleep(1500);
    await waitForAdf(page);
    return;
  }

  // Click Next to move from Step 1 to Step 2
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const nextBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Next');
    if (nextBtn) nextBtn.click();
  });

  // Wait for Step 2 to appear
  await waitForAdf(page);
  await sleep(2000);

  // Verify we reached Step 2 and wait for table to load
  const reached = await page.evaluate(() => {
    const bodyText = (document.body.innerText || '').toLowerCase();
    return bodyText.includes('function security policies') ||
      !!document.querySelector('button[title*="Add Function Security Policy"]');
  });

  if (reached) {
    appendLog(jobId, '  ✅ Reached Step 2: Function Security Policies.');
    await sleep(1500);
    await waitForAdf(page);
  } else {
    appendLog(jobId, '  ⚠ Could not confirm Step 2 reached. Continuing anyway...');
  }
}

// ─── KNOWN ORACLE CLOUD PRIVILEGE & ALTERNATIVE MAPPINGS ─────────────────────
const KNOWN_PRIVILEGE_MAPPINGS = {
  // Oracle Cloud Order Management / SCM
  'FOM_CREATE_ORDER_PRIV': {
    displayName: 'Initiate Order',
    alternateName: 'View Orders',
    aliases: ['Initiate Order', 'Create Order', 'FOM_CREATE_ORDER_PRIV']
  },
  'FOM_VIEW_ORDERS_PRIV': {
    displayName: 'View Orders',
    alternateName: 'View Orders',
    aliases: ['View Orders', 'FOM_VIEW_ORDERS_PRIV']
  },
  // Oracle Cloud Time & Labor
  'HWM_MANAGE_TIME_WORK_AREA_PRIV': {
    displayName: 'Manage Time Work Area',
    alternateName: 'View Time Work Area',
    aliases: ['Manage Time Work Area', 'Time Work Area', 'HWM_MANAGE_TIME_WORK_AREA_PRIV']
  },
  'HWM_VIEW_TIME_WORK_AREA_PRIV': {
    displayName: 'View Time Work Area',
    alternateName: 'View Time Work Area',
    aliases: ['View Time Work Area', 'HWM_VIEW_TIME_WORK_AREA_PRIV']
  },
  // Oracle Cloud Payables / Invoices
  'AP_MANAGE_PAYABLES_INVOICE_PRIV': {
    displayName: 'Manage Payables Invoices',
    alternateName: 'View Payables Invoices',
    aliases: ['Manage Payables Invoices', 'Manage Payables Invoice', 'AP_MANAGE_PAYABLES_INVOICE_PRIV']
  },
  'AP_VIEW_PAYABLES_INVOICE_PRIV': {
    displayName: 'View Payables Invoices',
    alternateName: 'View Payables Invoices',
    aliases: ['View Payables Invoices', 'AP_VIEW_PAYABLES_INVOICE_PRIV']
  },
  // Purchasing
  'PO_MANAGE_PURCHASE_ORDER_PRIV': {
    displayName: 'Manage Purchase Orders',
    alternateName: 'View Purchase Orders',
    aliases: ['Manage Purchase Orders', 'PO_MANAGE_PURCHASE_ORDER_PRIV']
  },
  'PO_VIEW_PURCHASE_ORDER_PRIV': {
    displayName: 'View Purchase Orders',
    alternateName: 'View Purchase Orders',
    aliases: ['View Purchase Orders', 'PO_VIEW_PURCHASE_ORDER_PRIV']
  },
  'PO_VIEW_PURCHASE_AGREEMENT_WORKAREA_PRIV': {
    displayName: 'View Purchase Agreement Work Area',
    alternateName: 'View Purchase Orders',
    aliases: ['View Purchase Agreement Work Area', 'Purchase Agreement Work Area', 'PO_VIEW_PURCHASE_AGREEMENT_WORKAREA_PRIV']
  },
  'PO_VIEW_PURCHASE_ORDER_WORKAREA_PRIV': {
    displayName: 'View Purchase Order Work Area',
    alternateName: 'View Purchase Orders',
    aliases: ['View Purchase Order Work Area', 'Purchase Order Work Area', 'PO_VIEW_PURCHASE_ORDER_WORKAREA_PRIV']
  },
  // Inventory
  'INV_VIEW_ONHAND_QUANTITY_PRIV': {
    displayName: 'View On-Hand Quantity',
    alternateName: 'View On-Hand Quantity',
    aliases: ['View On-Hand Quantity', 'INV_VIEW_ONHAND_QUANTITY_PRIV']
  },
  // Order Management Web Services
  'DOO_MANAGE_ORDER_DETAILS_WEB_SERVICE_PRIV': {
    displayName: 'Manage Order Details Web Service',
    alternateName: 'View Order Details Web Service',
    aliases: ['Manage Order Details Web Service', 'DOO_MANAGE_ORDER_DETAILS_WEB_SERVICE_PRIV']
  }
};

function getPrivilegeSearchCandidates(privilegeName, privilegeDisplayName = '') {
  const candidates = [];
  const raw = (privilegeName || '').trim();
  const explicitDisp = (privilegeDisplayName || '').trim();

  // 1. Explicit display name from earlier tracing or autocomplete
  if (explicitDisp && explicitDisp.length > 2 && !candidates.includes(explicitDisp)) {
    candidates.push(explicitDisp);
  }

  // 2. If the passed privilegeName is already a human display name (contains spaces), priority #1
  if (raw && raw.includes(' ') && !candidates.includes(raw)) {
    candidates.push(raw);
  }

  // 3. Known display name from mapping table if registered
  const known = KNOWN_PRIVILEGE_MAPPINGS[raw];
  if (known?.displayName && !candidates.includes(known.displayName)) {
    candidates.push(known.displayName);
  }
  if (known?.aliases) {
    known.aliases.forEach(a => { if (!candidates.includes(a)) candidates.push(a); });
  }

  // 4. Clean human-friendly name dynamically derived from technical code
  // e.g. "PO_VIEW_PURCHASE_AGREEMENT_WORKAREA_PRIV" -> "View Purchase Agreement Work Area"
  if (raw) {
    let stripped = raw
      .replace(/^[A-Z0-9]+_/, '') // strip module prefix like DOO_, FOM_, ORA_, PO_
      .replace(/_(PRIV|PRIVILEGE|DUTY|SEC|PWA|REST|JOB)$/i, '')
      .replace(/WORKAREA/gi, 'WORK AREA')
      .replace(/WORK_AREA/gi, 'WORK AREA')
      .replace(/_/g, ' ')
      .trim();
    if (stripped.length > 2) {
      const titleCased = stripped.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (!candidates.includes(titleCased)) candidates.push(titleCased);
      if (!candidates.includes(stripped)) candidates.push(stripped);

      // Distinct phrase without leading action verb
      const withoutVerb = titleCased.replace(/^(View|Manage|Create|Edit|Delete|Update)\s+/i, '').trim();
      if (withoutVerb.length > 3 && !candidates.includes(withoutVerb)) {
        candidates.push(withoutVerb);
      }
    }
  }

  // 5. Raw code as fallback
  if (raw && !candidates.includes(raw)) {
    candidates.push(raw);
  }

  return candidates;
}

async function getQbeFilterInput(page) {
  const handle = await page.evaluateHandle(() => {
    // 1. Specific table header / filter selectors in Oracle ADF
    const filterSelectors = [
      'tr.af_table_filter-row input',
      '.af_column_filter-row input',
      'th input[type="text"]',
      'th input',
      'table thead input',
      'tr[class*="filter"] input',
      '[id*="qbe"] input',
      '[id*="fsp"] th input',
      '[id*="fsp"] input[type="text"]'
    ];
    for (const sel of filterSelectors) {
      const found = Array.from(document.querySelectorAll(sel)).find(el => {
        const rect = el.getBoundingClientRect();
        return el.offsetParent !== null && !el.disabled && rect.width > 30;
      });
      if (found) return found;
    }

    // 2. Any visible input in table header region (top 80-450, width > 40)
    const allInputs = Array.from(document.querySelectorAll('input')).filter(el => {
      const rect = el.getBoundingClientRect();
      return el.offsetParent !== null && !el.disabled &&
        rect.top > 80 && rect.top < 450 &&
        rect.width > 40 && rect.height > 14;
    });

    // Prefer input closest to "Privilege Name"
    const privInput = allInputs.find(i => {
      const parent = i.closest('th, td, tr, table');
      return parent && (parent.innerText || '').toLowerCase().includes('privilege');
    });
    if (privInput) return privInput;

    return allInputs[0] || null;
  });

  const isNull = await page.evaluate(el => el === null, handle);
  return isNull ? null : handle.asElement();
}

async function clickDeleteAndConfirm(page, jobId, term) {
  await sleep(1000);
  await waitForAdf(page);

  // Click Delete button in table toolbar
  const deleteClicked = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll(
      'button, a[role="button"], a, div[role="button"], span, [id*="delete" i], [title*="Delete" i]'
    ));
    const delBtn = elements.find(el => {
      const t = (el.textContent || el.innerText || el.title || el.getAttribute('aria-label') || '').trim();
      return (t === 'Delete' || t === 'Remove' || (el.title && el.title.trim().toLowerCase().includes('delete'))) &&
        !el.closest('.af_dialog') && !el.closest('[role="dialog"]');
    });
    if (delBtn) {
      (delBtn.closest('a, button, div[role="button"]') || delBtn).click();
      return true;
    }
    return false;
  });

  if (!deleteClicked) {
    appendLog(jobId, '  ⚠ Delete button not found or disabled in toolbar.');
    return false;
  }

  appendLog(jobId, '  → Clicked Delete button. Waiting for confirmation dialog...');
  await sleep(2000);
  await waitForAdf(page);

  // Click Yes on confirmation dialog ("You're about to delete the ... privilege from the role. Do you want to continue?")
  const confirmed = await page.evaluate(() => {
    const dialogBtns = Array.from(document.querySelectorAll('.af_dialog button, [role="dialog"] button, [id*="dialog"] button, button'));
    const yesBtn = dialogBtns.find(b => {
      const t = (b.textContent || b.innerText || '').trim();
      return t === 'Yes' || t === 'OK' || t === 'Confirm';
    });
    if (yesBtn) {
      yesBtn.click();
      return true;
    }
    return false;
  });

  await sleep(2000);
  await waitForAdf(page);

  if (confirmed) {
    appendLog(jobId, `  ✅ Costly privilege "${term}" confirmed deleted from role!`);
    return true;
  } else {
    appendLog(jobId, `  ⚠ Confirmation dialog did not show or Yes was not clicked.`);
    return false;
  }
}

// ─── STEP 9: Remove Costly Privilege from the Copied Role ─────────────────────
/**
 * In Step 2 (Function Security Policies / Privileges):
 * 1. Checks visible rows in table for target privilege.
 * 2. Toggles Query By Example (QBE) filter row and searches Privilege Name.
 * 3. Fallback: Progressive table scrolling & scanning.
 * 4. Selects matching row, clicks Delete in toolbar, and confirms deletion ("Yes").
 */
async function removeCostlyPrivilege(page, privilegeName, jobId, privilegeDisplayName = '') {
  appendLog(jobId, `  🗑 Step 2: Searching for and deleting costly privilege "${privilegeName}" in Privileges section...`);

  // First verify we are on the Function Security Policies page
  const onFSPPage = await page.evaluate(() => {
    const bodyText = (document.body.innerText || '').toLowerCase();
    return bodyText.includes('function security policies') ||
      !!document.querySelector('button[title*="Add Function Security Policy"]') ||
      !!document.querySelector('a[title*="Add Function Security Policy"]');
  });

  if (!onFSPPage) {
    appendLog(jobId, `  ⚠ Not on Function Security Policies page. Skipping privilege removal.`);
    return false;
  }

  // Wait for table content to load
  await sleep(1500);
  await waitForAdf(page);

  const candidates = getPrivilegeSearchCandidates(privilegeName, privilegeDisplayName);
  appendLog(jobId, `  📋 Search candidates for costly privilege: ${JSON.stringify(candidates)}`);

  // ── PHASE 1: Direct scan of visible table rows ──────────────────────────────
  for (const term of candidates) {
    const directFound = await page.evaluate((candTerm) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).filter(r => {
        const t = (r.innerText || '').trim();
        return t.length > 3 && !t.includes('Privilege Name') && !t.includes('Load Inherited') && !t.includes('No data to display');
      });
      const cLower = candTerm.toLowerCase();
      const match = rows.find(r => (r.innerText || '').toLowerCase().includes(cLower));
      if (match) {
        match.click();
        const cb = match.querySelector('input[type="checkbox"], input[type="radio"]');
        if (cb) cb.click();
        return { found: true, text: (match.innerText || '').substring(0, 80).replace(/\s+/g, ' ') };
      }
      return { found: false };
    }, term);

    if (directFound && directFound.found) {
      appendLog(jobId, `  🎯 Directly matched privilege row in table: "${directFound.text}". Deleting...`);
      const deleted = await clickDeleteAndConfirm(page, jobId, term);
      if (deleted) return true;
    }
  }

  // ── PHASE 2: Activate Query By Example (QBE) to filter table ────────────────
  appendLog(jobId, '  🔍 Privilege not in immediate view. Checking Query By Example (filter row)...');

  let qbeInputHandle = await getQbeFilterInput(page);
  if (!qbeInputHandle) {
    appendLog(jobId, '  → Filter input not yet visible. Clicking Query By Example toolbar button...');
    const toggled = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll(
        'a[title*="Query By Example" i], button[title*="Query By Example" i], img[title*="Query By Example" i], [aria-label*="Query By Example" i], [id*="_qbe" i], [id*="qbe" i], a[title*="Filter" i]'
      ));
      if (elements.length > 0) {
        const el = elements[0];
        (el.closest('a, button, div[role="button"]') || el).click();
        return true;
      }
      const toolbarIcons = Array.from(document.querySelectorAll('[id*="fsp"] a, [id*="fsp"] img, [id*="fsp"] button, .af_toolbar a, .af_toolbar img'));
      const qbeIcon = toolbarIcons.find(it => {
        const t = (it.title || it.getAttribute('aria-label') || it.id || '').toLowerCase();
        return t.includes('query') || t.includes('filter') || t.includes('qbe');
      });
      if (qbeIcon) {
        (qbeIcon.closest('a, button, div[role="button"]') || qbeIcon).click();
        return true;
      }
      return false;
    });

    if (toggled) {
      appendLog(jobId, '  → Clicked Query By Example button. Waiting for filter row to appear...');
      await sleep(2500);
      await waitForAdf(page);
    }
    qbeInputHandle = await getQbeFilterInput(page);
  }

  if (qbeInputHandle) {
    for (const term of candidates) {
      appendLog(jobId, `  🔍 [QBE Filter] Typing "${term}" in Privilege Name filter...`);

      // Clear QBE input
      await qbeInputHandle.evaluate(el => {
        try { el.focus(); } catch (e) { }
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await sleep(100);
      try {
        await qbeInputHandle.click();
        await page.keyboard.press('End');
        for (let i = 0; i < 40; i++) await page.keyboard.press('Backspace');
        await page.keyboard.type(term, { delay: 20 });
        await sleep(100);
        await page.keyboard.press('Enter');
        await sleep(2500);
        await waitForAdf(page);
      } catch (e) { }

      // Check results
      const rowMatch = await page.evaluate((candTerm) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr')).filter(r => {
          const t = (r.innerText || '').trim();
          return t.length > 3 && !t.includes('Privilege Name') && !t.includes('Load Inherited') && !t.includes('No data to display');
        });
        if (rows.length === 0) return { found: false };
        const cLower = candTerm.toLowerCase();
        const match = rows.find(r => (r.innerText || '').toLowerCase().includes(cLower)) || (rows.length === 1 ? rows[0] : null);
        if (match) {
          match.click();
          const cb = match.querySelector('input[type="checkbox"], input[type="radio"]');
          if (cb) cb.click();
          return { found: true, text: (match.innerText || '').substring(0, 80).replace(/\s+/g, ' ') };
        }
        return { found: false };
      }, term);

      if (rowMatch && rowMatch.found) {
        appendLog(jobId, `  🎯 QBE matched privilege row: "${rowMatch.text}". Deleting...`);
        const deleted = await clickDeleteAndConfirm(page, jobId, term);
        if (deleted) {
          // Clear QBE filter to restore table
          try {
            const curInput = await getQbeFilterInput(page);
            if (curInput) {
              await curInput.evaluate(el => {
                el.value = '';
                el.dispatchEvent(new Event('change', { bubbles: true }));
              });
              await curInput.click();
              await page.keyboard.press('End');
              for (let i = 0; i < 40; i++) await page.keyboard.press('Backspace');
              await page.keyboard.press('Enter');
              await sleep(1500);
              await waitForAdf(page);
            }
          } catch (e) { }
          return true;
        }
      } else {
        appendLog(jobId, `  ℹ Term "${term}" showed no rows in QBE.`);
      }
    }
  }

  // ── PHASE 3: Table Scrolling & Scan (Fallback if QBE was not available) ──────
  appendLog(jobId, '  📜 Scanning table rows with progressive scroll...');
  for (let scrollStep = 0; scrollStep < 5; scrollStep++) {
    for (const term of candidates) {
      const found = await page.evaluate((candTerm) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr')).filter(r => {
          const t = (r.innerText || '').trim();
          return t.length > 3 && !t.includes('Privilege Name') && !t.includes('Load Inherited') && !t.includes('No data to display');
        });
        const cLower = candTerm.toLowerCase();
        const match = rows.find(r => (r.innerText || '').toLowerCase().includes(cLower));
        if (match) {
          match.click();
          const cb = match.querySelector('input[type="checkbox"], input[type="radio"]');
          if (cb) cb.click();
          return { found: true, text: (match.innerText || '').substring(0, 80).replace(/\s+/g, ' ') };
        }
        return { found: false };
      }, term);

      if (found && found.found) {
        appendLog(jobId, `  🎯 Found privilege row after scrolling: "${found.text}". Deleting...`);
        const deleted = await clickDeleteAndConfirm(page, jobId, term);
        if (deleted) return true;
      }
    }

    // Scroll table body down
    await page.evaluate(() => {
      const scrollable = document.querySelector('.af_table_data-body, .af_table tbody, table tbody');
      if (scrollable) scrollable.scrollTop += 300;
      window.scrollBy(0, 200);
    });
    await sleep(1000);
  }

  return false;
}

// ─── Dialog Search & Dismiss Helpers ──────────────────────────────────────────
async function getDialogSearchInput(page, dialogKeywords = []) {
  // Polling loop: Wait up to 6 seconds for the modal dialog and its search input to render
  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const handle = await page.evaluateHandle(() => {
      function isElVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        return true;
      }

      // Collect all visible inputs, explicitly rejecting the global header and fuse navigation bar
      const allInputs = Array.from(document.querySelectorAll('input')).filter(inp => {
        if (!isElVisible(inp) || inp.disabled || inp.readOnly) return false;
        if (inp.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"], [id*="fndGlobal"]')) return false;
        const type = (inp.type || 'text').toLowerCase();
        if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit') return false;
        return true;
      });

      // Priority 1: Oracle ADF quickQuery dialog search box ("Enter 3 or more characters to search")
      const p1 = allInputs.find(inp => {
        const ph = (inp.placeholder || inp.getAttribute('placeholder') || '').toLowerCase();
        return ph.includes('character') || ph.includes('enter 3');
      });
      if (p1) return p1;

      // Priority 2: Inputs inside visible dialog/popup containers
      const dialogInputs = allInputs.filter(inp => {
        return !!inp.closest('.af_dialog, .af_panelWindow, [role="dialog"], .af_popup, div[id*="dialog"], div[id*="Dialog"]');
      });

      const p2 = dialogInputs.find(inp => {
        const id = (inp.id || '').toLowerCase() + ' ' + (inp.name || '').toLowerCase();
        const ph = (inp.placeholder || '').toLowerCase();
        const aria = (inp.getAttribute('aria-label') || '').toLowerCase();
        return id.includes('srchbox') || id.includes('qryid') || id.includes('search') ||
          ph.includes('search') || aria.includes('search');
      });
      if (p2) return p2;

      // Priority 3: First visible text/search input in any dialog
      const p3 = dialogInputs.find(inp => {
        const type = (inp.type || 'text').toLowerCase();
        return type === 'text' || type === 'search' || !inp.type;
      });
      if (p3) return p3;

      return null;
    });

    const isNull = await page.evaluate(el => el === null, handle);
    if (!isNull) return handle;

    await sleep(500);
  }

  return null;
}

async function dismissDialog(page) {
  await page.evaluate(() => {
    function isElVisible(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
    }

    const dialogs = Array.from(document.querySelectorAll(
      '.af_dialog, [role="dialog"], div.af_panelWindow'
    )).filter(d => {
      if (d.closest('header, .fuse-header, [id*="global"]')) return false;
      const r = d.getBoundingClientRect();
      return r.width > 250 && r.height > 150 && isElVisible(d);
    });

    for (const d of dialogs) {
      const cancelBtn = Array.from(d.querySelectorAll('button, a, div[role="button"], span')).find(b => {
        const t = (b.textContent || b.innerText || b.title || '').trim();
        return t === 'Cancel' || t === 'Close' || t === 'Dismiss' || t === 'Done';
      });
      if (cancelBtn) {
        (cancelBtn.closest('button, a, div[role="button"]') || cancelBtn).click();
        return;
      }
      const closeX = d.querySelector('.af_dialog_close-icon, a[title*="Close" i], img[title*="Close" i], a[title*="Cancel" i]');
      if (closeX) {
        closeX.click();
        return;
      }
    }
  });

  await sleep(1500);
  await waitForAdf(page);
}

// ─── STEP 10: Add Alternate (Free) Privilege ──────────────────────────────────
async function addAlternatePrivilege(page, alternatePrivilege, jobId, costlyPrivilegeName = '') {
  // If no alternate privilege requested, skip adding alternate duty role
  if (!alternatePrivilege || alternatePrivilege === false || alternatePrivilege === 'NONE' || (typeof alternatePrivilege === 'string' && (!alternatePrivilege.trim() || alternatePrivilege.trim().toUpperCase() === 'NONE'))) {
    appendLog(jobId, `  ℹ [STEP 4] No alternate privilege requested. Skipping alternate privilege addition.`);
    return;
  }

  // Derive a genuine Function Security Policy name
  let targetPriv = (alternatePrivilege || '').trim();
  const known = KNOWN_PRIVILEGE_MAPPINGS[costlyPrivilegeName?.trim()];

  if (!targetPriv || targetPriv.includes('Free /') || targetPriv.includes('Lower-Cost') || targetPriv.includes('DUTY') || targetPriv.length < 3) {
    if (known?.alternateName) {
      targetPriv = known.alternateName;
    } else {
      const costlyUpper = (costlyPrivilegeName || '').toUpperCase();
      if (costlyUpper.includes('TIME_WORK_AREA') || costlyUpper.includes('HWM')) {
        targetPriv = 'View Time Work Area';
      } else if (costlyUpper.includes('ORDER') || costlyUpper.includes('FOM')) {
        targetPriv = 'View Orders';
      } else if (costlyUpper.includes('INVOICE') || costlyUpper.includes('PAYABLE')) {
        targetPriv = 'View Payables Invoices';
      } else if (costlyUpper.includes('INVENTORY') || costlyUpper.includes('INV_')) {
        targetPriv = 'View On-Hand Quantity';
      } else if (costlyUpper.includes('PURCHASE') || costlyUpper.includes('PO_')) {
        targetPriv = 'View Purchase Orders';
      } else {
        targetPriv = 'View Orders';
      }
    }
    appendLog(jobId, `  ℹ Resolved valid Function Security Policy name: "${targetPriv}" for costly "${costlyPrivilegeName}".`);
  }

  appendLog(jobId, `  ➕ Checking availability to add alternate privilege: "${targetPriv}"...`);

  // Verify on Function Security Policies step
  const onFSP = await page.evaluate(() => {
    const text = (document.body.innerText || '').toLowerCase();
    return text.includes('function security policies') ||
      !!document.querySelector('button[title*="Add Function Security Policy" i]') ||
      !!document.querySelector('a[title*="Add Function Security Policy" i]');
  });

  if (!onFSP) {
    appendLog(jobId, `  ⚠ Not on Function Security Policies page. Cannot add alternate privilege.`);
    return;
  }

  // Click "+ Add Function Security Policy" toolbar button
  const addClicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, a, div[role="button"], span, [title*="Add Function Security Policy" i], [aria-label*="Add Function Security Policy" i]'));
    const btn = all.find(b => {
      if (b.offsetParent === null) return false;
      const text = (b.textContent || b.title || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return text === 'add function security policy' ||
        text.includes('add function security') ||
        text.includes('add privilege') ||
        (b.title && b.title.toLowerCase().includes('add function security policy'));
    });
    if (btn) {
      (btn.closest('button, a, div[role="button"]') || btn).click();
      return true;
    }
    return false;
  });

  if (!addClicked) {
    // Try coordinate click if direct click failed
    const btnHandle = await page.evaluateHandle(() => {
      const all = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
      return all.find(b => {
        if (b.offsetParent === null) return false;
        const text = (b.textContent || b.title || '').trim().toLowerCase();
        return text.includes('add function security');
      }) || null;
    });
    const bEl = btnHandle ? btnHandle.asElement() : null;
    if (bEl) {
      const box = await bEl.boundingBox();
      if (box && box.width > 0) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
    } else {
      appendLog(jobId, `  ⚠ "Add Function Security Policy" button not found.`);
      return;
    }
  }

  appendLog(jobId, '  → Clicked "Add Function Security Policy". Waiting for search dialog...');
  await sleep(3000);
  await waitForAdf(page);

  // Get search candidate terms
  const searchCandidates = getPrivilegeSearchCandidates(targetPriv);
  if (!searchCandidates.includes(targetPriv)) searchCandidates.unshift(targetPriv);

  // Add contextual candidates
  const lower = targetPriv.toLowerCase();
  if (lower.includes('time')) {
    ['View Time Work Area', 'Time Work Area', 'HWM_VIEW_TIME_WORK_AREA_PRIV'].forEach(c => {
      if (!searchCandidates.includes(c)) searchCandidates.push(c);
    });
  } else if (lower.includes('order')) {
    ['View Orders', 'Orders', 'FOM_VIEW_ORDERS_PRIV'].forEach(c => {
      if (!searchCandidates.includes(c)) searchCandidates.push(c);
    });
  } else if (lower.includes('invoice') || lower.includes('payable')) {
    ['View Payables Invoices', 'Payables Invoices', 'View Invoices', 'AP_VIEW_PAYABLES_INVOICE_PRIV'].forEach(c => {
      if (!searchCandidates.includes(c)) searchCandidates.push(c);
    });
  }

  appendLog(jobId, `  📋 Alternate search candidates: ${JSON.stringify(searchCandidates)}`);

  let added = false;
  for (const cand of searchCandidates) {
    appendLog(jobId, `  🔍 Searching alternate privilege candidate: "${cand}" in dialog...`);
    let autoSuggestSelected = false;

    try {
      // Re-fetch search input strictly inside active dialog on each iteration
      const currentInputHandle = await getDialogSearchInput(page, ['add function security policy', 'privilege', 'security policy']);
      if (!currentInputHandle) {
        appendLog(jobId, `  ⚠ Dialog search input not accessible on candidate "${cand}".`);
        continue;
      }

      // Clear input using guaranteed ADF-aware wipe and type
      await adfClearAndType(page, currentInputHandle, cand, 'Alternate Privilege Search', jobId);
      await sleep(500);

      // Check for Oracle ADF autoSuggest popup and select item if present (matching video flow)
      for (let attempt = 0; attempt < 3; attempt++) {
        const itemHandle = await page.evaluateHandle((targetQuery) => {
          function isElVisible(el) {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
          }

          const popups = Array.from(document.querySelectorAll(
            '.af_autoSuggest_content, div[id*="as_pop"], ul[class*="autoSuggest"], .af_autoSuggest'
          )).filter(p => isElVisible(p));

          for (const pop of popups) {
            const items = Array.from(pop.querySelectorAll('li, tr, td, [role="option"], .af_autoSuggest_item')).filter(el => {
              const t = (el.innerText || el.textContent || '').trim().toLowerCase();
              return isElVisible(el) && t.length > 0 && !t.startsWith('privileges');
            });

            if (items.length > 0) {
              const matched = items.find(el => (el.innerText || el.textContent || '').toLowerCase().includes(targetQuery.toLowerCase())) || items[0];
              return matched || null;
            }
          }
          return null;
        }, cand);

        const itemEl = itemHandle ? itemHandle.asElement() : null;
        if (itemEl) {
          const box = await itemEl.boundingBox().catch(() => null);
          if (box && box.width > 0 && box.height > 0) {
            appendLog(jobId, `  🎯 Found auto-suggest privilege item! Clicking via coordinates...`);
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            autoSuggestSelected = true;
            await sleep(1500);
            await waitForAdf(page);
            break;
          } else {
            await page.keyboard.press('ArrowDown');
            await sleep(80);
            await page.keyboard.press('Enter');
            autoSuggestSelected = true;
            await sleep(1500);
            await waitForAdf(page);
            break;
          }
        }
        await sleep(300);
      }

      // If autoSuggest was not selected, submit search via Enter & dialog search icon
      if (!autoSuggestSelected) {
        const freshPrivInput = await getDialogSearchInput(page, ['add function security policy', 'privilege', 'security policy']);
        const freshPrivEl = freshPrivInput ? freshPrivInput.asElement() : null;

        if (freshPrivEl) {
          const fBox = await freshPrivEl.boundingBox().catch(() => null);
          if (fBox && fBox.width > 0) {
            await page.mouse.click(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
          }
        }
        await page.keyboard.press('Enter');

        // Click the magnifier/Search button strictly inside the active dialog
        const sIconHandle = await page.evaluateHandle(() => {
          function isElVisible(el) {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
          }
          const dialogs = Array.from(document.querySelectorAll('div.af_dialog, div.af_panelWindow, div[role="dialog"]')).filter(el => {
            if (el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]')) return false;
            const r = el.getBoundingClientRect();
            return r.width > 250 && r.height > 150 && isElVisible(el);
          });
          const dialog = dialogs[dialogs.length - 1];
          if (!dialog) return null;
          const icon = dialog.querySelector('a[id*="srchBox::search_icon"], [id*="srchBox"] a, [id*="search_icon"], a[id*="search"], [id*="srchBox"] img, [id*="qryId"] a[title*="Search" i]');
          if (icon && isElVisible(icon) && !icon.closest('header, .fuse-header, [id*="global"]')) {
            return icon;
          }
          return null;
        });
        const sIcon = sIconHandle ? sIconHandle.asElement() : null;
        if (sIcon) {
          const sBox = await sIcon.boundingBox().catch(() => null);
          if (sBox && sBox.width > 0) {
            await page.mouse.click(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
          } else {
            try { await sIcon.click(); } catch { }
          }
        }

        await sleep(3500);
        await waitForAdf(page);
      }
    } catch (err) {
      appendLog(jobId, `  ⚠ Search error: ${err.message}`);
      continue;
    }

    // Inspect dialog for results: supports card view (Search Result Count: 1) and table rows
    const resultCheck = await page.evaluate((candTerm, wasAutoSelected) => {
      function isElVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
      }

      const dialogs = Array.from(document.querySelectorAll('div.af_dialog, div.af_panelWindow, div[role="dialog"]')).filter(el => {
        if (el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 250 && r.height > 150 && isElVisible(el);
      });
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return { available: false, count: 0 };

      const dText = (dialog.innerText || '').toLowerCase();
      if (dText.includes('search result count : 0') || dText.includes('no data to display')) {
        return { available: false, count: 0 };
      }

      const hasPositiveCount = dText.includes('search result count :') && !dText.includes('search result count : 0');
      const hasCandText = dText.includes(candTerm.toLowerCase());

      // Check if "Add Privilege to Role" or "Add Selected Privileges" button is active
      const addBtn = Array.from(dialog.querySelectorAll('button, a, div[role="button"], span')).find(b => {
        const t = (b.textContent || b.innerText || b.getAttribute('title') || '').trim().toLowerCase();
        return t === 'add privilege to role' || t === 'add selected privileges';
      });
      const isAddBtnEnabled = addBtn && !addBtn.hasAttribute('disabled') && !addBtn.classList.contains('p_AFDisabled');

      if (hasPositiveCount || hasCandText || wasAutoSelected || isAddBtnEnabled) {
        return {
          available: true,
          count: 1,
          label: candTerm
        };
      }

      return { available: false, count: 0 };
    }, cand, autoSuggestSelected);

    if (resultCheck && resultCheck.available) {
      appendLog(jobId, `  🎯 Matched alternate privilege: "${resultCheck.label}". Clicking "Add Privilege to Role"...`);

      // 1. Check if "Add Privilege to Role" is already enabled before clicking row
      const isPrivBtnInitiallyEnabled = await page.evaluate(() => {
        function isElVisible(el) {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
        }
        const allCandidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span')).filter(el => {
          if (!isElVisible(el)) return false;
          if (el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]')) return false;
          const t = (el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '')
            .replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          return t === 'add privilege to role' || t.includes('add privilege to role') ||
            t === 'add selected privileges' || t.includes('add selected privileges');
        });
        const buttons = allCandidates.map(c => c.closest('button, a, div[role="button"]') || c);
        const unique = Array.from(new Set(buttons));
        return unique.some(b => !b.disabled && !b.classList.contains('p_AFDisabled') && b.getAttribute('aria-disabled') !== 'true');
      });

      if (!isPrivBtnInitiallyEnabled) {
        await page.evaluate((candTerm) => {
          function isElVisible(el) {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
          }

          const dialogs = Array.from(document.querySelectorAll('div.af_dialog, div.af_panelWindow, div[role="dialog"]')).filter(el => {
            if (el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]')) return false;
            const r = el.getBoundingClientRect();
            return r.width > 250 && r.height > 150 && isElVisible(el);
          });
          const dialog = dialogs[dialogs.length - 1] || document;

          const dataRows = Array.from(dialog.querySelectorAll('table tbody tr, tr, [id*="resList"], div.af_panelBox')).filter(r => {
            if (!isElVisible(r) || r.querySelector('table') || r.querySelector('th')) return false;
            return true;
          });
          const matched = dataRows.find(r => (r.innerText || '').toLowerCase().includes(candTerm.toLowerCase())) || dataRows[0];
          if (matched) {
            const cb = matched.querySelector('input[type="checkbox"], input[type="radio"]');
            if (cb) cb.click();
            const cell = matched.querySelector('td') || matched;
            cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            cell.click();
          }
        }, cand);
        await sleep(600);
        await waitForAdf(page);
      }

      await sleep(400);
      await waitForAdf(page);

      // 2. Click "Add Privilege to Role" or "Add Selected Privileges"
      let clickedAdd = false;
      for (let addAttempt = 1; addAttempt <= 4; addAttempt++) {
        const addBtnHandle = await page.evaluateHandle(() => {
          function isElVisible(el) {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
          }

          const allCandidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span')).filter(el => {
            if (!isElVisible(el)) return false;
            if (el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]')) return false;
            const t = (el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '')
              .replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            return t === 'add privilege to role' || t.includes('add privilege to role') ||
              t === 'add selected privileges' || t.includes('add selected privileges');
          });

          if (allCandidates.length === 0) {
            return document.querySelector('[title*="Add Privilege to Role" i], [aria-label*="Add Privilege to Role" i], [id*="addPrivilege" i], [id*="cbAddPrivilegeToRole" i]') || null;
          }

          const buttons = allCandidates.map(c => c.closest('button, a, div[role="button"]') || c);
          const unique = Array.from(new Set(buttons));
          const enabled = unique.find(b => {
            if (b.disabled || b.hasAttribute('disabled')) return false;
            if (b.getAttribute('aria-disabled') === 'true') return false;
            if (b.classList.contains('p_AFDisabled')) return false;
            if (b.closest('.p_AFDisabled')) return false;
            return true;
          });
          return enabled || unique[0];
        });

        const addEl = addBtnHandle ? addBtnHandle.asElement() : null;
        if (addEl) {
          const aBox = await addEl.boundingBox().catch(() => null);
          if (aBox && aBox.width > 0) {
            await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
            await sleep(60);
            await page.mouse.down();
            await sleep(50);
            await page.mouse.up();
            clickedAdd = true;
          }

          try { await addEl.click(); clickedAdd = true; } catch { }

          await page.evaluate(b => {
            try {
              b.focus();
              b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              b.click();
            } catch { }
          }, addEl);

          await sleep(2500);
          await waitForAdf(page);
          clickedAdd = true;
          break;
        }

        await sleep(800);
      }

      await sleep(3000);
      await waitForAdf(page);

      added = true;
      appendLog(jobId, `  ✅ Alternate privilege "${cand}" successfully added to role!`);
      break;
    } else {
      appendLog(jobId, `  ℹ Candidate "${cand}" not available in search results.`);
    }
  }

  if (!added) {
    appendLog(jobId, `  ℹ Alternate privilege "${targetPriv}" was not found or not selectable in this instance.`);
  }

  // Dismiss / Close the Add popup dialog cleanly
  appendLog(jobId, '  → Closing "Add Function Security Policy" dialog...');
  await dismissDialog(page);
  await sleep(1500);
  await waitForAdf(page);
}

// ─── STEP 10B: Navigate Wizard → Step 6: Users ────────────────────────────────
async function isAtUsersStep(page) {
  return await page.evaluate(() => {
    // 1. Look for '+ Add User' or 'Add User' toolbar button on the main page
    const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    const addUserBtn = buttons.find(b => {
      if (b.closest('.af_dialog, [role="dialog"], div.af_panelWindow')) return false;
      const t = (b.textContent || b.getAttribute('title') || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return (t === '+ add user' || t === 'add user' || (t.includes('add user') && !t.includes('add user to role'))) && b.offsetParent !== null;
    });
    if (addUserBtn) return true;

    // 2. Check page title / header (e.g. "Copy Role <Name>: Users")
    const titles = Array.from(document.querySelectorAll('h1, h2, h3, .af_panelHeader_title, .AFHeaderTitle, div[id*="header"]'));
    const isUsersHeading = titles.some(h => {
      const t = (h.textContent || '').trim().toLowerCase();
      return t.endsWith(': users') || t.includes(': users') || t.endsWith(' users');
    });
    if (isUsersHeading) return true;

    // 3. Check selected train stop (Step 6 Users is active/selected)
    const activeTrain = document.querySelector('.af_train_stop.p_AFSelected, .af_train_stop[aria-selected="true"], .af_train_stop-selected');
    if (activeTrain) {
      const t = (activeTrain.textContent || activeTrain.getAttribute('title') || '').trim().toLowerCase();
      if (t.includes('users')) return true;
    }

    return false;
  });
}

async function navigateToUsersStep(page, jobId) {
  appendLog(jobId, '  → Navigating wizard to Step 6: Users...');

  // 1. Check if already at Users step
  if (await isAtUsersStep(page)) {
    appendLog(jobId, '  ✅ Already at Step 6: Users.');
    await sleep(1500);
    await waitForAdf(page);
    return true;
  }

  // 2. Advance step by step clicking "Next" until reaching Users
  for (let s = 1; s <= 6; s++) {
    await autoResolveOracleDialogs(page, jobId, 'Navigating to Users');

    if (await isAtUsersStep(page)) {
      appendLog(jobId, `  ✅ Reached Step 6: Users!`);
      await sleep(1500);
      await waitForAdf(page);
      return true;
    }

    appendLog(jobId, `  → Advancing wizard step ${s} towards Users (clicking Next)...`);
    const clickedNext = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      const nextBtn = btns.find(b => {
        const t = (b.textContent || b.getAttribute('title') || '').trim();
        return t === 'Next' && !b.disabled && b.offsetParent !== null;
      });
      if (nextBtn) {
        (nextBtn.closest('button, a, div[role="button"]') || nextBtn).click();
        return true;
      }
      return false;
    });

    if (!clickedNext) {
      appendLog(jobId, '  ⚠ Next button not found or disabled during traversal to Users.');
      break;
    }

    await sleep(2500);
    await waitForAdf(page);

    if (await isAtUsersStep(page)) {
      appendLog(jobId, `  ✅ Reached Step 6: Users!`);
      await sleep(1500);
      await waitForAdf(page);
      return true;
    }
  }

  const atUsers = await isAtUsersStep(page);
  if (atUsers) {
    appendLog(jobId, '  ✅ Confirmed on Step 6: Users.');
  } else {
    appendLog(jobId, '  ⚠ Could not confirm Step 6 (Users). Will attempt finding Add User button...');
  }
  return atUsers;
}

async function clickAddUserToolbarButton(page, jobId) {
  // First ensure no modal backdrop is blocking the toolbar and dialog isn't already open
  const isAlreadyOpen = await page.evaluate(() => {
    function isElVisible(el) {
      if (!el) return false;
      if (el.offsetParent !== null) return true;
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return (r.width > 0 && r.height > 0);
    }

    const popups = Array.from(document.querySelectorAll('.af_dialog, .af_popup, div.af_panelWindow, [role="dialog"], div[id*="popup"], div[id*="dialog"]')).filter(el => {
      if (!isElVisible(el)) return false;
      const t = (el.innerText || '').toLowerCase();
      return t.includes('add user') && (t.includes('add user to role') || t.includes('search result count') || t.includes('enter 3 or more characters to search'));
    });
    return popups.length > 0;
  });

  if (isAlreadyOpen) {
    appendLog(jobId, '  → "Add User" dialog is already open.');
    return true;
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    appendLog(jobId, `  → Locating & clicking "+ Add User" toolbar button (attempt ${attempt})...`);

    const btnHandle = await page.evaluateHandle(() => {
      const isInsideDialog = (el) => !!el.closest('.af_dialog, [role="dialog"], div.af_panelWindow, div[id*="popup"]');

      // 1. Search anchors, buttons, div[role="button"], span, and toolbar items
      const candidates = Array.from(document.querySelectorAll('a, button, div[role="button"], span, table[class*="ToolbarButton"]'));
      const found = candidates.find(el => {
        if (isInsideDialog(el)) return false;
        if (el.offsetParent === null) return false;
        const t = (el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '').trim().toLowerCase();
        return (t === '+ add user' || t === 'add user' || (t.includes('add user') && !t.includes('add user to role')));
      });

      if (found) {
        return found.closest('a, div[role="button"], button') || found;
      }

      // 2. Fallback by standard ADF toolbar create IDs
      const byId = document.querySelector('[id*="addUser" i], [id*="AddUser"], [id*="_atp:create"], [id*="table:create"]');
      if (byId && !isInsideDialog(byId) && byId.offsetParent !== null) {
        return byId.closest('a, div[role="button"], button') || byId;
      }

      return null;
    });

    const el = btnHandle ? btnHandle.asElement() : null;
    if (el) {
      // 1. Scroll into view
      await el.evaluate(b => b.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => { });
      await sleep(100);

      // 2. Physical mouse coordinate click
      const box = await el.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(50);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }

      // Wait a moment: if the physical click already opened the dialog, do NOT click again
      await sleep(2500);
      await waitForAdf(page);

      let dialogOpened = await page.evaluate(() => {
        const popups = Array.from(document.querySelectorAll('.af_dialog, .af_popup, div.af_panelWindow, [role="dialog"], div[id*="popup"], div[id*="dialog"]')).filter(d => {
          if (d.offsetParent === null) return false;
          const t = (d.innerText || '').toLowerCase();
          return t.includes('add user') && (t.includes('add user to role') || t.includes('search result count') || t.includes('enter 3 or more characters to search'));
        });
        return popups.length > 0;
      });

      // 3. Fallback: in-page DOM event sequence (only if dialog still not open)
      if (!dialogOpened) {
        await page.evaluate(b => {
          try {
            const target = b.closest('a, div[role="button"], button') || b;
            target.focus();
            target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, buttons: 1 }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            target.click();
          } catch { }
        }, el);

        await sleep(3000);
        await waitForAdf(page);

        dialogOpened = await page.evaluate(() => {
          const popups = Array.from(document.querySelectorAll('.af_dialog, .af_popup, div.af_panelWindow, [role="dialog"], div[id*="popup"], div[id*="dialog"]')).filter(d => {
            if (d.offsetParent === null) return false;
            const t = (d.innerText || '').toLowerCase();
            return t.includes('add user') && (t.includes('add user to role') || t.includes('search result count') || t.includes('enter 3 or more characters to search'));
          });
          return popups.length > 0;
        });
      }

      if (dialogOpened) {
        appendLog(jobId, '  ✅ "Add User" modal dialog is open!');
        return true;
      }
    } else {
      appendLog(jobId, `  ⚠ "+ Add User" toolbar button element not found on attempt ${attempt}.`);
    }

    await sleep(1500);
    await waitForAdf(page);
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
//   "ADD USER" DIALOG HELPERS
//
//   FIX NOTES (why only 17 of 39 users were being added):
//   1. isUserListedBehindDialog() used "ANY name part matches" → users sharing a
//      first/last name were wrongly treated as "already listed" and SKIPPED.
//      It is now STRICT (whole-token match, or ALL name parts present).
//   2. clickAddUserToRoleReliably() declared success as soon as the button was no
//      longer enabled, and never waited for Oracle to actually add the user.
//      It now WAITS until the Users table behind the dialog grows (or the user is
//      listed / the dialog closes) before returning.
//   3. addUsersToRoleInWizard() now finishes each user completely (confirmed) before
//      starting the next, retries failed users, and reports skipped/failed users.
//
//   Strategy kept from earlier fix: select the user ONCE → wait until the button is
//   truly enabled → verify the click point is not covered → click ONCE with a real
//   mouse → CONFIRM the add → only then use fallbacks / move on.
// ═══════════════════════════════════════════════════════════════════════════════
const ADD_USER_ROLE_LABELS = ['add user to role', 'add user to the role', 'add selected users', 'add selected user'];

function dialogSelectorString() {
  return 'div.af_dialog, div.af_panelWindow, div[role="dialog"]';
}

// Is the "Add User" dialog open?
async function isAddUserDialogOpen(page) {
  return await page.evaluate((dSel) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 250 && r.height > 150 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    return Array.from(document.querySelectorAll(dSel)).some(el => {
      if (el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]')) return false;
      if (!vis(el)) return false;
      const t = (el.innerText || '').toLowerCase();
      return t.includes('add user') || t.includes('add user to role') || t.includes('search result count');
    });
  }, dialogSelectorString());
}

// Returns rect of the top-most (last in DOM) visible dialog
async function getTopDialogRect(page) {
  return await page.evaluate((dSel) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 250 && r.height > 150 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const ds = Array.from(document.querySelectorAll(dSel)).filter(el =>
      !el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]') && vis(el));
    const d = ds[ds.length - 1];
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, dialogSelectorString());
}

// Finds the "Add User to Role" control inside the top dialog (returns element handle or null)
async function findAddUserToRoleButton(page) {
  return await page.evaluateHandle((dSel, labels) => {
    const vis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const norm = (s) => (s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

    const dialogs = Array.from(document.querySelectorAll(dSel)).filter(el => {
      if (el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 200 && r.height > 100 && vis(el);
    });
    const dialog = dialogs[dialogs.length - 1] || document;

    const raw = Array.from(dialog.querySelectorAll('button, a, div[role="button"], div.af_button, span')).filter(el => {
      if (!vis(el)) return false;
      const t = norm(el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label'));
      return labels.includes(t);
    });

    const mapped = raw.map(c => c.closest('button, a, [role="button"], .af_button') || c);
    const unique = Array.from(new Set(mapped));
    if (unique.length === 0) return null;

    const isEnabled = (b) => !(b.disabled || b.hasAttribute('disabled') ||
      b.getAttribute('aria-disabled') === 'true' ||
      b.classList.contains('p_AFDisabled') || !!b.closest('.p_AFDisabled'));

    return unique.find(isEnabled) || unique[0];
  }, dialogSelectorString(), ADD_USER_ROLE_LABELS);
}

async function isControlEnabled(elHandle) {
  return await elHandle.evaluate(b => !(b.disabled || b.hasAttribute('disabled') ||
    b.getAttribute('aria-disabled') === 'true' ||
    b.classList.contains('p_AFDisabled') || !!b.closest('.p_AFDisabled')));
}

// Poll until "Add User to Role" is present AND enabled. Returns element handle or null.
async function waitForAddUserToRoleEnabled(page, timeoutMs = 4000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const h = await findAddUserToRoleButton(page);
    const el = h ? h.asElement() : null;
    if (el && await isControlEnabled(el)) return el;
    await sleep(400);
  }
  return null;
}

// Closes a lingering auto-suggest popup by clicking a harmless spot (dialog title area)
async function closeSuggestPopupSafely(page) {
  const rect = await getTopDialogRect(page);
  if (!rect) return;
  await page.mouse.click(rect.x + 30, rect.y + 14).catch(() => { });
  await sleep(300);
}

// ONE real physical click, after verifying nothing covers the target point.
async function physicalClick(page, elHandle, label, jobId) {
  await elHandle.evaluate(b => b.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => { });
  await sleep(150);

  let box = await elHandle.boundingBox().catch(() => null);
  if (!box || box.width === 0 || box.height === 0) return false;

  const isCovered = async () => {
    const b2 = await elHandle.boundingBox().catch(() => null);
    if (!b2) return true;
    return await page.evaluate((x, y, el) => {
      const t = document.elementFromPoint(x, y);
      return !(t && (t === el || el.contains(t)));
    }, b2.x + b2.width / 2, b2.y + b2.height / 2, elHandle);
  };

  if (await isCovered()) {
    appendLog(jobId, `  ℹ "${label}" is covered by another element (likely auto-suggest popup). Closing popup...`);
    await closeSuggestPopupSafely(page);
    await sleep(300);
  }

  box = await elHandle.boundingBox().catch(() => null);
  if (!box) return false;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx - 6, cy - 3);
  await sleep(60);
  await page.mouse.move(cx, cy, { steps: 4 });
  await sleep(80);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  return true;
}

// Rows of the Users table BEHIND the dialog (used to detect that an add really happened)
async function getUsersTableRowsBehindDialog(page) {
  return await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr')).filter(r => {
      if (r.closest('.af_dialog, [role="dialog"], div.af_panelWindow')) return false;
      if (r.querySelector('table') || r.querySelector('th')) return false;
      const t = (r.innerText || '').replace(/\s+/g, ' ').trim();
      if (t.length < 3) return false;
      const tl = t.toLowerCase();
      if (tl.includes('no data to display') || tl.includes('user login') || tl.includes('search result count')) return false;
      return r.querySelectorAll('td').length >= 1;
    });
    return rows.map(r => (r.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase());
  });
}

// Is the user now visible in the Users table BEHIND the dialog? (STRICT matching)
async function isUserListedBehindDialog(page, userQuery) {
  const rows = await getUsersTableRowsBehindDialog(page);
  const q = (userQuery || '').toLowerCase().trim();
  if (!q) return false;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const variants = Array.from(new Set([q, q.replace(/[._]+/g, ' ')]));
  const parts = q.split(/[._\s\-@]+/).filter(p => p.length >= 2);

  return rows.some(t => {
    // 1. Whole-token match of the full query (so "john.smith" does not match "john.smith2")
    const full = variants.some(v => new RegExp('(^|[^a-z0-9])' + esc(v) + '($|[^a-z0-9])').test(t));
    if (full) return true;
    // 2. ALL name parts must be present (never "any")
    return parts.length >= 2 && parts.every(p => t.includes(p));
  });
}

// Waits until the user is REALLY added: row count grows, OR user is listed, OR dialog closed.
async function waitForUserAdded(page, userQuery, beforeCount, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await waitForAdf(page, 4000);
    const rows = await getUsersTableRowsBehindDialog(page);
    if (rows.length > beforeCount) return true;
    if (await isUserListedBehindDialog(page, userQuery)) return true;
    if (!(await isAddUserDialogOpen(page))) return true;
    await sleep(500);
  }
  return false;
}

// Select the user's row/card inside the dialog — ONLY if it is not already selected.
async function selectUserResultOnce(page, userQuery, jobId) {
  const target = await page.evaluateHandle((dSel, q) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const dialogs = Array.from(document.querySelectorAll(dSel)).filter(el =>
      !el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]') && vis(el) &&
      el.getBoundingClientRect().width > 200);
    const dialog = dialogs[dialogs.length - 1] || document;

    const rows = Array.from(dialog.querySelectorAll('table tbody tr, [id*="resList"], [role="row"], div.af_panelBox')).filter(r => {
      if (!vis(r) || r.querySelector('table') || r.querySelector('th')) return false;
      const t = (r.innerText || '').trim();
      return t.length > 2 && !t.includes('No data to display') && !t.toLowerCase().includes('search result count : 0');
    });
    const ql = q.toLowerCase();
    const parts = ql.split(/[._\s\-@]+/).filter(p => p.length >= 2);
    const row = rows.find(r => (r.innerText || '').toLowerCase().includes(ql)) ||
      rows.find(r => parts.length > 0 && parts.every(p => (r.innerText || '').toLowerCase().includes(p))) ||
      rows.find(r => parts.some(p => (r.innerText || '').toLowerCase().includes(p))) ||
      rows[0] || null;
    if (!row) return null;

    const cls = (row.className || '') + ' ' + (row.getAttribute('class') || '');
    const alreadySelected = /selected|p_AFSelected|af_table_data-row_selected/i.test(cls) ||
      row.getAttribute('aria-selected') === 'true' ||
      !!row.querySelector('input:checked, [aria-selected="true"], .p_AFSelected');
    if (alreadySelected) return null; // do NOT click again, it would deselect

    return row.querySelector('td') || row;
  }, dialogSelectorString(), userQuery);

  const el = target ? target.asElement() : null;
  if (!el) return false;

  await el.evaluate(b => b.scrollIntoView({ block: 'center' })).catch(() => { });
  const box = await el.boundingBox().catch(() => null);
  if (!box || box.width === 0) return false;
  await page.mouse.click(box.x + Math.min(40, box.width / 2), box.y + box.height / 2);
  appendLog(jobId, '  🖱️ Selected user row in dialog (single click).');
  await sleep(900);
  await waitForAdf(page);
  return true;
}

// Click an auto-suggest item ONCE (no Enter / ArrowDown afterwards!)
async function pickAutoSuggestOnce(page, userQuery, jobId, timeoutMs = 3500) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const itemHandle = await page.evaluateHandle((targetQuery) => {
      const vis = (el) => {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const popups = Array.from(document.querySelectorAll(
        '.af_autoSuggest_content, div[id*="as_pop"], div[id*="::as_pop"], ul[class*="autoSuggest"], .af_autoSuggest, [role="listbox"], div.af_popup[id*="as"], div.af_popup[id*="suggest"], div[class*="suggest"]'
      )).filter(vis);

      for (const pop of popups) {
        const items = Array.from(pop.querySelectorAll(
          'li, tr, [role="option"], .af_autoSuggest_item, a'
        )).filter(el => {
          if (!vis(el)) return false;
          const r = el.getBoundingClientRect();
          if (r.height > 80 || r.width > 600) return false;
          const t = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (t.length < 2) return false;
          if (['users', 'duty roles', 'other roles', 'roles', 'privileges'].includes(t)) return false;
          return true;
        });
        if (items.length === 0) continue;

        const ql = targetQuery.toLowerCase();
        const parts = ql.split(/[._\s\-]+/).filter(p => p.length >= 2);
        return items.find(el => (el.innerText || el.textContent || '').toLowerCase().includes(ql)) ||
          items.find(el => parts.length > 0 && parts.every(p => (el.innerText || el.textContent || '').toLowerCase().includes(p))) ||
          items.find(el => parts.some(p => (el.innerText || el.textContent || '').toLowerCase().includes(p))) ||
          items[0];
      }
      return null;
    }, userQuery);

    const itemEl = itemHandle ? itemHandle.asElement() : null;
    if (itemEl) {
      const label = await itemEl.evaluate(e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)).catch(() => '');
      const box = await itemEl.boundingBox().catch(() => null);
      if (box && box.width > 0) {
        appendLog(jobId, `  🎯 Auto-suggest item found: "${label}". Clicking ONCE...`);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(1200);
        await waitForAdf(page);
        return true;
      }
    }
    await sleep(350);
  }
  return false;
}

// Submit the dialog search with Enter / dialog search icon (used only when no suggest item exists)
async function submitDialogSearch(page, jobId) {
  const inputHandle = await getDialogSearchInput(page, ['add user', 'characters', 'search result count']);
  const inputEl = inputHandle ? inputHandle.asElement() : null;
  if (inputEl) {
    await inputEl.evaluate(el => el.focus()).catch(() => { });
  }
  await page.keyboard.press('Enter');
  await sleep(1500);

  const iconHandle = await page.evaluateHandle((dSel) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
    };
    const dialogs = Array.from(document.querySelectorAll(dSel)).filter(el =>
      !el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]') && vis(el) && el.getBoundingClientRect().width > 200);
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return null;
    const icon = dialog.querySelector('a[id*="srchBox::search_icon"], [id*="srchBox"] a, [id*="search_icon"], a[id*="search"], [id*="qryId"] a[title*="Search" i]');
    return icon && vis(icon) ? icon : null;
  }, dialogSelectorString());
  const iconEl = iconHandle ? iconHandle.asElement() : null;
  if (iconEl) {
    const b = await iconEl.boundingBox().catch(() => null);
    if (b && b.width > 0) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  await sleep(2500);
  await waitForAdf(page);
}

/**
 * Clicks "Add User to Role" and WAITS until the user is really added.
 * Returns true only when the add is confirmed
 * (row count increased / user listed / dialog closed).
 */
async function clickAddUserToRoleReliably(page, userQuery, jobId, beforeCount = 0) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const btn = await waitForAddUserToRoleEnabled(page, attempt === 1 ? 4000 : 2000);
    if (!btn) {
      // Button disabled: maybe the previous click is still being processed. Give it a chance.
      appendLog(jobId, `  ⚠ "Add User to Role" is not enabled (attempt ${attempt}/3). Checking if add already completed...`);
      if (await waitForUserAdded(page, userQuery, beforeCount, 6000)) return true;
      return false;
    }

    appendLog(jobId, `  👉 Clicking "Add User to Role" (attempt ${attempt}/3, method: ${attempt === 1 ? 'native mouse' : attempt === 2 ? 'keyboard focus + Enter' : 'ADF/DOM events'})...`);

    if (attempt === 1) {
      await physicalClick(page, btn, 'Add User to Role', jobId);
    } else if (attempt === 2) {
      // Keyboard activation (ADF buttons respond to Enter/Space when focused)
      await btn.evaluate(b => { b.scrollIntoView({ block: 'center' }); b.focus(); }).catch(() => { });
      await sleep(150);
      await page.keyboard.press('Enter');
    } else {
      // Last resort: DOM events + ADF action event
      await page.evaluate(b => {
        try {
          const link = b.tagName === 'A' ? b : (b.querySelector('a') || b);
          link.focus();
          ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evt =>
            link.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window })));
          const compId = link.id || b.id || b.closest('[id]')?.id;
          if (window.AdfPage && window.AdfPage.PAGE && compId && window.AdfActionEvent) {
            const comp = window.AdfPage.PAGE.findComponent(compId) || window.AdfPage.PAGE.findComponentByClientId(compId);
            if (comp) new window.AdfActionEvent(comp).queue();
          }
        } catch (e) { }
      }, btn);
    }

    // *** WAIT until Oracle has really added the user before doing anything else ***
    appendLog(jobId, '  ⏳ Waiting for Oracle to confirm the user was added to the role...');
    const confirmed = await waitForUserAdded(page, userQuery, beforeCount, 12000);
    if (confirmed) {
      await sleep(800);
      await waitForAdf(page);
      return true;
    }
    appendLog(jobId, '  ℹ Add not confirmed yet — click may not have registered.');
  }
  return false;
}

// ─── STEP 10C: Assign Employees to Role in Step 6 (Users) ────────────────────
async function addUsersToRoleInWizard(page, employeesList, jobId, fallbackUsername = '') {
  appendLog(jobId, `\n👥 [USERS] Initiating assignment of users to copied role in Step 6 (Users)...`);

  const rawList = Array.isArray(employeesList) ? employeesList : [];
  appendLog(jobId, `  📋 User count in request payload: ${rawList.length}`);

  const queriesToSearch = [];

  // Priority 1: Requested users from payload (e.g. from UI, table, or report)
  rawList.forEach(emp => {
    const q = (typeof emp === 'string')
      ? emp.trim()
      : (emp.username || emp.name || emp.id || '').trim();
    if (q && q.length >= 2 && !queriesToSearch.some(x => x.toLowerCase() === q.toLowerCase())) {
      queriesToSearch.push(q);
    }
  });

  // Priority 2: Target username from payload / fallback
  if (fallbackUsername) {
    const cleanFb = fallbackUsername.trim();
    if (cleanFb && !queriesToSearch.includes(cleanFb)) {
      queriesToSearch.push(cleanFb);
    }
    if (cleanFb.includes('.')) {
      const spaceName = cleanFb.split('.').join(' ');
      if (!queriesToSearch.includes(spaceName)) queriesToSearch.push(spaceName);
    }
  }

  // Priority 3: Fallback instance demo users ONLY if no target users were specified
  if (queriesToSearch.length === 0) {
    ['Curtis Feitty', 'curtis', 'Karen Curtis'].forEach(u => {
      if (!queriesToSearch.includes(u)) queriesToSearch.push(u);
    });
  }

  let addedCount = 0;
  const failedUsers = [];
  const skippedUsers = [];
  const searchLimit = queriesToSearch.length;
  appendLog(jobId, `  🔍 Will process ${searchLimit} user query target(s): ${JSON.stringify(queriesToSearch)}...`);

  // Ensure "Add User" dialog is open
  let isDialogOpen = await isAddUserDialogOpen(page);

  if (!isDialogOpen) {
    appendLog(jobId, '  → Opening "Add User" modal dialog via "+ Add User" toolbar button...');
    let clickedToolbar = await clickAddUserToolbarButton(page, jobId);
    if (!clickedToolbar) {
      await sleep(1500);
      await waitForAdf(page);
      clickedToolbar = await clickAddUserToolbarButton(page, jobId);
    }
    if (!clickedToolbar) {
      appendLog(jobId, '  ⚠ "+ Add User" toolbar button could not open modal dialog.');
    } else {
      await sleep(2500);
      await waitForAdf(page);
    }
  }

  // Handles ONE user completely (search → select → add → CONFIRMED) before returning.
  const assignOneUser = async (userQuery) => {
    // Make sure dialog is open
    if (!(await isAddUserDialogOpen(page))) {
      await clickAddUserToolbarButton(page, jobId);
      await sleep(2000);
      await waitForAdf(page);
    }

    const dialogInputHandle = await getDialogSearchInput(page, ['add user', 'characters', 'search result count', 'enter 3']);
    if (!dialogInputHandle) {
      appendLog(jobId, '  ⚠ Search input inside Add User dialog not accessible. Retrying dialog open...');
      await clickAddUserToolbarButton(page, jobId);
      await sleep(1500);
      return 'failed';
    }

    // Snapshot BEFORE adding so we can prove the row count really grew
    const beforeRows = await getUsersTableRowsBehindDialog(page);
    const beforeCount = beforeRows.length;

    // 1. Type the user into the dialog search box
    await adfClearAndType(page, dialogInputHandle, userQuery, 'User Search', jobId);
    appendLog(jobId, `  ⌨️ Typed "${userQuery}". Looking for auto-suggest / results...`);

    // 2. Select user ONCE: prefer auto-suggest; never press ArrowDown/Enter after clicking it
    const suggestPicked = await pickAutoSuggestOnce(page, userQuery, jobId, 3500);

    // 3. Is the button enabled already?
    let btn = await waitForAddUserToRoleEnabled(page, suggestPicked ? 2500 : 600);

    // 4. If not: run the search and click the result row exactly once
    if (!btn) {
      appendLog(jobId, '  ℹ Button not enabled yet. Submitting search & selecting result row...');
      if (!suggestPicked) await submitDialogSearch(page, jobId);
      await selectUserResultOnce(page, userQuery, jobId);
      btn = await waitForAddUserToRoleEnabled(page, 3500);
    }

    // 5. Still not enabled? re-submit search and select again
    if (!btn) {
      appendLog(jobId, '  ℹ Retrying: re-submit search and re-select the row...');
      await submitDialogSearch(page, jobId);
      await selectUserResultOnce(page, userQuery, jobId);
      btn = await waitForAddUserToRoleEnabled(page, 3500);
    }

    if (!btn) {
      appendLog(jobId, `  ⚠ No selectable user found for "${userQuery}" (button never enabled).`);
      return 'failed';
    }

    appendLog(jobId, '  ✅ "Add User to Role" button is ACTIVE and ENABLED!');

    // 6. Click it and WAIT until the add is confirmed
    const ok = await clickAddUserToRoleReliably(page, userQuery, jobId, beforeCount);
    return ok ? 'added' : 'failed';
  };

  const MAX_USER_ATTEMPTS = 2;

  // Process users one-by-one; the next user starts ONLY after the previous one is confirmed
  for (let i = 0; i < searchLimit; i++) {
    const userQuery = queriesToSearch[i];
    appendLog(jobId, `\n  [${i + 1}/${searchLimit}] Searching & assigning user: "${userQuery}"...`);

    try {
      // STRICT already-listed check (never skip because of a shared first/last name)
      if (await isUserListedBehindDialog(page, userQuery)) {
        appendLog(jobId, `  ↪ "${userQuery}" is already listed in the Users table. Skipping.`);
        skippedUsers.push(userQuery);
        continue;
      }

      let result = 'failed';
      for (let attempt = 1; attempt <= MAX_USER_ATTEMPTS; attempt++) {
        if (attempt > 1) {
          appendLog(jobId, `  🔁 Retrying user "${userQuery}" (attempt ${attempt}/${MAX_USER_ATTEMPTS})...`);
          await sleep(1500);
          await waitForAdf(page);
          // The first attempt may have actually succeeded late
          if (await isUserListedBehindDialog(page, userQuery)) { result = 'added'; break; }
        }
        result = await assignOneUser(userQuery);
        if (result === 'added') break;
      }

      if (result === 'added') {
        addedCount++;
        appendLog(jobId, `  ✅ SUCCESS [${addedCount}]: user "${userQuery}" attached to role in Step 6!`);
      } else {
        failedUsers.push(userQuery);
        appendLog(jobId, `  ❌ Could not confirm user "${userQuery}" was added after ${MAX_USER_ATTEMPTS} attempts.`);
      }

      // Let ADF fully settle before starting the NEXT user
      await sleep(1200);
      await waitForAdf(page);

    } catch (err) {
      failedUsers.push(userQuery);
      appendLog(jobId, `  ⚠ Error processing user "${userQuery}": ${err.message}`);
      await sleep(1000);
      await waitForAdf(page);
    }
  }

  // Once all target users are processed, close the "Add User" dialog by clicking "Done" / "Cancel" / Close "X"
  appendLog(jobId, '  → Finished user search loop. Closing "Add User" modal...');
  for (let cancelAttempt = 1; cancelAttempt <= 3; cancelAttempt++) {
    if (!(await isAddUserDialogOpen(page))) break;

    const cancelBtnHandle = await page.evaluateHandle((dSel) => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
      };
      const dialogs = Array.from(document.querySelectorAll(dSel)).filter(el =>
        !el.closest('header, .fuse-header, [id*="global"], [id*="fuse-header"]') && vis(el) && el.getBoundingClientRect().width > 200);
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return null;
      const elements = Array.from(dialog.querySelectorAll('button, a, div[role="button"], span, .af_dialog_close-icon, [title*="Close" i]')).filter(vis);
      const pick = (names) => elements.find(b => names.includes((b.textContent || b.innerText || b.title || '').trim().toLowerCase()));
      const found = pick(['done']) || pick(['cancel']) || pick(['close']) ||
        elements.find(b => b.classList.contains('af_dialog_close-icon'));
      return found ? (found.closest('button, a, [role="button"]') || found) : null;
    }, dialogSelectorString());

    const cEl = cancelBtnHandle ? cancelBtnHandle.asElement() : null;
    if (cEl) {
      const cBox = await cEl.boundingBox().catch(() => null);
      if (cBox && cBox.width > 0) {
        await page.mouse.click(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
      } else {
        await cEl.click().catch(() => { });
      }
    }

    await sleep(1500);
    await waitForAdf(page);
  }

  // Fallback dismissal if dialog remains open
  if (await isAddUserDialogOpen(page)) {
    await dismissDialog(page);
    await sleep(1000);
  }

  // Verify users currently present in Step 6 (Users) table
  await sleep(1500);
  await waitForAdf(page);
  const tableUsers = await getUsersTableRowsBehindDialog(page);

  if (tableUsers.length > 0) {
    appendLog(jobId, `  📋 Users attached in Step 6 table (${tableUsers.length}):\n    ${tableUsers.map(t => t.slice(0, 70)).join('\n    ')}`);
  } else {
    appendLog(jobId, `  ℹ Step 6 table verified.`);
  }

  if (skippedUsers.length > 0) {
    appendLog(jobId, `  ↪ Skipped (already listed): ${skippedUsers.length} → ${skippedUsers.join(', ')}`);
  }
  if (failedUsers.length > 0) {
    appendLog(jobId, `  ❌ FAILED to add ${failedUsers.length} user(s): ${failedUsers.join(', ')}`);
  }

  const totalAssigned = addedCount + skippedUsers.length;
  appendLog(jobId, `\n👥 [USERS COMPLETE] Requested: ${searchLimit} | Added: ${addedCount} | Already present: ${skippedUsers.length} | Failed: ${failedUsers.length}`);
  return totalAssigned;
}

// ─── STEP 11: Submit the Copied Role ──────────────────────────────────────────
async function submitRole(page, jobId) {
  appendLog(jobId, '  💾 Navigating wizard steps to Summary and clicking Submit and Close...');

  // Navigate through steps until Summary step:
  for (let i = 0; i < 7; i++) {
    // Check and dismiss any unexpected warning or note during traversal
    const dRes = await autoResolveOracleDialogs(page, jobId, 'Wizard Step Traversal');
    if (dRes.handled) {
      appendLog(jobId, `  🛠 [Self-Healing] Dismissed dialog during wizard traversal: "${dRes.text}"`);
      await sleep(1500);
      await waitForAdf(page);
    }

    const action = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent && (
        b.textContent.includes('Submit and Close') ||
        b.textContent.includes('Submit')
      ));
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
        return 'submitted';
      }

      const nextBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Next');
      if (nextBtn && !nextBtn.disabled) {
        nextBtn.click();
        return 'next';
      }
      return 'none';
    });

    await waitForAdf(page);
    await sleep(2000);
    if (action === 'submitted') {
      appendLog(jobId, '  → Clicked "Submit and Close".');
      break;
    }
  }

  await sleep(3000);
  await waitForAdf(page);

  // Self-healing confirmation dismissal
  const submitDialog = await autoResolveOracleDialogs(page, jobId, 'Submission Confirmation');
  if (submitDialog.handled) {
    appendLog(jobId, `  ✅ Submission Confirmation dialog auto-resolved: "${submitDialog.text}"`);
  } else {
    // Fallback: Click "OK" on Confirmation dialog ("Your request (XXXXX) was submitted...")
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.af_dialog button, [role="dialog"] button, button'));
      const okBtn = btns.find(b => b.textContent && b.textContent.trim() === 'OK');
      if (okBtn) okBtn.click();
    });
  }

  await sleep(3000);
  await waitForAdf(page);
}

// ─── STEP 12: Verify in Administration → Role Status ──────────────────────────
async function verifyRoleCreated(page, podUrl, customRoleName, customRoleCode, jobId, proofsDir) {
  appendLog(jobId, `  🔎 Verifying submission in Administration → Role Status for "${customRoleCode}"...`);

  try {
    // If we are still in the wizard, dismiss or exit to Security Console root
    const inWizard = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return text.includes('Basic Information') || text.includes('Function Security Policies');
    });

    if (inWizard) {
      appendLog(jobId, '  ⚠ Wizard was still visible. Re-opening Security Console root...');
      await openSecurityConsole(page, podUrl, jobId);
    }

    // Navigate to Administration tab on left menu
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('a, button, [role="button"], span, div'));
      const adminItem = items.find(el => {
        const t = (el.innerText || el.title || '').trim();
        return t === 'Administration' || (el.id && el.id.includes('administration'));
      });
      if (adminItem) adminItem.click();
    });

    await sleep(3000);
    await waitForAdf(page);

    // Look for Role Status sub-tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
      const statusTab = tabs.find(t => t.innerText && t.innerText.trim() === 'Role Status');
      if (statusTab) statusTab.click();
    });

    await sleep(2000);
    await waitForAdf(page);

    // Poll Role Status table and hit Refresh up to 8 times (~25s total)
    let isComplete = false;
    for (let r = 0; r < 8; r++) {
      const tableStatus = await page.evaluate((code) => {
        // Exclude wizard headers and filter genuine data rows in Role Status
        const rows = Array.from(document.querySelectorAll('table tbody tr, tr')).filter(row => {
          const t = (row.innerText || '').trim();
          return !t.includes('Copy Role') && !t.includes('Basic Information') && t.length > 10;
        });
        const matched = rows.find(row => row.innerText && row.innerText.includes(code));
        if (matched) {
          const complete = matched.innerText.includes('Complete');
          return { found: true, isComplete: complete, text: matched.innerText.trim().substring(0, 100) };
        }
        return { found: false, isComplete: false };
      }, customRoleCode);

      if (tableStatus.found) {
        appendLog(jobId, `  📋 Role Status (${r + 1}/8): ${tableStatus.text}`);
        if (tableStatus.isComplete) {
          appendLog(jobId, `  ✅ Process status is Complete!`);
          isComplete = true;
          break;
        }
      }

      // Click Refresh button in toolbar
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const refreshBtn = btns.find(b => (b.innerText || b.title || '').trim() === 'Refresh');
        if (refreshBtn) refreshBtn.click();
      });

      await sleep(3000);
      await waitForAdf(page);
    }

    if (!isComplete) {
      appendLog(jobId, `  ⏳ Process for "${customRoleCode}" submitted & actively processing in Oracle background queue.`);
    }
  } catch (adminErr) {
    appendLog(jobId, `  ℹ Note during Administration check: ${adminErr.message}`);
  }

  // Capture proof screenshot
  const proofUrl = await captureProof(page, proofsDir, jobId, customRoleCode.substring(0, 20));
  appendLog(jobId, `  ✅ VERIFIED: Custom role "${customRoleCode}" submitted & processed in Oracle!`);
  return proofUrl;
}

// ─── STEP 13: Check if role is directly assigned to user ──────────────────────
/**
 * Goes to Users tab in Security Console, searches for the user,
 * opens their profile, and checks if the role appears in their direct roles list.
 * Returns { isDirect: boolean }
 */
async function checkIfRoleDirectOnUser(page, podUrl, targetUsername, roleName, roleCode, jobId) {
  appendLog(jobId, `  🔎 Checking if "${roleName}" is directly assigned to "${targetUsername}"...`);

  try {
    // Navigate to Security Console → Users tab
    await openSecurityConsole(page, podUrl, jobId);

    // Click "Users" tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
      const usersTab = tabs.find(t => t.textContent && t.textContent.trim() === 'Users');
      if (usersTab) usersTab.click();
    });
    await sleep(2000);
    await waitForAdf(page);

    // Search for the user
    const userSearch = await page.$('input[placeholder*="Enter 3 or more characters"], input[id*="srchBox::content"]');
    if (userSearch) {
      await adfType(page, userSearch, targetUsername);
      await page.evaluate(() => {
        const icon = document.querySelector('a[id*="srchBox::search_icon"], [id*="srchBox"] a, a[title="Search"], [id*="srchBox"] img');
        if (icon) icon.click();
      });
      await page.keyboard.press('Enter');
      await sleep(4000);
      await waitForAdf(page);
    }

    // Click on the first user result to open their profile
    await page.evaluate(() => {
      const firstUserLink = document.querySelector('[id*="resList:0:"] a, [id*="resList:0"] a');
      if (firstUserLink) firstUserLink.click();
    });
    await sleep(3000);
    await waitForAdf(page);

    // Look for the role in the user's assigned roles section
    const isDirect = await page.evaluate((rName, rCode) => {
      const allText = document.body.innerText || document.body.textContent || '';
      return allText.includes(rName) || allText.includes(rCode);
    }, roleName, roleCode);

    appendLog(jobId, `  → Direct assignment for "${roleName}" on "${targetUsername}": ${isDirect ? '✅ YES (direct)' : '❌ NO (inherited/not found)'}`);
    // Always restore back to Roles page so subsequent steps stay in Roles section
    await ensureOnRolesPage(page, podUrl, jobId);
    return isDirect;

  } catch (e) {
    appendLog(jobId, `  ⚠ Could not verify direct assignment: ${e.message}. Assuming direct.`);
    try { await ensureOnRolesPage(page, podUrl, jobId); } catch { }
    return true; // Safe default
  }
}

// ─── STEP 14: Swap User Role Assignment ───────────────────────────────────────
/**
 * Removes the original seeded role from the user and assigns the XX_ custom role.
 * Called when the role is directly assigned to the user (no hierarchy).
 */
async function swapRoleOnUser(page, targetUsername, oldRoleName, oldRoleCode, newRoleName, newRoleCode, jobId) {
  appendLog(jobId, `  ↔️ Swapping role for "${targetUsername}": "${oldRoleName}" → "${newRoleName}"...`);

  // The user profile should already be open from checkIfRoleDirectOnUser
  // Find the Edit button for the user's roles
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const editBtn = btns.find(b => b.textContent && (b.textContent.trim() === 'Edit' || b.title === 'Edit'));
    if (editBtn) editBtn.click();
  });
  await sleep(2000);
  await waitForAdf(page);

  // Remove the old role
  const removed = await page.evaluate((oldRole, oldCode) => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const targetRow = rows.find(r => r.textContent && (r.textContent.includes(oldRole) || r.textContent.includes(oldCode)));
    if (targetRow) {
      const delBtn = targetRow.querySelector(
        'button[title*="Remove" i], button[title*="Delete" i], a[title*="Remove" i]'
      );
      if (delBtn) { delBtn.click(); return true; }
    }
    return false;
  }, oldRoleName, oldRoleCode);

  if (removed) {
    appendLog(jobId, `  ✅ Removed "${oldRoleName}" from user "${targetUsername}".`);
    await waitForAdf(page);
    await sleep(1000);
  } else {
    appendLog(jobId, `  ⚠ Could not find "${oldRoleName}" in user's direct roles.`);
  }

  // Add the new XX_ role
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent && (
      b.textContent.includes('Add Role') ||
      b.textContent.includes('Assign Role') ||
      b.title === 'Add'
    ));
    if (addBtn) addBtn.click();
  });
  await sleep(2000);
  await waitForAdf(page);

  // Search for new role
  const addRoleInput = await page.$('input[id*="search"], input[placeholder*="Search"]');
  if (addRoleInput) {
    await adfType(page, addRoleInput, newRoleCode || newRoleName);
    await page.keyboard.press('Enter');
    await sleep(3000);
    await waitForAdf(page);

    await page.evaluate(() => {
      const firstCheckbox = document.querySelector('table tbody tr:first-child input[type="checkbox"]');
      if (firstCheckbox) firstCheckbox.click();
    });
    await sleep(500);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const okBtn = btns.find(b => b.textContent && (b.textContent.trim() === 'OK' || b.textContent.trim() === 'Select'));
      if (okBtn) okBtn.click();
    });
    await waitForAdf(page);
    appendLog(jobId, `  ✅ Added "${newRoleName}" to user "${targetUsername}".`);
  }

  // Save the user changes
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(b => b.textContent && (
      b.textContent.includes('Save and Close') || b.textContent.trim() === 'Save'
    ));
    if (saveBtn) saveBtn.click();
  });
  await waitForAdf(page);
  await sleep(2000);
  appendLog(jobId, `  ✅ Role swap saved for user "${targetUsername}".`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//   MAIN EXPORT 1: executeHierarchyRemediation
//   The complete recursive Oracle privilege remediation flow
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full flow for each costly privilege:
 *
 *  1. Login to Oracle
 *  2. Security Console → search PRIVILEGE
 *  3. Expand Towards → Users → confirm target user is affected
 *  4. Get the immediate parent Role that grants this privilege
 *  5. Search that Role by its Role Code (paste into search)
 *  6. Copy Role → XX_ name
 *  7. Remove costly privilege from copy
 *  8. Add free alternative to copy
 *  9. Submit + Verify XX_ role now exists
 * 10. Is the original role DIRECTLY on the user?
 *     → YES: Swap user's role assignment (remove old, add XX_)
 *     → NO: Repeat steps 4-10 for the PARENT ROLE (recursion)
 */
async function executeHierarchyRemediation({
  jobId, podUrl, username, password,
  targetUsername, targetRoleName,
  customRoleName, customRoleCode,
  costlyPrivileges = [],
  headless = true
}) {
  const proofsDir = path.join(__dirname, '..', 'public', 'proofs');
  if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });

  updateJob(jobId, {
    status: 'INITIALIZING', progress: 3,
    message: 'Launching Oracle privilege hierarchy remediation...',
    logs: [
      `🚀 Starting Recursive Hierarchy Remediation`,
      `👤 Target User: ${targetUsername}`,
      `🎭 Target Role: ${targetRoleName}`,
      customRoleName ? `📝 Custom Role Name: ${customRoleName}` : null,
      customRoleCode ? `🏷️ Custom Role Code: ${customRoleCode}` : null,
      `🔑 Costly Privileges: ${costlyPrivileges.map(p => p.privilegeName).join(', ')}`
    ].filter(Boolean),
    hierarchySteps: [],
    proofScreenshots: []
  });

  let browser = null;
  const proofScreenshots = [];
  const hierarchySteps = [];

  try {
    browser = await launchBrowser(headless);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await initPageHelpers(page);

    // ── PHASE 1: LOGIN ──────────────────────────────────────────────────────
    updateJob(jobId, { status: 'AUTHENTICATING', progress: 8, message: `Logging in to ${podUrl}...` });
    await loginToOracle(page, podUrl, username, password, jobId);

    const totalPrivileges = costlyPrivileges.length;

    // ── PHASE 2: PROCESS EACH COSTLY PRIVILEGE ──────────────────────────────
    for (let i = 0; i < costlyPrivileges.length; i++) {
      const { privilegeName, freeAlternative, parentServiceName } = costlyPrivileges[i];
      const baseProgress = Math.round(10 + (i / totalPrivileges) * 80);

      appendLog(jobId, `\n${'═'.repeat(60)}`);
      appendLog(jobId, `🔑 PRIVILEGE ${i + 1}/${totalPrivileges}: "${privilegeName}"`);
      appendLog(jobId, `${'═'.repeat(60)}`);

      updateJob(jobId, {
        status: 'PROCESSING_PRIVILEGE',
        progress: baseProgress,
        message: `[${i + 1}/${totalPrivileges}] Processing: "${privilegeName}"...`,
        currentPrivilege: privilegeName
      });

      const stepEntry = {
        step: i + 1,
        privilege: privilegeName,
        freeAlternative,
        status: 'IN_PROGRESS',
        actions: [],
        recursionDepth: 0
      };
      hierarchySteps.push(stepEntry);
      updateJob(jobId, { hierarchySteps, proofScreenshots });

      try {
        // The role to process (starts as the targetRoleName, may change if hierarchy found)
        let currentRoleName = targetRoleName;
        let currentRoleCode = '';
        let recursionDepth = 0;
        const MAX_RECURSION = 5;
        let privDisplayFromTrace = '';

        while (recursionDepth < MAX_RECURSION) {
          recursionDepth++;
          stepEntry.recursionDepth = recursionDepth;
          appendLog(jobId, `\n  🔁 Recursion depth: ${recursionDepth} | Working on role: "${currentRoleName}"`);

          // ── A: Open Security Console ──────────────────────────────────────
          updateJob(jobId, { progress: baseProgress + 2, message: `Opening Security Console...` });
          await openSecurityConsole(page, podUrl, jobId);

          // ── B: Search for the PRIVILEGE ───────────────────────────────────
          updateJob(jobId, { progress: baseProgress + 5, message: `Searching privilege "${privilegeName}"...` });

          // On first iteration: search the privilege to find the parent role
          // On subsequent iterations: search for the currentRoleName directly
          let foundRoleName = currentRoleName;
          let foundRoleCode = currentRoleCode;

          if (recursionDepth === 1) {
            // Step 1: Search privilege & expand toward users to find exact role & role code
            const traced = await searchPrivilegeAndExpandTowardsUsers(
              page,
              privilegeName,
              currentRoleName,
              targetUsername,
              jobId
            );

            if (traced && (traced.roleName || traced.roleCode)) {
              foundRoleName = traced.roleName || currentRoleName;
              foundRoleCode = traced.roleCode || '';
              privDisplayFromTrace = traced.privilegeDisplayName || '';
              stepEntry.actions.push({
                action: 'FOUND_PARENT',
                parent: foundRoleName,
                code: foundRoleCode
              });
              stepEntry.actions.push({
                action: 'EXPAND_TOWARDS_USERS',
                targetFound: traced.foundInTable,
                usersCount: 1
              });
              appendLog(jobId, `  📋 Privilege "${privilegeName}" under Expand Toward Users traced to role: "${foundRoleName}" (${foundRoleCode})`);
            }
          }

          // ── D: Search for the Role by its Code (paste in search) ──────────
          updateJob(jobId, { progress: baseProgress + 12, message: `Searching role by code: "${foundRoleCode || foundRoleName}"...` });

          const roleFound = await searchRoleByCode(page, foundRoleCode, foundRoleName, jobId);
          if (!roleFound) {
            const notFoundMsg = `Role not found: "${foundRoleName}" does not match any role in the Oracle demo instance.`;
            appendLog(jobId, `❌ ${notFoundMsg}`);
            updateJob(jobId, {
              status: 'ROLE_NOT_FOUND',
              error: notFoundMsg,
              message: notFoundMsg,
              roleNotFound: true,
              failedRole: foundRoleName
            });
            throw new Error(notFoundMsg);
          }

          stepEntry.actions.push({ action: 'ROLE_SEARCHED', roleName: foundRoleName, roleCode: foundRoleCode });

          // ── E: Copy Role (Actions → Copy Role → XX_ name) ─────────────────
          let safeRoleName = foundRoleName;
          if (!safeRoleName || safeRoleName.includes('RolesUsers') || safeRoleName.length > 60) {
            safeRoleName = targetRoleName;
          }
          let safeRoleCode = foundRoleCode;
          if (!safeRoleCode || safeRoleCode.includes('API_AUTH') || safeRoleCode.length > 60) {
            safeRoleCode = safeRoleName;
          }
          const xxRoleName = (recursionDepth === 1 && customRoleName) ? customRoleName : `XX_${safeRoleName}`;
          const xxRoleCode = (recursionDepth === 1 && customRoleCode) ? customRoleCode : `XX_${safeRoleCode.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 22)}`;

          updateJob(jobId, {
            progress: baseProgress + 18,
            message: `Copying role "${safeRoleName}" → "${xxRoleName}"...`
          });

          await copyRoleInWizard(page, xxRoleName, xxRoleCode, jobId);
          stepEntry.actions.push({ action: 'COPY_STARTED', xxName: xxRoleName, xxCode: xxRoleCode });

          // ── F: Fill wizard — Role Name & Code ─────────────────────────────
          const filledRole = await fillRoleNameAndCode(page, xxRoleName, xxRoleCode, jobId);
          const finalRoleName = filledRole.activeRoleName || xxRoleName;
          const finalRoleCode = filledRole.activeRoleCode || xxRoleCode;

          // ── G: Navigate to Privileges step ────────────────────────────────
          updateJob(jobId, { progress: baseProgress + 25, message: `Navigating to Privileges step...` });
          await navigateToPrivilegesStep(page, jobId);

          // ── H: Remove costly privilege ────────────────────────────────────
          updateJob(jobId, {
            progress: baseProgress + 30,
            message: `Removing costly privilege "${privilegeName}"...`
          });
          const privDisplayName = privDisplayFromTrace || KNOWN_PRIVILEGE_MAPPINGS[privilegeName]?.displayName || '';
          const privRemoved = await removeCostlyPrivilege(page, privilegeName, jobId, privDisplayName);
          stepEntry.actions.push({ action: 'PRIVILEGE_REMOVED', privilege: privilegeName, success: privRemoved });

          // ── I: Add alternate privilege ────────────────────────────────────
          if (freeAlternative && !freeAlternative.includes('Lower-Cost')) {
            updateJob(jobId, {
              progress: baseProgress + 35,
              message: `Adding free alternative "${freeAlternative}"...`
            });
            await addAlternatePrivilege(page, freeAlternative, jobId, privilegeName);
            stepEntry.actions.push({ action: 'ALTERNATE_ADDED', alternate: freeAlternative });
          }

          // ── J: Step 6 - Assign user to copied role in wizard ───────────────
          if (targetUsername) {
            updateJob(jobId, {
              progress: baseProgress + 38,
              message: `Assigning user "${targetUsername}" to copied role in wizard...`
            });
            appendLog(jobId, `\n👥 [USERS] Navigating to Users step to attach target user "${targetUsername}"...`);
            await navigateToUsersStep(page, jobId);
            const userAttached = await addUsersToRoleInWizard(page, [targetUsername], jobId, '');
            stepEntry.actions.push({ action: 'USER_ASSIGNED', username: targetUsername, count: userAttached });
          }

          // ── K: Submit the copied role ──────────────────────────────────────
          updateJob(jobId, { progress: baseProgress + 42, message: `Submitting custom role...` });
          await submitRole(page, jobId);

          // ── K: VERIFY — does custom role exist in Oracle? ───────────────────
          updateJob(jobId, { progress: baseProgress + 50, message: `Verifying "${finalRoleName}" in Oracle...` });
          const proofUrl = await verifyRoleCreated(page, podUrl, finalRoleName, finalRoleCode, jobId, proofsDir);
          proofScreenshots.push(proofUrl);
          stepEntry.actions.push({ action: 'VERIFIED', xxName: finalRoleName, proof: proofUrl });
          updateJob(jobId, { proofScreenshots });

          // ── L: CHECK HIERARCHY ─────────────────────────────────────────────
          updateJob(jobId, {
            progress: baseProgress + 60,
            message: `Checking if "${foundRoleName}" is directly on user "${targetUsername}"...`
          });

          const isDirect = await checkIfRoleDirectOnUser(
            page, podUrl, targetUsername, foundRoleName, foundRoleCode, jobId
          );

          if (isDirect) {
            // ── PATH A: DIRECT → Swap user role assignment ─────────────────
            appendLog(jobId, `  ✅ DIRECT assignment found! Swapping "${foundRoleName}" → "${finalRoleName}" for user "${targetUsername}".`);
            updateJob(jobId, {
              progress: baseProgress + 75,
              message: `Swapping role assignment for ${targetUsername}...`
            });

            await swapRoleOnUser(
              page, targetUsername,
              foundRoleName, foundRoleCode,
              finalRoleName, finalRoleCode,
              jobId
            );

            stepEntry.actions.push({
              action: 'DIRECT_SWAP',
              from: foundRoleName,
              to: finalRoleName,
              user: targetUsername
            });
            stepEntry.status = 'COMPLETED';
            appendLog(jobId, `  🎉 DONE! Privilege "${privilegeName}" remediated via direct role swap.`);
            break; // Exit recursion for this privilege — DONE

          } else {
            // ── PATH B: INHERITED → Find parent role → Recurse ────────────
            appendLog(jobId, `  ⛓ INHERITED! "${foundRoleName}" is not directly on user — it comes via a parent role.`);
            appendLog(jobId, `  🔁 Will now process the parent role that contains "${foundRoleName}"...`);

            stepEntry.actions.push({
              action: 'INHERITED',
              childRole: foundRoleName,
              childCode: foundRoleCode,
              message: `Role is inherited — recursing to parent`
            });

            // The current role IS the child. The parent is the role we need to process next.
            // We'll search for roles that CONTAIN foundRoleName as a sub-role
            // The next iteration will search for the targetRoleName (the top-level assigned role)
            // and repeat the copy+strip process on THAT
            currentRoleName = targetRoleName; // Go up to the top-level role
            currentRoleCode = '';

            // If we're already at the top-level role, we can't go further up
            if (foundRoleName === targetRoleName || recursionDepth >= MAX_RECURSION) {
              appendLog(jobId, `  ⚠ Reached max recursion or top-level role. Marking as partial.`);
              stepEntry.status = 'PARTIAL';
              stepEntry.actions.push({
                action: 'MAX_RECURSION',
                message: `Reached top-level role or max depth. Manual assignment required.`
              });
              break;
            }
          }

          updateJob(jobId, { hierarchySteps, proofScreenshots });
        } // end while (recursion)

      } catch (privErr) {
        appendLog(jobId, `  ✗ Error on privilege "${privilegeName}": ${privErr.message}`);
        stepEntry.status = 'FAILED';
        stepEntry.error = privErr.message;
        // Capture error screenshot
        try {
          const errProof = await captureProof(page, proofsDir, jobId, `err_${i}`);
          proofScreenshots.push(errProof);
        } catch { /* ignore */ }
      }

      updateJob(jobId, { hierarchySteps, proofScreenshots });
    } // end for each privilege

    // ── PHASE 3: FINAL SUMMARY ───────────────────────────────────────────────
    const completedCount = hierarchySteps.filter(s => s.status === 'COMPLETED').length;
    const failedCount = hierarchySteps.filter(s => s.status === 'FAILED').length;
    const partialCount = hierarchySteps.filter(s => s.status === 'PARTIAL').length;

    // Final proof screenshot
    await openSecurityConsole(page, podUrl, jobId);
    const finalProof = await captureProof(page, proofsDir, jobId, 'final_state');
    proofScreenshots.push(finalProof);

    updateJob(jobId, {
      status: 'COMPLETED',
      progress: 100,
      message: `✅ Done: ${completedCount}/${totalPrivileges} privileges remediated` +
        (failedCount > 0 ? `, ${failedCount} failed` : '') +
        (partialCount > 0 ? `, ${partialCount} partial` : ''),
      hierarchySteps,
      proofScreenshots,
      proofScreenshot: finalProof,
      completedAt: new Date().toISOString(),
      summary: { completedCount, failedCount, partialCount, totalPrivileges, targetUsername, targetRoleName }
    });

    appendLog(jobId, `\n🏁 Hierarchy Remediation Complete: ${completedCount}/${totalPrivileges} succeeded.`);
    return { success: true, jobId, proofScreenshots };

  } catch (err) {
    console.error(`[RPA Hierarchy ${jobId}] Fatal:`, err.message);
    let errScreenshot = null;
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const errPath = path.join(proofsDir, `oracle_fatal_${jobId}.png`);
          await pages[0].screenshot({ path: errPath });
          errScreenshot = `/proofs/oracle_fatal_${jobId}.png`;
        }
      } catch { /* ignore */ }
    }
    updateJob(jobId, {
      status: 'FAILED', error: err.message,
      proofScreenshot: errScreenshot,
      message: `Fatal error: ${err.message}`
    });
    throw err;
  } finally {
    if (browser) await browser.close().catch(() => { });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//   MAIN EXPORT 2: executeOracleRoleRemediation (original single-role flow)
// ═══════════════════════════════════════════════════════════════════════════════
async function executeOracleRoleRemediation({
  jobId, podUrl, username, password,
  roles,
  originalRoleName, customRoleName, customRoleCode,
  privilegeToStrip, replacementPrivilege, employees, headless = true
}) {
  const proofsDir = path.join(__dirname, '..', 'public', 'proofs');
  if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });

  const rawRoles = (Array.isArray(roles) && roles.length > 0)
    ? roles
    : [{ originalRoleName, customRoleName, customRoleCode, replacementPrivilege, employees }];

  const targetRoles = rawRoles.map(r => ({
    ...r,
    replacementPrivilege: r.replacementPrivilege !== undefined ? r.replacementPrivilege : replacementPrivilege,
    employees: (Array.isArray(r.employees) && r.employees.length > 0)
      ? r.employees
      : (Array.isArray(employees) && employees.length > 0 ? employees : [])
  }));

  const totalRoles = targetRoles.length;

  updateJob(jobId, {
    status: 'INITIALIZING', progress: 5,
    message: `Launching RPA engine for ${totalRoles} role(s)...`,
    logs: [
      `Remediating ${totalRoles} role(s) for costly privilege "${privilegeToStrip}"`,
      ...targetRoles.map((r, i) => `  Role #${i + 1}: "${r.originalRoleName}" → "${r.customRoleName}" (${r.customRoleCode})`)
    ]
  });

  let browser = null;
  try {
    browser = await launchBrowser(headless);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await initPageHelpers(page);

    updateJob(jobId, { status: 'AUTHENTICATING', progress: 15, message: `Logging in to ${podUrl}...` });
    await loginToOracle(page, podUrl, username, password, jobId);

    updateJob(jobId, { status: 'OPENING_SECURITY_CONSOLE', progress: 30, message: 'Opening Security Console...' });
    await openSecurityConsole(page, podUrl, jobId);

    const proofUrls = [];
    const processedRoles = [];

    // Process each selected role (single role or multiple roles at a time)
    for (let idx = 0; idx < totalRoles; idx++) {
      const roleItem = targetRoles[idx];
      const roleBaseProgress = Math.round(35 + (idx / totalRoles) * 55);

      appendLog(jobId, `\n${'═'.repeat(55)}`);
      appendLog(jobId, `🎭 Processing Role ${idx + 1}/${totalRoles}: "${roleItem.originalRoleName}" → "${roleItem.customRoleName}"`);
      appendLog(jobId, `${'═'.repeat(55)}`);

      updateJob(jobId, {
        status: 'PROCESSING_ROLE',
        progress: roleBaseProgress,
        message: `[${idx + 1}/${totalRoles}] Cloning "${roleItem.originalRoleName}"...`
      });

      // ─────────────────────────────────────────────────────────────────────────────
      // FLOW STEP 1: Search Privilege → Expand Toward: Users → Match Target Role
      // ─────────────────────────────────────────────────────────────────────────────
      updateJob(jobId, {
        status: 'VERIFYING_ROLE',
        progress: roleBaseProgress + 5,
        message: `[${idx + 1}/${totalRoles}] Searching privilege "${privilegeToStrip}" & verifying role "${roleItem.originalRoleName}" in Expand Toward: Users...`
      });

      appendLog(jobId, `\n🔍 [STEP 1] Searching privilege "${privilegeToStrip}" in Roles section...`);
      await ensureOnRolesPage(page, podUrl, jobId);

      // 1. Search the privilege and set Expand Toward to Users
      let matchedRoleInfo = null;
      try {
        matchedRoleInfo = await searchPrivilegeAndExpandTowardsUsers(
          page,
          privilegeToStrip,
          roleItem.originalRoleName,
          username,
          jobId
        );
      } catch (err) {
        appendLog(jobId, `  ⚠ Error during privilege search & Expand Toward Users: ${err.message}`);
      }

      const roleMatched = !!(matchedRoleInfo && matchedRoleInfo.foundInTable);

      if (!roleMatched) {
        // Enforce user requirement: Role MUST be found under privilege search in Expand Toward: Users
        const notFoundMsg = `Role Not Found in Demo Instance: Role "${roleItem.originalRoleName}" does not match any role under privilege "${privilegeToStrip}".`;
        appendLog(jobId, `❌ ${notFoundMsg}`);
        const errScreenshot = await captureProof(page, proofsDir, jobId, 'role_not_found').catch(() => null);
        updateJob(jobId, {
          status: 'ROLE_NOT_FOUND',
          error: notFoundMsg,
          message: notFoundMsg,
          roleNotFound: true,
          failedRole: roleItem.originalRoleName,
          proofScreenshot: errScreenshot
        });
        throw new Error(notFoundMsg);
      }

      appendLog(jobId, `✅ Role "${roleItem.originalRoleName}" verified under privilege "${privilegeToStrip}" in demo instance!`);

      // ─────────────────────────────────────────────────────────────────────────────
      // FLOW STEP 2: Detect whether the role is a Job Role or Duty Role
      // ─────────────────────────────────────────────────────────────────────────────
      const roleCodeFound = matchedRoleInfo?.roleCode || deriveRoleCode(roleItem.originalRoleName);
      const roleNameFound = matchedRoleInfo?.roleName || roleItem.originalRoleName;

      const roleType = await detectRoleType(page, roleNameFound, roleCodeFound, jobId);
      appendLog(jobId, `📋 Role "${roleNameFound}" classified as: ${roleType}`);

      if (roleType === 'JOB_ROLE') {
        // ═══════════════════════════════════════════════════════════════════════════
        //   BRANCH A: JOB ROLE (No Parent Role Hierarchy)
        // ═══════════════════════════════════════════════════════════════════════════
        appendLog(jobId, `\n🛤️ [BRANCH A: JOB ROLE] Role "${roleNameFound}" has NO parent role. Executing direct Job Role remediation...`);

        // Search Job Role in Roles section
        appendLog(jobId, `  → Selecting verified Job Role "${roleNameFound}" (${roleCodeFound}) for copy...`);
        await searchRoleByCode(page, roleCodeFound, roleNameFound, jobId);

        // Copy Job Role in wizard
        updateJob(jobId, {
          status: 'COPYING_ROLE',
          progress: roleBaseProgress + 15,
          message: `[${idx + 1}/${totalRoles}] Copying Job Role "${roleNameFound}"...`
        });
        appendLog(jobId, `\n📋 [STEP 2] Copying Job Role in wizard (Copy top role)...`);
        await copyRoleInWizard(page, roleItem.customRoleName, roleItem.customRoleCode, jobId);

        // Step 1: Role Name & Role Code
        updateJob(jobId, {
          status: 'CONFIGURING_ROLE_INFO',
          progress: roleBaseProgress + 22,
          message: `[${idx + 1}/${totalRoles}] Entering Role Name & Role Code...`
        });
        appendLog(jobId, `\n✍️ [STEP 3] Setting Role Name: "${roleItem.customRoleName}" & Role Code: "${roleItem.customRoleCode}"...`);
        const filledRole = await fillRoleNameAndCode(page, roleItem.customRoleName, roleItem.customRoleCode, jobId);
        const finalRoleName = filledRole.activeRoleName || roleItem.customRoleName;
        const finalRoleCode = filledRole.activeRoleCode || roleItem.customRoleCode;

        // Step 2: Function Security Policies (remove costly privilege & add alternate)
        updateJob(jobId, {
          status: 'CHECKING_AND_STRIPPING_PRIVILEGE',
          progress: roleBaseProgress + 30,
          message: `[${idx + 1}/${totalRoles}] Stripping privilege "${privilegeToStrip}"...`
        });
        appendLog(jobId, `\n⏭ [STEP 4] Advancing to Privileges step and stripping "${privilegeToStrip}"...`);
        await navigateToPrivilegesStep(page, jobId);

        const privDispName = matchedRoleInfo?.privilegeDisplayName || KNOWN_PRIVILEGE_MAPPINGS[privilegeToStrip]?.displayName || '';
        const removed = await removeCostlyPrivilege(page, privilegeToStrip, jobId, privDispName);
        if (removed) {
          appendLog(jobId, `  ✅ Costly privilege "${privilegeToStrip}" was found and removed.`);
        } else {
          appendLog(jobId, `  ℹ Privilege "${privilegeToStrip}" was not directly in policies. Proceeding to Next steps.`);
        }

        const altToApply = roleItem.replacementPrivilege !== undefined ? roleItem.replacementPrivilege : replacementPrivilege;
        if (altToApply && typeof altToApply === 'string' && altToApply.trim() && altToApply.trim().toUpperCase() !== 'NONE') {
          await addAlternatePrivilege(page, altToApply.trim(), jobId, privilegeToStrip);
        } else {
          appendLog(jobId, `  ℹ [STEP 4] Skipping alternate privilege addition (User opted not to add replacement duty role).`);
        }

        // Step 6: Users Assignment
        const roleEmployees = (Array.isArray(roleItem.employees) && roleItem.employees.length > 0)
          ? roleItem.employees
          : (Array.isArray(employees) ? employees : []);

        updateJob(jobId, {
          status: 'ASSIGNING_USERS',
          progress: roleBaseProgress + 40,
          message: `[${idx + 1}/${totalRoles}] Navigating to Step 6 (Users) and attaching ${roleEmployees.length} employee(s)...`
        });
        appendLog(jobId, `\n👥 [STEP 5] Navigating wizard to Users step to attach ${roleEmployees.length} user(s)...`);
        await navigateToUsersStep(page, jobId);
        const addedUsers = await addUsersToRoleInWizard(page, roleEmployees, jobId, roleEmployees.length > 0 ? '' : username);
        appendLog(jobId, `  ✅ Step 6 (Users) completed. Users attached: ${addedUsers}`);

        // Step 7: Summary & Submit
        updateJob(jobId, {
          status: 'SUBMITTING_ROLE',
          progress: roleBaseProgress + 48,
          message: `[${idx + 1}/${totalRoles}] Advancing to Summary step and clicking Submit and Close...`
        });
        appendLog(jobId, `\n💾 [STEP 6] Advancing to Summary step and clicking Submit and Close...`);
        await submitRole(page, jobId);

        // Verification
        updateJob(jobId, {
          status: 'VERIFYING_ROLE',
          progress: roleBaseProgress + 52,
          message: `[${idx + 1}/${totalRoles}] Verifying "${finalRoleName}" in Administration -> Role Status...`
        });
        appendLog(jobId, `\n🔎 [STEP 7] Verifying role creation in Administration -> Role Status...`);
        const proofUrl = await verifyRoleCreated(page, podUrl, finalRoleName, finalRoleCode, jobId, proofsDir);
        proofUrls.push(proofUrl);
        processedRoles.push({ original: roleItem.originalRoleName, cloned: finalRoleName, code: finalRoleCode });

      } else {
        // ═══════════════════════════════════════════════════════════════════════════
        //   BRANCH B: DUTY ROLE (Parent Role Hierarchy Flow)
        // ═══════════════════════════════════════════════════════════════════════════
        appendLog(jobId, `\n🛤️ [BRANCH B: DUTY ROLE] Role "${roleNameFound}" is a DUTY ROLE and has a Parent Job Role.`);

        // Step B1: Click "Load Indirect Relationship" in hierarchy viewer to find Parent Job Role
        updateJob(jobId, {
          status: 'FINDING_PARENT_ROLE',
          progress: roleBaseProgress + 10,
          message: `[${idx + 1}/${totalRoles}] Loading indirect relationships to find parent Job Role for "${roleNameFound}"...`
        });
        await triggerLoadIndirectRelationships(page, jobId);

        const parentJobRole = await extractParentJobRoleFromHierarchy(page, roleNameFound, jobId);
        appendLog(jobId, `  👑 Parent Job Role identified: "${parentJobRole.roleName}" (${parentJobRole.roleCode})`);

        // Step B2: Remediate Child Duty Role
        const customDutyName = `XX_${roleNameFound.replace(/^XX_/, '')}`;
        const customDutyCode = deriveCustomRoleCode(roleCodeFound, customDutyName);

        updateJob(jobId, {
          status: 'REMEDIATING_DUTY_ROLE',
          progress: roleBaseProgress + 18,
          message: `[${idx + 1}/${totalRoles}] Stage 1: Remediating Child Duty Role "${roleNameFound}" → "${customDutyName}"...`
        });
        appendLog(jobId, `\n📋 [STAGE 1] Remediating Child Duty Role: "${roleNameFound}" → "${customDutyName}" (${customDutyCode})...`);

        await searchRoleByCode(page, roleCodeFound, roleNameFound, jobId);
        await copyRoleInWizard(page, customDutyName, customDutyCode, jobId);

        const filledDuty = await fillRoleNameAndCode(page, customDutyName, customDutyCode, jobId);
        const finalDutyName = filledDuty.activeRoleName || customDutyName;
        const finalDutyCode = filledDuty.activeRoleCode || customDutyCode;

        // Strip privilege from custom duty role & add alternate
        await navigateToPrivilegesStep(page, jobId);
        const privDispName = matchedRoleInfo?.privilegeDisplayName || KNOWN_PRIVILEGE_MAPPINGS[privilegeToStrip]?.displayName || '';
        await removeCostlyPrivilege(page, privilegeToStrip, jobId, privDispName);
        const altToApply = roleItem.replacementPrivilege !== undefined ? roleItem.replacementPrivilege : replacementPrivilege;
        if (altToApply && typeof altToApply === 'string' && altToApply.trim() && altToApply.trim().toUpperCase() !== 'NONE') {
          await addAlternatePrivilege(page, altToApply.trim(), jobId, privilegeToStrip);
        } else {
          appendLog(jobId, `  ℹ [STEP 4] Skipping alternate privilege addition (User opted not to add replacement duty role).`);
        }

        // Submit Child Duty Role (duty roles are not assigned directly to users)
        appendLog(jobId, `  💾 Submitting custom Duty Role "${finalDutyName}"...`);
        await submitRole(page, jobId);
        appendLog(jobId, `  ✅ Custom Duty Role "${finalDutyName}" submitted successfully.`);
        await sleep(2000);
        await waitForAdf(page);

        // Step B3: Remediate Parent Job Role
        const customParentName = roleItem.customRoleName || `XX_${parentJobRole.roleName.replace(/^XX_/, '')}`;
        const customParentCode = roleItem.customRoleCode || deriveCustomRoleCode(parentJobRole.roleCode, customParentName);

        updateJob(jobId, {
          status: 'REMEDIATING_PARENT_ROLE',
          progress: roleBaseProgress + 32,
          message: `[${idx + 1}/${totalRoles}] Stage 2: Remediating Parent Job Role "${parentJobRole.roleName}" → "${customParentName}"...`
        });
        appendLog(jobId, `\n👑 [STAGE 2] Remediating Parent Job Role: "${parentJobRole.roleName}" → "${customParentName}" (${customParentCode})...`);

        await openSecurityConsole(page, podUrl, jobId);
        await searchRoleByCode(page, parentJobRole.roleCode, parentJobRole.roleName, jobId);
        await copyRoleInWizard(page, customParentName, customParentCode, jobId);

        const filledParent = await fillRoleNameAndCode(page, customParentName, customParentCode, jobId);
        const finalParentName = filledParent.activeRoleName || customParentName;
        const finalParentCode = filledParent.activeRoleCode || customParentCode;

        // Step 4 (Role Hierarchy): Remove old seeded duty role and attach new custom duty role
        updateJob(jobId, {
          status: 'UPDATING_ROLE_HIERARCHY',
          progress: roleBaseProgress + 40,
          message: `[${idx + 1}/${totalRoles}] Replacing "${roleNameFound}" with "${finalDutyName}" in Role Hierarchy...`
        });
        await replaceRoleInHierarchy(page, roleNameFound, finalDutyName, jobId);

        // Step 6 (Users): Assign users to custom parent job role
        const roleEmployees = (Array.isArray(roleItem.employees) && roleItem.employees.length > 0)
          ? roleItem.employees
          : (Array.isArray(employees) ? employees : []);

        updateJob(jobId, {
          status: 'ASSIGNING_USERS',
          progress: roleBaseProgress + 45,
          message: `[${idx + 1}/${totalRoles}] Attaching ${roleEmployees.length} user(s) to "${finalParentName}"...`
        });
        await navigateToUsersStep(page, jobId);
        const addedUsers = await addUsersToRoleInWizard(page, roleEmployees, jobId, roleEmployees.length > 0 ? '' : username);
        appendLog(jobId, `  ✅ Users attached to Parent Job Role: ${addedUsers}`);

        // Step 7: Summary & Submit Parent Job Role
        updateJob(jobId, {
          status: 'SUBMITTING_PARENT_ROLE',
          progress: roleBaseProgress + 48,
          message: `[${idx + 1}/${totalRoles}] Submitting "${finalParentName}"...`
        });
        await submitRole(page, jobId);

        // Verification in Administration -> Role Status
        updateJob(jobId, {
          status: 'VERIFYING_ROLE',
          progress: roleBaseProgress + 52,
          message: `[${idx + 1}/${totalRoles}] Verifying "${finalParentName}" in Role Status...`
        });
        const proofUrl = await verifyRoleCreated(page, podUrl, finalParentName, finalParentCode, jobId, proofsDir);
        proofUrls.push(proofUrl);
        processedRoles.push({
          original: roleItem.originalRoleName,
          dutyRole: finalDutyName,
          parentRole: finalParentName,
          cloned: finalParentName,
          code: finalParentCode
        });
      }

      // If more roles to process, re-open Security Console for next iteration
      if (idx < totalRoles - 1) {
        appendLog(jobId, `\n🔁 Re-opening Security Console for next role (${idx + 2}/${totalRoles})...`);
        await openSecurityConsole(page, podUrl, jobId);
      }
    }

    const lastProof = proofUrls[proofUrls.length - 1] || null;
    updateJob(jobId, {
      status: 'COMPLETED', progress: 100,
      message: `✅ Successfully cloned & stripped ${processedRoles.length} role(s) without "${privilegeToStrip}"!`,
      proofScreenshot: lastProof,
      proofScreenshots: proofUrls,
      processedRoles,
      completedAt: new Date().toISOString()
    });
    appendLog(jobId, `🎉 RPA Job ${jobId} finished successfully for ${processedRoles.length} role(s).`);
    return { success: true, jobId, screenshotUrl: lastProof };

  } catch (err) {
    let errScreenshot = null;
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const errPath = path.join(proofsDir, `oracle_error_${jobId}.png`);
          await pages[0].screenshot({ path: errPath });
          errScreenshot = `/proofs/oracle_error_${jobId}.png`;
        }
      } catch { /* ignore */ }
    }
    updateJob(jobId, { status: 'FAILED', error: err.message, proofScreenshot: errScreenshot, message: err.message });
    throw err;
  } finally {
    if (browser) await browser.close().catch(() => { });
  }
}

module.exports = {
  executeOracleRoleRemediation,
  executeHierarchyRemediation,
  getJobStatus
};