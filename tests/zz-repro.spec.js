import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

function makePair() {
  const base = {
    testName: '[H] Dedup Test',
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementIdA: '', elementIdB: '',
    elementIdSrcA: '', elementIdSrcB: '',
    sourceA: 'GAS_v_08_AMHS.nwc',
    sourceB: 'Structure.nwc',
    penetration: '20mm',
    status: 'Active', priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    nwImageRef: '',
    statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
  };
  return [
    { ...base, uid: 'CLX-001', name: 'CLX-001 — A', nwOrig: 'ClashA',
      elementA: 'Duct-1', elementB: 'Beam-1',
      x: 100, y: 100, z: 100, notes: 'Coordinator note: check flange' },
    { ...base, uid: 'CLX-002', name: 'CLX-002 — B', nwOrig: 'ClashB',
      elementA: 'Duct-1', elementB: 'Beam-1',
      x: 103, y: 100, z: 100 },
  ];
}

test('ZZ-REPRO dedup badge/card', async ({ page }) => {
  page.on('console - zz-repro.spec.js:34', m => console.log('BROWSER-CONSOLE:', m.text()));
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.waitForTimeout(2500);
  const preState = await page.evaluate(() => ({
    dqLen: Array.isArray(S.dedupQueue) ? S.dedupQueue.length : 'not-array',
    weeklyLen: Array.isArray(S.weekly) ? S.weekly.length : 'not-array',
    clashesLen: Array.isArray(S.clashes) ? S.clashes.length : 'not-array',
    gate: localStorage.getItem('nw:dedupInitialScan'),
  }));
  console.log('PRESTATE - zz-repro.spec.js:44', JSON.stringify(preState));

  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });

  await page.evaluate((clashes) => {
    S.clashes = clashes.slice();
    S.dedupQueue = [];
    sv('clashes', S.clashes);
    sv('dedupQueue', S.dedupQueue);
    scanForDedupCandidates();
    updSB();
  }, makePair());

  const midState = await page.evaluate(() => ({
    dqLen: S.dedupQueue.length,
    dq: JSON.stringify(S.dedupQueue),
  }));
  console.log('MIDSTATE - zz-repro.spec.js:67', JSON.stringify(midState));

  const badge = page.locator('#na-dedup-badge');
  await expect(badge).toHaveText('1');

  await page.evaluate(() => nav('dedup'));
  const card = page.locator('[data-dedup-pair]');
  await expect(card).toHaveCount(1);
});
