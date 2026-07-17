import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-03-CLOCK2-STATUS-TRANSITIONS + PR-03-ISO-RANGE-HARDEN contract:
   - Site 1 (importToRegister update branch): a status change on a
     re-imported clash stamps the transition with weekDate's ISO week
     (import-batch clock), NOT c.nwCreated's ISO week (Navisworks
     detection clock).
   - Site 3 (_weekYearFromISO): semantically invalid ranges (month>12,
     day out of 1..31) return null instead of silently rolling over.
   Fixtures deliberately place nwCreated in one ISO week and weekDate
   in another so the assertion can tell which clock derived the stamp.
   Fixture Clash1 first appears Active (import week 260601, W23), then
   the re-import (week 260608, W24) flips it to Reviewed. The
   transition stamp must land in W24 2026. */

// nwCreated = 2026-01-15 (day="15" month="1") → ISO W3 2026
// weekDate (import 1) = 2026-06-01 → ISO W23 2026
// weekDate (import 2) = 2026-06-08 → ISO W24 2026
// If transition stamp week === 3, code still uses nwCreated (BUG).
// If transition stamp week === 24, code correctly uses import-2 weekDate (PASS).
const XML_CLASH1_ACTIVE = `<?xml version="1.0"?>
<exchange units="mm">
  <batchtest>
    <clashtest name="TestClock2">
      <clashresult name="Clash1" distance="-0.02">
        <clashpoint><pos3f x="1" y="2" z="3"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="1" day="15" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-A-1</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-B-1</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;

const XML_CLASH1_REVIEWED = XML_CLASH1_ACTIVE.replace('<resultstatus>active</resultstatus>', '<resultstatus>reviewed</resultstatus>');

test.describe('PR-03-CLOCK2-STATUS-TRANSITIONS — re-import + duplicate-merge stamps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof importToRegister === 'function' && typeof _weekYearFromISO === 'function');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
      S.clashes = [];
      sv('clashes', []);
    });
  });

  test('Site 1 — re-import status transition stamps weekDate (W24), not nwCreated (W3)', async ({ page }) => {
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    // Import 1: Clash1 as Active, weekDate 2026-06-01 (W23 2026).
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_CLASH1_ACTIVE);
    // Import 2: same Clash1 (identical elementIds → PAIR-ID-MERGE
    // matches), now marked Reviewed. weekDate 2026-06-08 (W24 2026).
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260608'; c.weekDate = '2026-06-08'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_CLASH1_REVIEWED);
    const snap = await page.evaluate(() => {
      const c = (S.clashes || [])[0];
      const hist = c && c.statusHistory || [];
      return {
        count: (S.clashes || []).length,
        historyLen: hist.length,
        history0: hist[0],
        history1: hist[1],
        currentStatus: c && c.status,
        weekDate: c && c.weekDate,
        nwCreated: c && c.date,
      };
    });
    // Exactly one clash — merged into existing register entry.
    expect(snap.count).toBe(1);
    // history[0] from import 1 (weekDate 2026-06-01 → W23 2026).
    expect(snap.history0.week).toBe(23);
    expect(snap.history0.year).toBe(2026);
    expect(snap.history0.status).toBe('New');
    // history[1] from import-2 status transition. MUST stamp W24 (weekDate),
    // NOT W3 (nwCreated). This is the core assertion.
    expect(snap.historyLen).toBe(2);
    expect(snap.history1.week).toBe(24);
    expect(snap.history1.year).toBe(2026);
    expect(snap.history1.status).toBe('Reviewed');
    // Explicit negative: guards against regression that would reintroduce
    // the nwCreated-based derivation.
    expect(snap.history1.week).not.toBe(3);
    // weekDate reflects last-seen (import 2). c.date preserves Navisworks.
    expect(snap.weekDate).toBe('2026-06-08');
    expect(snap.nwCreated).toBe('15/01/26');
    expect(snap.currentStatus).toBe('Reviewed');
  });

  test('Site 1 — fallback to wall-clock when candidate weekDate is null (paste re-import)', async ({ page }) => {
    // Seed a clash directly, then re-import with weekDate=null to exercise
    // the fallback branch. Result must be _weekYearNow() (clock 3), never
    // nwCreated (clock 1, W3 in the fixture).
    const expected = await page.evaluate(() => {
      const d = new Date();
      return { week: isoWeekNum(d), year: isoWeekYear(d) };
    });
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    // Import 1 with weekDate set so history[0] lands cleanly.
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_CLASH1_ACTIVE);
    // Import 2 as a paste — weekDate null.
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = null; c.weekDate = null; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_CLASH1_REVIEWED);
    const h1 = await page.evaluate(() => {
      const c = (S.clashes || [])[0];
      return (c.statusHistory || [])[1];
    });
    // Fallback to wall-clock (clock 3), NOT nwCreated (W3).
    expect(h1.week).toBe(expected.week);
    expect(h1.year).toBe(expected.year);
    expect(h1.status).toBe('Reviewed');
    expect(h1.week).not.toBe(3);
  });

  test('Site 3 — _weekYearFromISO rejects semantically invalid ranges', async ({ page }) => {
    const out = await page.evaluate(() => ({
      m13: _weekYearFromISO('2026-13-45'),
      m00: _weekYearFromISO('2026-00-15'),
      d32: _weekYearFromISO('2026-06-32'),
      d00: _weekYearFromISO('2026-06-00'),
      // Valid still resolves — no regression.
      valid: _weekYearFromISO('2026-06-01'),
      earlyYr: _weekYearFromISO('2026-01-15'),
    }));
    // Range hardening rejects these outright — no silent rollover to
    // Feb 14 2027 or similar.
    expect(out.m13).toBeNull();
    expect(out.m00).toBeNull();
    expect(out.d32).toBeNull();
    expect(out.d00).toBeNull();
    // Valid inputs pass through unchanged.
    expect(out.valid).toEqual({ week: 23, year: 2026 });
    expect(out.earlyYr).toEqual({ week: 3, year: 2026 });
  });
});
