import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

function makeBackup(overrides = {}) {
  return {
    projName: 'Restore Test Project',
    projWeek: 'Wk 27 — 29 Jun 26',
    exported: '2026-07-01T10:00:00Z',
    clashes: [
      { uid: 'CLX-001', testName: '[H] Test A', nwOrig: 'Clash1', status: 'New', priority: 'High' },
      { uid: 'CLX-002', testName: '[H] Test A', nwOrig: 'Clash2', status: 'Active', priority: 'Medium' },
      { uid: 'CLX-003', testName: '[H] Test B', nwOrig: 'Clash1', status: 'Reviewed', priority: 'Low' },
    ],
    weekly: [],
    ...overrides,
  };
}

test.describe('JSON-BACKUP-RESTORE', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    // Wait for initAuth to finish populating S (including the demo dataset).
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    // INV-007: wait for the terminal inline one-shot migration gate so
    // window.onload's setTimeout(1500/1600)-deferred migrations don't
    // race and silently overwrite this test's seeded state.
    await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      nav('settings');
    });
    await page.waitForSelector('.ss-sec');
  });

  test('valid backup fills preview, unlocks Replace after REPLACE typed, restores state, fires pre-restore download', async ({ page }) => {
    // Capture the pre-restore auto-download before triggering restore.
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 });

    // Write fixture to a temp file so we can drive the file input.
    const backup = makeBackup();
    const tmp = path.join(os.tmpdir(), 'nw-restore-fixture-' + Date.now() + '.json');
    fs.writeFileSync(tmp, JSON.stringify(backup));

    await page.evaluate(() => jsonBackupRestore());
    await page.waitForSelector('#json-restore-modal');

    // Confirm button starts disabled.
    expect(await page.locator('#jr-go').isDisabled()).toBe(true);

    await page.locator('#jr-file').setInputFiles(tmp);
    await page.waitForFunction(() => {
      const p = document.querySelector('#jr-preview');
      return p && p.textContent && p.textContent.includes('Restore Test Project');
    });

    // Still disabled — REPLACE not yet typed.
    expect(await page.locator('#jr-go').isDisabled()).toBe(true);

    await page.locator('#jr-confirm-text').fill('REPLACE');
    expect(await page.locator('#jr-go').isDisabled()).toBe(false);

    await page.locator('#jr-go').click();

    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toMatch(/^pre-restore-.*\.json$/);

    // State should now reflect the backup.
    const state = await page.evaluate(() => ({
      clashCount: S.clashes.length,
      projName: S.projName,
      uids: S.clashes.map(c => c.uid),
      _uid: window._uid !== undefined ? window._uid : (typeof _uid !== 'undefined' ? _uid : null),
    }));
    expect(state.clashCount).toBe(3);
    expect(state.projName).toBe('Restore Test Project');
    expect(state.uids).toEqual(['CLX-001', 'CLX-002', 'CLX-003']);

    fs.unlinkSync(tmp);
  });

  test('rejects backup missing required per-clash fields', async ({ page }) => {
    const bad = makeBackup({
      clashes: [
        { uid: 'CLX-001', testName: '[H] Test', nwOrig: 'Clash1', status: 'New' },
        { uid: 'CLX-002', testName: '[H] Test', nwOrig: 'Clash2' },  // missing status
      ],
    });
    const tmp = path.join(os.tmpdir(), 'nw-restore-bad-' + Date.now() + '.json');
    fs.writeFileSync(tmp, JSON.stringify(bad));

    const beforeCount = await page.evaluate(() => S.clashes.length);
    await page.evaluate(() => jsonBackupRestore());
    await page.waitForSelector('#json-restore-modal');
    await page.locator('#jr-file').setInputFiles(tmp);
    await page.waitForFunction(() => {
      const p = document.querySelector('#jr-preview');
      return p && p.textContent && p.textContent.includes('Invalid backup');
    });
    // Even if user types REPLACE, button stays disabled (parsed=null).
    await page.locator('#jr-confirm-text').fill('REPLACE');
    expect(await page.locator('#jr-go').isDisabled()).toBe(true);

    const afterCount = await page.evaluate(() => S.clashes.length);
    expect(afterCount).toBe(beforeCount);

    fs.unlinkSync(tmp);
  });

  test('rejects backup missing top-level clashes / projName', async ({ page }) => {
    const bad = { projName: 'x' }; // no clashes, no weekly
    const tmp = path.join(os.tmpdir(), 'nw-restore-schema-' + Date.now() + '.json');
    fs.writeFileSync(tmp, JSON.stringify(bad));

    await page.evaluate(() => jsonBackupRestore());
    await page.waitForSelector('#json-restore-modal');
    await page.locator('#jr-file').setInputFiles(tmp);
    await page.waitForFunction(() => {
      const p = document.querySelector('#jr-preview');
      return p && p.textContent && p.textContent.includes('Invalid backup');
    });

    fs.unlinkSync(tmp);
  });
});
