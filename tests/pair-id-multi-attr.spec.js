import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'pair-id-multi-attr.xml'), 'utf8');

test.describe('BGATR-ID-MULTI / PAIR-ID-COMPOSITE-FALLBACK', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    // Auth bypass (CLAUDE.md Playwright contract) + clean nw:* localStorage
    // so each test starts with the demo dataset untouched by prior runs.
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      // Navigate to BCF Generator so the #bxml textarea is rendered into #va.
      nav('bcf');
    });
    await page.waitForSelector('#bxml');
  });

  test('parser captures GUID / Entity Handle / no-ID via bgetElementId and pairKey classifies each tier', async ({ page }) => {
    // Paste fixture into the app's XML textarea, invoke parser 2 (bparse), then
    // merge via importToRegister('append'). This drives the SAME code path the
    // user hits via UI paste.
    const uidsAfter = await page.evaluate((xml) => {
      // S is a `let` at script scope, not on window — reference it directly.
      const priorUids = new Set((S?.clashes || []).map(c => c.uid));
      const ta = document.getElementById('bxml');
      ta.value = xml;
      bparse();
      importToRegister('append');
      return {
        priorCount: priorUids.size,
        newUids: (S.clashes || []).filter(c => !priorUids.has(c.uid)).map(c => c.uid),
      };
    }, FIXTURE);

    expect(uidsAfter.newUids.length).toBe(5);

    const clashes = await page.evaluate((uids) => uids.map(u => {
      const c = S.clashes.find(x => x.uid === u);
      return {
        uid: c.uid,
        nwOrig: c.nwOrig,
        elementIdA: c.elementIdA || '',
        elementIdB: c.elementIdB || '',
        elementIdSrcA: c.elementIdSrcA || '',
        elementIdSrcB: c.elementIdSrcB || '',
        pairKey: pairKey(c),
      };
    }), uidsAfter.newUids);

    const byName = Object.fromEntries(clashes.map(c => [c.nwOrig, c]));

    // Clash 1: Element ID both sides.
    expect(byName['Clash1'].elementIdA).toBe('EID-A1');
    expect(byName['Clash1'].elementIdB).toBe('EID-B1');
    expect(byName['Clash1'].elementIdSrcA).toBe('Element ID');
    expect(byName['Clash1'].elementIdSrcB).toBe('Element ID');
    expect(byName['Clash1'].pairKey).toMatch(/^ID::/);

    // Clash 2: GUID both sides.
    expect(byName['Clash2'].elementIdA).toBe('GUID-A2');
    expect(byName['Clash2'].elementIdB).toBe('GUID-B2');
    expect(byName['Clash2'].elementIdSrcA).toBe('GUID');
    expect(byName['Clash2'].elementIdSrcB).toBe('GUID');
    expect(byName['Clash2'].pairKey).toMatch(/^ID::/);

    // Clash 3: Element ID / GUID.
    expect(byName['Clash3'].elementIdA).toBe('EID-A3');
    expect(byName['Clash3'].elementIdB).toBe('GUID-B3');
    expect(byName['Clash3'].elementIdSrcA).toBe('Element ID');
    expect(byName['Clash3'].elementIdSrcB).toBe('GUID');
    expect(byName['Clash3'].pairKey).toMatch(/^ID::/);

    // Clash 4: Entity Handle / GUID.
    expect(byName['Clash4'].elementIdA).toBe('EH-A4');
    expect(byName['Clash4'].elementIdB).toBe('GUID-B4');
    expect(byName['Clash4'].elementIdSrcA).toBe('Entity Handle');
    expect(byName['Clash4'].elementIdSrcB).toBe('GUID');
    expect(byName['Clash4'].pairKey).toMatch(/^ID::/);

    // Clash 5: no-ID on side A, GUID on side B → composite tier.
    expect(byName['Clash5'].elementIdA).toBe('');
    expect(byName['Clash5'].elementIdB).toBe('GUID-B5');
    expect(byName['Clash5'].elementIdSrcA).toBe('');
    expect(byName['Clash5'].elementIdSrcB).toBe('GUID');
    expect(byName['Clash5'].pairKey).toMatch(/^COMP::/);
  });

  test('re-importing the same fixture merges (does not duplicate) via pairKey', async ({ page }) => {
    // First import
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      importToRegister('append');
    }, FIXTURE);

    const countAfterFirst = await page.evaluate(() => S.clashes.length);

    // Second import — same fixture. pairKey lookup should find every clash
    // already in the register, so no new adds.
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      importToRegister('append');
    }, FIXTURE);

    const countAfterSecond = await page.evaluate(() => S.clashes.length);
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
