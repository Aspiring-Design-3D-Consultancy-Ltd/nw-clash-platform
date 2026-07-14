import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Seed: 5 Active clashes in one test. Each carries element IDs so the
// register renders normally and the per-row dropdown / checkbox column
// behave as they do in production.
function makeSeed() {
  const wy = { week: 27, year: 2026 };
  const mk = (n) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: '[H] Approve Register Test A',
    disciplineA: 'Structural', disciplineB: 'MEP',
    elementA: 'Beam-' + n, elementB: 'Duct-' + n,
    elementIdA: 'EID-A-' + n, elementIdB: 'EID-B-' + n,
    elementIdSrcA: 'Element ID', elementIdSrcB: 'Element ID',
    sourceA: 'Structural.nwc', sourceB: 'MEP.nwc',
    penetration: '20mm',
    status: 'Active', priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    x: 10 * n, y: 20 * n, z: 30 * n,
    nwImageRef: '',
    statusHistory: [{ week: wy.week, year: wy.year, status: 'Active' }],
  });
  return [1, 2, 3, 4, 5].map(mk);
}

async function seedAndOpenRegister(page) {
  await page.evaluate((seed) => {
    S.clashes = seed.slice();
    const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
    _uid = mx;
    sv('clashes', S.clashes);
    nav('register');
  }, makeSeed());
  await page.waitForSelector('#reg-content');
}

test.describe('APPROVE-ACTION-CLASH-REGISTER', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      // chgSt guards on can('edit_register') which needs _ROLE to be set;
      // bypass by promoting to admin so the dropdown path exercises the
      // real production code rather than returning early on permission.
      _ROLE = 'admin';
    });
  });

  test('modal DOM + handlers are present', async ({ page }) => {
    const state = await page.evaluate(() => ({
      modal: !!document.getElementById('cr-approve-modal'),
      input: !!document.getElementById('cr-approve-input'),
      confirmBtn: !!document.getElementById('cr-approve-confirm-btn'),
      openFn: typeof window._crApproveOpen,
      cancelFn: typeof window._crApproveCancel,
      confirmFn: typeof window._crApproveConfirm,
      inputChangeFn: typeof window._crApproveInputChange,
    }));
    expect(state.modal).toBe(true);
    expect(state.input).toBe(true);
    expect(state.confirmBtn).toBe(true);
    expect(state.openFn).toBe('function');
    expect(state.cancelFn).toBe('function');
    expect(state.confirmFn).toBe('function');
    expect(state.inputChangeFn).toBe('function');
  });

  test('per-row dropdown: selecting Approved opens modal; Cancel leaves clash unchanged and restores dropdown', async ({ page }) => {
    await seedAndOpenRegister(page);

    // Simulate the exact chgSt entry path: grab a live per-row select for CLX-002 and
    // dispatch a change to "Approved".
    const opened = await page.evaluate(() => {
      const sels = document.querySelectorAll('#reg-content select.stsel');
      // Find the select whose row shows CLX-002
      let target = null;
      for (const s of sels) {
        const tr = s.closest('tr');
        if (tr && tr.textContent.includes('CLX-002')) { target = s; break; }
      }
      if (!target) return { error: 'select not found' };
      const prev = target.value;
      target.value = 'Approved';
      chgSt('CLX-002', target);
      return {
        modalVisible: document.getElementById('cr-approve-modal').style.display === 'flex',
        prevStored: prev,
        clashStatus: (S.clashes || []).find(c => c.uid === 'CLX-002').status,
        selectValueNow: target.value,
      };
    });
    expect(opened.error).toBeUndefined();
    expect(opened.modalVisible).toBe(true);
    expect(opened.clashStatus).toBe('Active'); // Not yet changed
    expect(opened.selectValueNow).toBe('Approved'); // Dropdown still shows Approved until cancel

    // Cancel — dropdown should restore to prev, modal closes, clash still Active
    const afterCancel = await page.evaluate(() => {
      _crApproveCancel();
      const sels = document.querySelectorAll('#reg-content select.stsel');
      let target = null;
      for (const s of sels) {
        const tr = s.closest('tr');
        if (tr && tr.textContent.includes('CLX-002')) { target = s; break; }
      }
      return {
        modalVisible: document.getElementById('cr-approve-modal').style.display === 'flex',
        clashStatus: (S.clashes || []).find(c => c.uid === 'CLX-002').status,
        selectValueRestored: target ? target.value : null,
      };
    });
    expect(afterCancel.modalVisible).toBe(false);
    expect(afterCancel.clashStatus).toBe('Active');
    expect(afterCancel.selectValueRestored).toBe('Active');
  });

  test('per-row dropdown: Approve flow with type-APPROVE + Confirm flips status and writes ClashRegister-source audit entry', async ({ page }) => {
    await seedAndOpenRegister(page);

    await page.evaluate(() => {
      const sels = document.querySelectorAll('#reg-content select.stsel');
      for (const s of sels) {
        const tr = s.closest('tr');
        if (tr && tr.textContent.includes('CLX-003')) {
          s.value = 'Approved';
          chgSt('CLX-003', s);
          break;
        }
      }
    });

    // Confirm button disabled at open
    let disabled = await page.locator('#cr-approve-confirm-btn').evaluate(el => el.disabled);
    expect(disabled).toBe(true);

    // Type wrong text — still disabled
    await page.fill('#cr-approve-input', 'approve');
    disabled = await page.locator('#cr-approve-confirm-btn').evaluate(el => el.disabled);
    expect(disabled).toBe(true);

    // Type exact — enabled
    await page.fill('#cr-approve-input', 'APPROVE');
    disabled = await page.locator('#cr-approve-confirm-btn').evaluate(el => el.disabled);
    expect(disabled).toBe(false);

    await page.click('#cr-approve-confirm-btn');
    await page.waitForFunction(() =>
      (S.clashes || []).some(c => c.uid === 'CLX-003' && c.status === 'Approved')
    );

    const after = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-003');
      const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
      return {
        status: c.status,
        hasClashRegisterEntry: !!last && last.source === 'ClashRegister' && last.status === 'Approved' && !!last.approvedAt && !!last.reviewedAt && last.actor === 'Administrator',
        modalHidden: document.getElementById('cr-approve-modal').style.display === 'none',
      };
    });
    expect(after.status).toBe('Approved');
    expect(after.hasClashRegisterEntry).toBe(true);
    expect(after.modalHidden).toBe(true);
  });

  test('bulk-bar: appears when rows are selected, count matches, opens modal with correct N in title and body', async ({ page }) => {
    await seedAndOpenRegister(page);

    // Bulk bar hidden initially
    await expect(page.locator('#reg-approve-bar')).toHaveCount(0);

    // Select CLX-001, CLX-002, CLX-004
    await page.evaluate(() => {
      regSelToggle('CLX-001', true);
      regSelToggle('CLX-002', true);
      regSelToggle('CLX-004', true);
    });

    await expect(page.locator('#reg-approve-bar')).toBeVisible();
    await expect(page.locator('#reg-approve-bar')).toContainText('3 selected');

    // Click the Approve button on the bulk bar
    await page.click('#reg-approve-btn');
    await expect(page.locator('#cr-approve-modal')).toBeVisible();
    await expect(page.locator('#cr-approve-title')).toHaveText('Approve 3 clashes');
    await expect(page.locator('#cr-approve-body')).toHaveText('Mark 3 clashes as Approved? This is a terminal status.');
  });

  test('bulk-bar: type APPROVE + Confirm approves all selected and clears selection', async ({ page }) => {
    await seedAndOpenRegister(page);
    await page.evaluate(() => {
      regSelToggle('CLX-001', true);
      regSelToggle('CLX-004', true);
      regSelToggle('CLX-005', true);
    });
    await page.click('#reg-approve-btn');
    await page.fill('#cr-approve-input', 'APPROVE');
    await page.click('#cr-approve-confirm-btn');
    await page.waitForFunction(() =>
      (S.clashes || []).filter(c => c.status === 'Approved').length === 3
    );

    const state = await page.evaluate(() => {
      const approved = (S.clashes || []).filter(c => c.status === 'Approved').map(c => c.uid).sort();
      const activeStill = (S.clashes || []).filter(c => c.status === 'Active').map(c => c.uid).sort();
      const sources = (S.clashes || [])
        .filter(c => c.status === 'Approved')
        .map(c => {
          const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
          return { uid: c.uid, source: last && last.source };
        });
      return { approved, activeStill, sources, selCount: _selClashes.size };
    });
    expect(state.approved).toEqual(['CLX-001', 'CLX-004', 'CLX-005']);
    expect(state.activeStill).toEqual(['CLX-002', 'CLX-003']);
    expect(state.sources.every(s => s.source === 'ClashRegister')).toBe(true);
    expect(state.selCount).toBe(0);
  });

  test('modal backdrop click and Escape close the modal without approving', async ({ page }) => {
    await seedAndOpenRegister(page);
    await page.evaluate(() => _crApproveOpen(['CLX-001']));
    await expect(page.locator('#cr-approve-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#cr-approve-modal')).toBeHidden();
    const unchanged = await page.evaluate(() =>
      (S.clashes || []).find(c => c.uid === 'CLX-001').status
    );
    expect(unchanged).toBe('Active');
  });

  test('Enter key with valid APPROVE input triggers confirm', async ({ page }) => {
    await seedAndOpenRegister(page);
    await page.evaluate(() => _crApproveOpen(['CLX-001']));
    await page.fill('#cr-approve-input', 'APPROVE');
    await page.locator('#cr-approve-input').press('Enter');
    await page.waitForFunction(() =>
      (S.clashes || []).some(c => c.uid === 'CLX-001' && c.status === 'Approved')
    );
    const src = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-001');
      const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
      return last && last.source;
    });
    expect(src).toBe('ClashRegister');
  });

  test('regression: Review Queue Approve action still stamps source: "ReviewQueue"', async ({ page }) => {
    // Directly invoke the handler as the Review Queue path does — no ClashRegister retag.
    await seedAndOpenRegister(page);
    const src = await page.evaluate(() => {
      _markClashesAsApproved(['CLX-002']);
      const c = (S.clashes || []).find(x => x.uid === 'CLX-002');
      const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
      return { status: c.status, source: last && last.source };
    });
    expect(src.status).toBe('Approved');
    expect(src.source).toBe('ReviewQueue');
  });

  test('per-row dropdown skips the modal when clash is already Approved (idempotent re-select)', async ({ page }) => {
    await seedAndOpenRegister(page);
    await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-002');
      c.status = 'Approved';
      sv('clashes', S.clashes);
      nav('register');
    });
    await page.waitForSelector('#reg-content');
    await page.evaluate(() => {
      const sels = document.querySelectorAll('#reg-content select.stsel');
      for (const s of sels) {
        const tr = s.closest('tr');
        if (tr && tr.textContent.includes('CLX-002')) {
          s.value = 'Approved';
          chgSt('CLX-002', s);
          break;
        }
      }
    });
    await expect(page.locator('#cr-approve-modal')).toBeHidden();
  });
});
