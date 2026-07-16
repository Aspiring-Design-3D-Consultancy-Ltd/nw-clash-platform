import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* CLEAR-ALL-SUPPRESS-DEMO-SEED contract:
   When nw:dataVersion is present, a null nw:clashes/nw:weekly means the
   user has already been through init and (probably) wiped their data.
   The register must stay empty on reload — the demo dataset must NOT
   rehydrate. The primary seed at L1067 (savedVer!==DATA_VERSION) still
   fires for genuinely fresh browsers (no dataVersion). */
test.describe('CLEAR-ALL-SUPPRESS-DEMO-SEED — demo does not rehydrate post-init', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof DATA_VERSION === 'string');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    });
  });

  test('dataVersion present + clashes null → register stays empty (no demo rehydrate)', async ({ page }) => {
    // Seed the exact "post-Clear-All-Data reload" state: dataVersion is
    // still there (Clear All preserves it), but nw:clashes has been
    // removed (or was never re-persisted). This is the failure state PR #40
    // set out to prevent — this test guards against regressions.
    await page.evaluate(() => {
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      // nw:clashes deliberately absent — simulating the bug's premise.
      // (nw:pin also absent so we exercise the L1088 branch, not the
      // PIN-login one. The two mirrored branches are covered by the
      // next test.)
    });

    // Reload so initAuth() re-runs against the seeded state. Wait for
    // initAuth's PIN-setup screen — this is the sync end of the else
    // branch (which contains the L1088 patch), so localStorage has
    // already been written to by the time this signal fires.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('ath').textContent === 'Set Up Your PIN');

    const state = await page.evaluate(() => ({
      clashesLen: S.clashes.length,
      weeklyLen: S.weekly.length,
      storedClashes: localStorage.getItem('nw:clashes'),
      storedWeekly: localStorage.getItem('nw:weekly'),
      uid: _uid,
    }));

    // The register MUST be empty. Any non-zero count means the demo
    // dataset re-installed itself — the bug is back.
    expect(state.clashesLen).toBe(0);
    expect(state.weeklyLen).toBe(0);
    expect(state.storedClashes).toBe('[]');
    expect(state.storedWeekly).toBe('[]');
    // _uid stays at 0 because there are no clashes to derive from.
    expect(state.uid).toBe(0);
  });

  test('dataVersion present + clashes null via PIN-login pathway → register stays empty', async ({ page }) => {
    // Second mirrored branch at L1279. Seed a PIN so the auth screen
    // waits for input, then submit the PIN and check the post-login state.
    await page.evaluate(() => {
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      // Set PIN so initAuth takes the pin-login path (not the pin-setup one).
      // The hash below matches PIN '1234' as hashed by hashPin().
    });
    // Compute the hash inside the page so we use the same crypto impl.
    const pinHash = await page.evaluate(() => hashPin('1234'));
    await page.evaluate((h) => localStorage.setItem('nw:pin', JSON.stringify(h)), pinHash);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && S.pin);
    // Simulate PIN entry via the numpad handler wired inside initAuth.
    await page.waitForSelector('#numpad button');
    for (const digit of '1234') {
      await page.click(`#numpad button:has-text("${digit}")`);
    }
    // The login callback then calls launch() which sets S.clashes/S.weekly.
    await page.waitForFunction(() => document.getElementById('app').classList.contains('show'));

    const state = await page.evaluate(() => ({
      clashesLen: (S.clashes || []).length,
      weeklyLen: (S.weekly || []).length,
      storedClashes: localStorage.getItem('nw:clashes'),
      storedWeekly: localStorage.getItem('nw:weekly'),
    }));
    expect(state.clashesLen).toBe(0);
    expect(state.weeklyLen).toBe(0);
    expect(state.storedClashes).toBe('[]');
    expect(state.storedWeekly).toBe('[]');
  });

  test('regression control: dataVersion absent → demo dataset still installs (fresh-browser path)', async ({ page }) => {
    // Fresh-browser path is untouched. A profile with no dataVersion
    // still gets the 104-clash demo on first launch — this is the
    // intended L1067 first-launch behavior and must survive.
    await page.evaluate(() => {
      // Wipe every nw:* key including dataVersion.
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.isArray(S.clashes) && S.clashes.length > 0);
    const state = await page.evaluate(() => ({
      clashesLen: S.clashes.length,
      weeklyLen: S.weekly.length,
      dataVersion: localStorage.getItem('nw:dataVersion'),
    }));
    // Demo has 104 clashes and 4 weekly snapshots (per DC/DW constants).
    expect(state.clashesLen).toBe(104);
    expect(state.weeklyLen).toBe(4);
    // dataVersion is stamped on first launch so subsequent loads take the
    // else branch (which the primary fix guards).
    expect(state.dataVersion).not.toBeNull();
  });
});
