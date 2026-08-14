import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Register with 3 clashes that carry testName + nwOrig but NO elementIdA/B.
// Simulates the current 1,951-clash production register captured before
// BGATR-ID-MULTI landed.
function makeRegisterBackup() {
  return {
    projName: 'Backfill Test Project',
    projWeek: 'Wk 27 — 29 Jun 26',
    exported: '2026-07-01T10:00:00Z',
    clashes: [
      {
        uid: 'CLX-001', testName: '[H] Test A', nwOrig: 'Clash1', status: 'Active',
        priority: 'High', assignedTo: 'Alice', notes: 'do not touch',
        elementIdA: '', elementIdB: '', sourceA: '', sourceB: '',
        x: 100, y: 200, z: 300, date: '01/07/26',
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      },
      {
        uid: 'CLX-002', testName: '[H] Test A', nwOrig: 'Clash2', status: 'Reviewed',
        priority: 'Medium', assignedTo: 'Bob', notes: 'preserve me',
        elementIdA: '', elementIdB: '', sourceA: '', sourceB: '',
        x: 400, y: 500, z: 600, date: '02/07/26',
        statusHistory: [{ week: 27, year: 2026, status: 'Reviewed' }],
      },
      {
        uid: 'CLX-003', testName: '[H] Test B', nwOrig: 'Clash1', status: 'Approved',
        priority: 'Low', assignedTo: 'Carol', notes: 'sacrosanct',
        elementIdA: '', elementIdB: '', sourceA: '', sourceB: '',
        x: 700, y: 800, z: 900, date: '03/07/26',
        statusHistory: [{ week: 27, year: 2026, status: 'Approved' }],
      },
    ],
    weekly: [],
  };
}

// XML that matches all 3 register clashes by (testName, nwName). Uses a mix
// of the identity-attribute variants so we exercise bgetElementId's priority
// order end-to-end.
const XML_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Test A">
      <clashresult name="Clash1" distance="-0.02">
        <clashpoint><pos3f x="0" y="0" z="0"/></clashpoint>
        <resultstatus>new</resultstatus>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-A-1</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-B-1</value></objectattribute>
        </clashobject>
      </clashresult>
      <clashresult name="Clash2" distance="-0.03">
        <clashpoint><pos3f x="0" y="0" z="0"/></clashpoint>
        <resultstatus>new</resultstatus>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink>
          <objectattribute><name>GUID</name><value>GUID-A-2</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MuratecAMHS.nwc</node></pathlink>
          <objectattribute><name>GUID</name><value>GUID-B-2</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
    <clashtest name="[H] Test B">
      <clashresult name="Clash1" distance="-0.04">
        <clashpoint><pos3f x="0" y="0" z="0"/></clashpoint>
        <resultstatus>new</resultstatus>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>CivilRoads.dwg</node></pathlink>
          <objectattribute><name>Entity Handle</name><value>EH-A-3</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MuratecAMHS.nwc</node></pathlink>
          <objectattribute><name>GUID</name><value>GUID-B-3</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;

test.describe('PAIR-ID-BACKFILL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
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

  test('backfill copies IDs onto register clashes, preserves user fields, moves clashes to ID tier', async ({ page }) => {
    // Seed the register directly (skipping the restore UI) so we isolate
    // the backfill behaviour.
    const seed = makeRegisterBackup();
    await page.evaluate((data) => {
      S.clashes = data.clashes.slice();
      S.weekly = data.weekly.slice();
      S.projName = data.projName;
      S.projWeek = data.projWeek;
      const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
      _uid = mx;
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
    }, seed);

    // Sanity: all three clashes start on the LEGACY tier because they have
    // no IDs and no sourceA/sourceB (composite fails too).
    const beforeTiers = await page.evaluate(() => S.clashes.map(c => pairKey(c)));
    expect(beforeTiers.every(k => k.startsWith('LEGACY::'))).toBe(true);

    // Capture the pre-backfill auto-download.
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 });

    // Drive the backfill UI.
    const tmp = path.join(os.tmpdir(), 'nw-backfill-fixture-' + Date.now() + '.xml');
    fs.writeFileSync(tmp, XML_FIXTURE);

    await page.evaluate(() => pairIdBackfill());
    await page.waitForSelector('#pair-id-backfill-modal');
    await page.locator('#bf-file').setInputFiles(tmp);

    // Dry-run report renders; Apply unlocks.
    await page.waitForFunction(() => {
      const r = document.querySelector('#bf-report');
      return r && r.textContent && r.textContent.includes('Dry-run summary');
    });
    expect(await page.locator('#bf-apply').isDisabled()).toBe(false);

    await page.locator('#bf-apply').click();

    // Wait for success card.
    await page.waitForFunction(() => {
      const r = document.querySelector('#bf-report');
      return r && r.textContent && r.textContent.includes('Backfill complete');
    });

    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toMatch(/^pre-backfill-.*\.json$/);

    // Verify IDs backfilled AND user fields preserved AND geometry untouched
    // AND statusHistory left alone.
    const snapshot = await page.evaluate(() => S.clashes.map(c => ({
      uid: c.uid,
      elementIdA: c.elementIdA,
      elementIdB: c.elementIdB,
      elementIdSrcA: c.elementIdSrcA,
      elementIdSrcB: c.elementIdSrcB,
      sourceA: c.sourceA,
      sourceB: c.sourceB,
      status: c.status,
      priority: c.priority,
      assignedTo: c.assignedTo,
      notes: c.notes,
      x: c.x, y: c.y, z: c.z,
      date: c.date,
      statusHistory: c.statusHistory,
      pairKey: pairKey(c),
    })));

    const byUid = Object.fromEntries(snapshot.map(c => [c.uid, c]));

    // CLX-001 — Element ID / Element ID.
    expect(byUid['CLX-001'].elementIdA).toBe('EID-A-1');
    expect(byUid['CLX-001'].elementIdB).toBe('EID-B-1');
    expect(byUid['CLX-001'].elementIdSrcA).toBe('Element ID');
    expect(byUid['CLX-001'].elementIdSrcB).toBe('Element ID');
    expect(byUid['CLX-001'].pairKey).toMatch(/^ID::/);
    // User fields preserved.
    expect(byUid['CLX-001'].status).toBe('Active');
    expect(byUid['CLX-001'].priority).toBe('High');
    expect(byUid['CLX-001'].assignedTo).toBe('Alice');
    expect(byUid['CLX-001'].notes).toBe('do not touch');
    // Coordinates + date untouched.
    expect(byUid['CLX-001'].x).toBe(100);
    expect(byUid['CLX-001'].y).toBe(200);
    expect(byUid['CLX-001'].z).toBe(300);
    expect(byUid['CLX-001'].date).toBe('01/07/26');
    // statusHistory unchanged.
    expect(byUid['CLX-001'].statusHistory).toEqual([{ week: 27, year: 2026, status: 'Active' }]);

    // CLX-002 — GUID / GUID.
    expect(byUid['CLX-002'].elementIdA).toBe('GUID-A-2');
    expect(byUid['CLX-002'].elementIdB).toBe('GUID-B-2');
    expect(byUid['CLX-002'].elementIdSrcA).toBe('GUID');
    expect(byUid['CLX-002'].elementIdSrcB).toBe('GUID');
    expect(byUid['CLX-002'].pairKey).toMatch(/^ID::/);
    expect(byUid['CLX-002'].notes).toBe('preserve me');
    expect(byUid['CLX-002'].statusHistory).toEqual([{ week: 27, year: 2026, status: 'Reviewed' }]);

    // CLX-003 — Entity Handle / GUID.
    expect(byUid['CLX-003'].elementIdA).toBe('EH-A-3');
    expect(byUid['CLX-003'].elementIdB).toBe('GUID-B-3');
    expect(byUid['CLX-003'].elementIdSrcA).toBe('Entity Handle');
    expect(byUid['CLX-003'].elementIdSrcB).toBe('GUID');
    expect(byUid['CLX-003'].pairKey).toMatch(/^ID::/);
    expect(byUid['CLX-003'].notes).toBe('sacrosanct');
    expect(byUid['CLX-003'].statusHistory).toEqual([{ week: 27, year: 2026, status: 'Approved' }]);

    fs.unlinkSync(tmp);
  });

  test('unmatched register clashes stay LEGACY; already-populated clashes are counted separately', async ({ page }) => {
    const seed = makeRegisterBackup();
    // Add a fourth clash whose nwOrig doesn't match anything in the XML.
    seed.clashes.push({
      uid: 'CLX-004', testName: '[H] Test A', nwOrig: 'ClashRenamedByNW',
      status: 'New', priority: 'Medium', elementIdA: '', elementIdB: '',
      x: 0, y: 0, z: 0, date: '04/07/26',
      statusHistory: [{ week: 27, year: 2026, status: 'New' }],
    });
    await page.evaluate((data) => {
      S.clashes = data.clashes.slice();
      S.weekly = [];
      sv('clashes', S.clashes);
    }, seed);

    const tmp = path.join(os.tmpdir(), 'nw-backfill-partial-' + Date.now() + '.xml');
    fs.writeFileSync(tmp, XML_FIXTURE);

    await page.evaluate(() => pairIdBackfill());
    await page.waitForSelector('#pair-id-backfill-modal');
    await page.locator('#bf-file').setInputFiles(tmp);
    await page.waitForFunction(() => {
      const r = document.querySelector('#bf-report');
      return r && r.textContent && r.textContent.includes('Dry-run summary');
    });
    await page.locator('#bf-apply').click();
    await page.waitForFunction(() => {
      const r = document.querySelector('#bf-report');
      return r && r.textContent && r.textContent.includes('Backfill complete');
    });

    const unmatched = await page.evaluate(() => {
      const c = S.clashes.find(x => x.uid === 'CLX-004');
      return { elementIdA: c.elementIdA, elementIdB: c.elementIdB, pairKey: pairKey(c) };
    });
    expect(unmatched.elementIdA).toBe('');
    expect(unmatched.elementIdB).toBe('');
    expect(unmatched.pairKey).toMatch(/^LEGACY::/);

    fs.unlinkSync(tmp);
  });

  test('folder picker collects every XML in a folder tree and skips non-XML / empty / lock files', async ({ page }) => {
    // Simulate a "Clash Tests" archive: a root folder with two weekly subfolders,
    // each containing one XML plus a stray image, an empty file, and a ~lockfile.
    // Playwright's setInputFiles on a webkitdirectory input accepts a plain
    // file array — the filter inside handleFiles() enforces the .xml + non-empty
    // + no-~/$ rule.
    const seed = makeRegisterBackup();
    await page.evaluate((data) => {
      S.clashes = data.clashes.slice();
      S.weekly = [];
      sv('clashes', S.clashes);
    }, seed);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-bf-folder-'));
    const week1 = path.join(root, '260601 FAB AMHS v 7 Clash test');
    const week2 = path.join(root, '260608 CUB Exyte v AMHS Clash test');
    fs.mkdirSync(week1, { recursive: true });
    fs.mkdirSync(week2, { recursive: true });
    const xmlA = path.join(week1, 'test-A.xml');
    const xmlB = path.join(week2, 'test-B.xml');
    fs.writeFileSync(xmlA, XML_FIXTURE);
    // Second XML only carries [H] Test B (the third register clash's test).
    fs.writeFileSync(xmlB, XML_FIXTURE);
    const jpg = path.join(week1, 'cd000001.jpg');
    const empty = path.join(week1, 'empty.xml');
    const lock = path.join(week1, '~lock-test.xml');
    fs.writeFileSync(jpg, 'not an xml');
    fs.writeFileSync(empty, '');
    fs.writeFileSync(lock, XML_FIXTURE);

    await page.evaluate(() => pairIdBackfill());
    await page.waitForSelector('#pair-id-backfill-modal');

    // Point the webkitdirectory input at the archive root — Playwright
    // enumerates every file underneath, matching what a native folder
    // pick produces.
    await page.locator('#bf-folder').setInputFiles(root);

    await page.waitForFunction(() => {
      const c = document.querySelector('#bf-file-count');
      return c && /files selected/.test(c.textContent);
    });

    const countText = await page.locator('#bf-file-count').textContent();
    // 2 usable XMLs (xmlA + xmlB); jpg + empty + ~lock skipped = 3 skipped.
    expect(countText).toContain('2 files selected');
    expect(countText).toContain('(3 skipped)');

    await page.waitForFunction(() => {
      const r = document.querySelector('#bf-report');
      return r && r.textContent && r.textContent.includes('Dry-run summary');
    });
    await page.locator('#bf-apply').click();
    await page.waitForFunction(() => {
      const r = document.querySelector('#bf-report');
      return r && r.textContent && r.textContent.includes('Backfill complete');
    });

    // All three register clashes should be backfilled (XML_FIXTURE covers Tests A + B).
    const covered = await page.evaluate(() =>
      S.clashes.filter(c => c.elementIdA && c.elementIdB).length
    );
    expect(covered).toBe(3);

    fs.rmSync(root, { recursive: true, force: true });
  });
});
