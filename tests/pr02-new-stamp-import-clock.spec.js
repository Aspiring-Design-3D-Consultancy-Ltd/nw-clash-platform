import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-02-NEW-STAMP-IMPORT-CLOCK contract:
   history[0].week/year on a new-insert clash must derive from the
   import-batch clock (weekDate, ISO YYYY-MM-DD), NOT from the
   Navisworks detection clock (c.nwCreated / c.date).
   Fixtures deliberately place nwCreated in one ISO week and
   weekDate in another so the assertion can tell which clock was
   used. Fallback path (no weekDate) is exercised too and must land
   on wall-clock (never on nwCreated). */

// nwCreated = 2026-01-15 (day="15" month="1") → parseDMY 15/01/26 → ISO W3 2026
// weekDate  = 2026-06-01 → ISO W23 2026
// If history[0].week === 3, the code still uses nwCreated (BUG).
// If history[0].week === 23, the code correctly uses weekDate (PASS).
const XML_NW_JAN_IMPORT_JUNE = `<?xml version="1.0"?>
<exchange units="mm">
  <batchtest>
    <clashtest name="TestClock">
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

test.describe('PR-02-NEW-STAMP-IMPORT-CLOCK — history[0] from weekDate not nwCreated', () => {
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

  test('_weekYearFromISO parses ISO YYYY-MM-DD correctly (not the DMY misparse)', async ({ page }) => {
    const out = await page.evaluate(() => ({
      w20260601: _weekYearFromISO('2026-06-01'),
      w20260115: _weekYearFromISO('2026-01-15'),
      wNull: _weekYearFromISO(null),
      wGarbage: _weekYearFromISO('not-a-date'),
      wDmyRejected: _weekYearFromISO('15/01/26'),
    }));
    // 2026-06-01 is a Monday in ISO W23 (Thursday determines year: 2026-06-04).
    expect(out.w20260601).toEqual({ week: 23, year: 2026 });
    // 2026-01-15 is a Thursday in ISO W3 2026.
    expect(out.w20260115).toEqual({ week: 3, year: 2026 });
    // Bad inputs return null (never crash, never guess).
    expect(out.wNull).toBeNull();
    expect(out.wGarbage).toBeNull();
    // Guardrail: DMY-formatted input is rejected, not silently misparsed
    // as YMD. The whole reason this helper exists is that parseDMY did.
    expect(out.wDmyRejected).toBeNull();
  });

  test('history[0] uses weekDate (ISO W23), not nwCreated (ISO W3)', async ({ page }) => {
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      // Simulate importing under week-260601 (weekDate 2026-06-01, ISO W23).
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_NW_JAN_IMPORT_JUNE);
    const snap = await page.evaluate(() => {
      const c = (S.clashes || [])[0];
      return {
        count: (S.clashes || []).length,
        nwCreated: c && c.date,           // Preserved Navisworks clock (DD/MM/YY)
        weekDate: c && c.weekDate,        // Import-batch clock (ISO)
        firstSeenWeekDate: c && c.firstSeenWeekDate,
        history0: c && c.statusHistory && c.statusHistory[0],
      };
    });
    expect(snap.count).toBe(1);
    // Navisworks c.date preserved untouched (clock 1).
    expect(snap.nwCreated).toBe('15/01/26');
    // Import-batch clock stamped (clock 2).
    expect(snap.weekDate).toBe('2026-06-01');
    expect(snap.firstSeenWeekDate).toBe('2026-06-01');
    // history[0] must reflect the IMPORT week (W23 2026), NOT the
    // Navisworks detection week (W3 2026). This is the core assertion.
    expect(snap.history0.status).toBe('New');
    expect(snap.history0.week).toBe(23);
    expect(snap.history0.year).toBe(2026);
    // Explicit negative — guard against a regression that would reintroduce
    // the nwCreated-based derivation.
    expect(snap.history0.week).not.toBe(3);
  });

  test('history[0] falls back to wall-clock week when weekDate is null (paste import)', async ({ page }) => {
    // Fresh Date() → today's ISO week. Compute the same way the app does.
    const expected = await page.evaluate(() => {
      const d = new Date();
      return { week: isoWeekNum(d), year: isoWeekYear(d) };
    });
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      // Paste-import scenario: weekDate stays null (parser can't derive it).
      _bcfC.forEach(c => { c.weekTag = null; c.weekDate = null; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_NW_JAN_IMPORT_JUNE);
    const h0 = await page.evaluate(() => {
      const c = (S.clashes || [])[0];
      return c && c.statusHistory && c.statusHistory[0];
    });
    // Fallback is wall-clock (clock 3 approximation of clock 2), NOT
    // nwCreated (W3). Ensures we never regress to Navisworks-clock
    // derivation on the paste-import path.
    expect(h0.week).toBe(expected.week);
    expect(h0.year).toBe(expected.year);
    expect(h0.status).toBe('New');
    expect(h0.week).not.toBe(3);
  });
});
