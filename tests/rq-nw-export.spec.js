import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Real Navisworks-authored XML shape — Clash Detective wraps every result
// in an <exchange><batchtest><clashtest> outer, and each <clashresult>
// carries an href to the viewpoint JPG, a distance attribute, a
// <clashpoint>, a <resultstatus>, a <createddate>, and two <clashobject>
// entries with a <pathlink> per source file. That verbatim structure is
// what Navisworks reads back to place viewpoints on import; RQ-NW-EXPORT
// promises we don't touch it.
function buildFixtureXml(names, testName = 'GAS vs Structure') {
  const results = names.map((n, i) => `      <clashresult name="${n}" href="files\\cd0000${(i+1).toString().padStart(2,'0')}.jpg" distance="-0.02">
        <clashpoint><pos3f x="${100+i*3}" y="100" z="100"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>GAS_v_08_AMHS.nwc</node></pathlink>
          <objectattribute><name>Item Name</name><value>Duct-${n}</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structure.nwc</node></pathlink>
          <objectattribute><name>Item Name</name><value>Beam-${n}</value></objectattribute>
        </clashobject>
      </clashresult>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm" filename="03_GAS_v_08_AMHS.xml">
  <batchtest units="mm">
    <clashtest name="${testName}">
${results}
    </clashtest>
  </batchtest>
</exchange>
`;
}

function seedClash(uid, nwOrig, sourceFile = '03_GAS_v_08_AMHS.xml') {
  return {
    uid,
    name: uid + ' — pending',
    nwOrig,
    testName: '[H] GAS vs Structure',
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementA: 'Duct-' + nwOrig, elementB: 'Beam-' + nwOrig,
    elementIdA: '', elementIdB: '',
    elementIdSrcA: '', elementIdSrcB: '',
    sourceA: 'GAS_v_08_AMHS.nwc', sourceB: 'Structure.nwc',
    sourceFile,
    sourceFilePath: sourceFile,
    penetration: '20mm',
    status: 'Active', priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    x: 100, y: 100, z: 100,
    nwImageRef: '',
    statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
    pendingReview: true,
    disappearedAt: '2026-07-06T09:00:00',
    disappearedInBatch: '2026-07-06',
  };
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

async function seed(page, clashes) {
  await page.evaluate((clashes) => {
    S.clashes = clashes.slice();
    S.dedupQueue = [];
    sv('clashes', S.clashes);
    sv('dedupQueue', []);
    nav('review');
  }, clashes);
}

// Today's YYYYMMDD in the browser's local time (matches the app's stamp).
async function todayStamp(page) {
  return page.evaluate(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  });
}

test.describe('RQ-NW-EXPORT', () => {
  test('happy path — 3 Review Queue clashes match 3 <clashresult> blocks in the provided XML, clashtest renamed, children preserved verbatim', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      seedClash('CLX-001', 'Clash1'),
      seedClash('CLX-005', 'Clash5'),
      seedClash('CLX-010', 'Clash10'),
    ]);
    // Verify the Review Queue toolbar button surfaced (RQ-NW-EXPORT-BTN).
    const exportBtn = page.locator('button', { hasText: /Export for Navisworks review/ });
    await expect(exportBtn).toBeVisible();

    // Fixture: XML containing Clash1..Clash20; we want 1, 5, 10 back.
    const fixtureXml = buildFixtureXml(
      Array.from({ length: 20 }, (_, i) => `Clash${i + 1}`)
    );
    // Drive the filter directly to sidestep the file-picker / blob-download
    // dance (Playwright can setInputFiles + trap the download event, but we
    // want to assert the payload's structure — the modal renderer takes
    // the filter's result as its sole input, so pushing through this path
    // covers both).
    const result = await page.evaluate((xml) => {
      const pending = (S.clashes || []).filter(c => c.pendingReview === true);
      const map = new Map([['03_GAS_v_08_AMHS.xml', xml]]);
      return _rqNwBuildExportXml(pending, map);
    }, fixtureXml);

    const stamp = await todayStamp(page);
    expect(result.testName).toBe(`ReviewQueue_${stamp}`);
    expect(result.matchedCount).toBe(3);
    expect(result.unmatchedNames).toHaveLength(0);
    expect(result.missingFiles).toHaveLength(0);
    expect(result.xmlOut).not.toBeNull();

    // <clashtest> renamed.
    expect(result.xmlOut).toContain(`<clashtest name="ReviewQueue_${stamp}">`);
    // Exactly 3 <clashresult> blocks in the output.
    const matches = result.xmlOut.match(/<clashresult\b/g) || [];
    expect(matches).toHaveLength(3);
    // Each of the three names present.
    expect(result.xmlOut).toContain('name="Clash1"');
    expect(result.xmlOut).toContain('name="Clash5"');
    expect(result.xmlOut).toContain('name="Clash10"');
    // Children preserved verbatim — spot-check the pathlink / clashpoint /
    // createddate blocks Navisworks needs to place viewpoints. If ANY of
    // these missed the round-trip Navisworks would silently drop the
    // viewpoint on import.
    expect(result.xmlOut).toContain('<pos3f x="100" y="100" z="100"/>');
    expect(result.xmlOut).toContain('<pathlink><node>ESMC.nwd</node><node>GAS_v_08_AMHS.nwc</node></pathlink>');
    expect(result.xmlOut).toContain('<pathlink><node>ESMC.nwd</node><node>Structure.nwc</node></pathlink>');
    expect(result.xmlOut).toContain('<resultstatus>active</resultstatus>');
    expect(result.xmlOut).toContain('<createddate><date year="2026" month="7" day="1" hour="10" minute="0" second="0"/></createddate>');
    // Href attribute survived — Navisworks uses this to relocate the JPG.
    expect(result.xmlOut).toMatch(/href="files\\cd000001\.jpg"/);
    expect(result.xmlOut).toMatch(/href="files\\cd000005\.jpg"/);
    expect(result.xmlOut).toMatch(/href="files\\cd000010\.jpg"/);
    // Outer wrapper preserved — <exchange units="mm"> etc.
    expect(result.xmlOut).toMatch(/<exchange units="mm"[^>]*>/);
    expect(result.xmlOut).toContain('<batchtest units="mm">');
  });

  test('missing 2 of 5 — clashes whose nwOrig isn\'t in the provided XML surface in unmatchedNames; export still ships the 3 that matched', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      seedClash('CLX-001', 'Clash1'),
      seedClash('CLX-002', 'Clash2'),
      seedClash('CLX-003', 'Clash3'),
      seedClash('CLX-999', 'Clash999'), // not in fixture
      seedClash('CLX-998', 'Clash998'), // not in fixture
    ]);
    // Fixture holds Clash1..Clash5 only — Clash999 / Clash998 are absent.
    const fixtureXml = buildFixtureXml(['Clash1', 'Clash2', 'Clash3', 'Clash4', 'Clash5']);
    const result = await page.evaluate((xml) => {
      const pending = (S.clashes || []).filter(c => c.pendingReview === true);
      const map = new Map([['03_GAS_v_08_AMHS.xml', xml]]);
      return _rqNwBuildExportXml(pending, map);
    }, fixtureXml);

    expect(result.matchedCount).toBe(3);
    expect(result.unmatchedNames).toHaveLength(2);
    const unmatchedSet = new Set(result.unmatchedNames.map(u => u.name));
    expect(unmatchedSet.has('Clash999')).toBe(true);
    expect(unmatchedSet.has('Clash998')).toBe(true);
    expect(result.missingFiles).toHaveLength(0);
    // The 3 that matched are in the output; the missing 2 are not.
    const nameMatches = (result.xmlOut.match(/name="Clash\d+"/g) || []);
    expect(nameMatches).toHaveLength(3);
    expect(nameMatches).toEqual(expect.arrayContaining(['name="Clash1"', 'name="Clash2"', 'name="Clash3"']));
  });

  test('clashes span 2 source files, user provides only 1 → missingFiles reports the unprovided one, export ships what it can', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      seedClash('CLX-001', 'Clash1', '03_GAS_v_08_AMHS.xml'),
      seedClash('CLX-002', 'Clash2', '03_GAS_v_08_AMHS.xml'),
      seedClash('CLX-101', 'ClashA', '05_HVAC_v_12.xml'),
      seedClash('CLX-102', 'ClashB', '05_HVAC_v_12.xml'),
      seedClash('CLX-103', 'ClashC', '05_HVAC_v_12.xml'),
    ]);
    // User provides only the GAS file.
    const gasXml = buildFixtureXml(['Clash1', 'Clash2', 'Clash3']);
    const result = await page.evaluate((xml) => {
      const pending = (S.clashes || []).filter(c => c.pendingReview === true);
      const map = new Map([['03_GAS_v_08_AMHS.xml', xml]]);
      return _rqNwBuildExportXml(pending, map);
    }, gasXml);

    expect(result.matchedCount).toBe(2);
    expect(result.missingFiles).toHaveLength(1);
    expect(result.missingFiles[0].file).toBe('05_HVAC_v_12.xml');
    expect(result.missingFiles[0].count).toBe(3);
    // The 3 clashes tied to the missing file should also appear as
    // unmatched (their names weren't in any provided XML).
    const unmatchedByFile = result.unmatchedNames.filter(u => /HVAC/i.test(u.sourceFile));
    expect(unmatchedByFile).toHaveLength(3);
    expect(result.xmlOut).toContain('name="Clash1"');
    expect(result.xmlOut).toContain('name="Clash2"');
    // The HVAC-side clashes are not in the output.
    expect(result.xmlOut).not.toContain('name="ClashA"');
    expect(result.xmlOut).not.toContain('name="ClashC"');
  });

  test('case + path insensitivity — user picks a file whose name differs in case / prefix from the sourceFile stored on the clash', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      seedClash('CLX-001', 'Clash1', 'C:\\Nav\\03_GAS_v_08_AMHS.xml'),
      seedClash('CLX-005', 'Clash5', 'C:\\Nav\\03_GAS_v_08_AMHS.xml'),
    ]);
    // File name normalised: same basename, lowercased differently.
    const fixtureXml = buildFixtureXml(['Clash1', 'Clash5']);
    const result = await page.evaluate((xml) => {
      const pending = (S.clashes || []).filter(c => c.pendingReview === true);
      // Note the mixed-case + path prefix — normaliser must strip both.
      const map = new Map([['/tmp/03_gas_v_08_amhs.xml', xml]]);
      return _rqNwBuildExportXml(pending, map);
    }, fixtureXml);
    expect(result.matchedCount).toBe(2);
    expect(result.missingFiles).toHaveLength(0);
  });

  test('modal renders the source-file summary and enables Export once files picked', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      seedClash('CLX-001', 'Clash1'),
      seedClash('CLX-005', 'Clash5'),
    ]);
    await page.evaluate(() => showRqNwExportModal());
    const modal = page.locator('#rq-nw-export-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('03_GAS_v_08_AMHS.xml');
    await expect(modal).toContainText('2 clashes');
    const exportBtn = page.locator('#rq-nw-export');
    await expect(exportBtn).toBeDisabled();
    // Attach a fixture file via setInputFiles buffer.
    const fixtureXml = buildFixtureXml(['Clash1', 'Clash5']);
    await page.locator('#rq-nw-file-input').setInputFiles({
      name: '03_GAS_v_08_AMHS.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from(fixtureXml, 'utf-8'),
    });
    await expect(exportBtn).toBeEnabled();
    // Click Export; the download-anchor auto-clicks so we listen for a
    // download event AND assert the modal swapped to the success view.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ]);
    const stamp = await todayStamp(page);
    expect(download.suggestedFilename()).toBe(`ReviewQueue_${stamp}.xml`);
    // Modal now shows the success banner.
    await expect(modal).toContainText(/Exported 2 clash(es)? to/);
    await expect(page.locator('#rq-nw-close')).toBeVisible();
  });

  test('button hidden when Review Queue is empty', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      S.clashes = [];
      sv('clashes', []);
      nav('review');
    });
    await expect(page.locator('button', { hasText: /Export for Navisworks review/ })).toHaveCount(0);
  });

  test('no matches at all — modal surfaces the red "nothing exported" banner and does not offer a download', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [seedClash('CLX-001', 'Clash1')]);
    // User provides an XML that doesn't contain Clash1.
    const wrongXml = buildFixtureXml(['ClashOther']);
    const result = await page.evaluate((xml) => {
      const pending = (S.clashes || []).filter(c => c.pendingReview === true);
      const map = new Map([['03_GAS_v_08_AMHS.xml', xml]]);
      return _rqNwBuildExportXml(pending, map);
    }, wrongXml);
    expect(result.matchedCount).toBe(0);
    expect(result.xmlOut).toBeNull();
    expect(result.unmatchedNames).toHaveLength(1);
    expect(result.unmatchedNames[0].name).toBe('Clash1');
  });

  // ── RQ-NW-EXPORT-BREAKDOWN + RQ-NW-EXPORT-DATE-MATCH ──────────────────
  // The date-hinting phase. Groups pending clashes by (source basename,
  // DD/MM/YY) so the user can see which weekly archive each cluster came
  // from, then parses the first <createddate> from every provided file
  // and renders a ✓/✗/⚠ table describing how well their selection covers
  // the expected buckets.
  function buildFixtureXmlDated(names, year, month, day, testName = 'GAS vs Structure') {
    const results = names.map((n, i) => `      <clashresult name="${n}" href="files\\cd0000${(i+1).toString().padStart(2,'0')}.jpg" distance="-0.02">
        <clashpoint><pos3f x="${100+i*3}" y="100" z="100"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="${year}" month="${month}" day="${day}" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>GAS_v_08_AMHS.nwc</node></pathlink>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structure.nwc</node></pathlink>
        </clashobject>
      </clashresult>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm" filename="03_GAS_v_08_AMHS.xml">
  <batchtest units="mm">
    <clashtest name="${testName}">
${results}
    </clashtest>
  </batchtest>
</exchange>
`;
  }

  // 5 pending clashes across 2 distinct dates from the same filename —
  // BREAKDOWN must list both rows with the right per-date count.
  test('RQ-NW-EXPORT-BREAKDOWN — groups Review Queue clashes by (source, date) and shows counts per group', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      { ...seedClash('CLX-101', 'Clash1'), date: '15/05/26' },
      { ...seedClash('CLX-102', 'Clash2'), date: '15/05/26' },
      { ...seedClash('CLX-103', 'Clash3'), date: '15/05/26' },
      { ...seedClash('CLX-201', 'Clash4'), date: '22/05/26' },
      { ...seedClash('CLX-202', 'Clash5'), date: '22/05/26' },
    ]);

    // Drive the grouper directly first — the render is a straight
    // mapping over its output, so this pins the invariant.
    const groups = await page.evaluate(() => {
      const pending = (S.clashes || []).filter(c => c.pendingReview === true);
      return _rqNwGroupByFileDate(pending).map(g => ({ base: g.base, date: g.date, count: g.count }));
    });
    expect(groups).toEqual([
      { base: '03_gas_v_08_amhs.xml', date: '15/05/26', count: 3 },
      { base: '03_gas_v_08_amhs.xml', date: '22/05/26', count: 2 },
    ]);

    // Modal renders both rows in date-ascending order.
    await page.evaluate(() => showRqNwExportModal());
    const breakdown = page.locator('#rq-nw-breakdown');
    await expect(breakdown).toBeVisible();
    await expect(breakdown).toContainText('15/05/26');
    await expect(breakdown).toContainText('22/05/26');
    await expect(breakdown).toContainText('3 clashes');
    await expect(breakdown).toContainText('2 clashes');
  });

  // Provide the earlier week's XML only — DATE-MATCH shows ✓ for the
  // 15/05 bucket and ✗ for the 22/05 bucket with the clash count that
  // won't export.
  test('RQ-NW-EXPORT-DATE-MATCH — ✓ for provided week, ✗ for missing week with clash count', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      { ...seedClash('CLX-101', 'Clash1'), date: '15/05/26' },
      { ...seedClash('CLX-102', 'Clash2'), date: '15/05/26' },
      { ...seedClash('CLX-103', 'Clash3'), date: '15/05/26' },
      { ...seedClash('CLX-201', 'Clash4'), date: '22/05/26' },
      { ...seedClash('CLX-202', 'Clash5'), date: '22/05/26' },
    ]);
    await page.evaluate(() => showRqNwExportModal());
    const earlierXml = buildFixtureXmlDated(['Clash1', 'Clash2', 'Clash3'], 2026, 5, 15);
    await page.locator('#rq-nw-file-input').setInputFiles({
      name: '03_GAS_v_08_AMHS.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from(earlierXml, 'utf-8'),
    });
    // Wait for the async parse+render to complete.
    await page.waitForFunction(() => document.querySelector('#rq-nw-match-summary')?.innerHTML.length > 0);
    const match = page.locator('#rq-nw-match-summary');
    await expect(match).toContainText('✓');
    await expect(match).toContainText('✗');
    await expect(match).toContainText('15/05/26');
    await expect(match).toContainText('matches 3 clashes');
    await expect(match).toContainText('22/05/26');
    await expect(match).toContainText('2 clashes will not export');
    await expect(match).toContainText('1 of 2 expected weeks covered');
  });

  // Provide a file whose <createddate> doesn't match any expected date —
  // DATE-MATCH ⚠'s the file with "wrong week?" copy.
  test('RQ-NW-EXPORT-DATE-MATCH — ⚠ when a provided file\'s date isn\'t in the Review Queue', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      { ...seedClash('CLX-101', 'Clash1'), date: '15/05/26' },
      { ...seedClash('CLX-102', 'Clash2'), date: '15/05/26' },
    ]);
    await page.evaluate(() => showRqNwExportModal());
    // Provided file dated 08/07/26 — not in the queue. Different basename
    // so Playwright's setInputFiles preserves both entries (browsers
    // dedupe file inputs by name; distinct names sidestep that here).
    const strayXml = buildFixtureXmlDated(['ClashX', 'ClashY'], 2026, 7, 8);
    await page.locator('#rq-nw-file-input').setInputFiles([
      // A correctly-dated file plus the stray so we get both ✓ and ⚠.
      { name: '03_GAS_v_08_AMHS.xml', mimeType: 'application/xml',
        buffer: Buffer.from(buildFixtureXmlDated(['Clash1', 'Clash2'], 2026, 5, 15), 'utf-8') },
      { name: '05_HVAC_wrong_week.xml', mimeType: 'application/xml',
        buffer: Buffer.from(strayXml, 'utf-8') },
    ]);
    await page.waitForFunction(() => document.querySelector('#rq-nw-match-summary')?.innerHTML.length > 0);
    const match = page.locator('#rq-nw-match-summary');
    await expect(match).toContainText('⚠');
    await expect(match).toContainText('08/07/26');
    await expect(match).toContainText('wrong week');
    // The ✓ row for the good file is still there.
    await expect(match).toContainText('✓');
    await expect(match).toContainText('15/05/26');
  });

  // Provide files covering all expected dates — DATE-MATCH shows all ✓
  // with no ✗ / no ⚠.
  test('RQ-NW-EXPORT-DATE-MATCH — all dates covered, no ✗ / no ⚠ rows', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      { ...seedClash('CLX-101', 'Clash1'), date: '15/05/26' },
      { ...seedClash('CLX-102', 'Clash2'), date: '15/05/26' },
      { ...seedClash('CLX-201', 'Clash3'), date: '22/05/26' },
    ]);
    await page.evaluate(() => showRqNwExportModal());
    await page.locator('#rq-nw-file-input').setInputFiles([
      { name: '03_GAS_v_08_AMHS.xml', mimeType: 'application/xml',
        buffer: Buffer.from(buildFixtureXmlDated(['Clash1', 'Clash2'], 2026, 5, 15), 'utf-8') },
      { name: '03_GAS_v_08_AMHS.xml', mimeType: 'application/xml',
        buffer: Buffer.from(buildFixtureXmlDated(['Clash3'], 2026, 5, 22), 'utf-8') },
    ]);
    await page.waitForFunction(() => document.querySelector('#rq-nw-match-summary')?.innerHTML.length > 0);
    const summary = await page.locator('#rq-nw-match-summary').innerHTML();
    expect(summary).toContain('All expected weeks covered');
    expect(summary).toContain('2 of 2');
    // No ✗ or ⚠ characters anywhere in the panel.
    expect(summary).not.toContain('✗');
    expect(summary).not.toContain('⚠');
    expect((summary.match(/✓/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  // Sanity: _rqNwParseFirstDate returns null on XMLs without a
  // <createddate> so DATE-MATCH treats the file as "no matching clashes"
  // rather than crashing.
  test('RQ-NW-EXPORT-DATE-MATCH — files without <createddate> parse to null and surface as ⚠', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [{ ...seedClash('CLX-001', 'Clash1'), date: '15/05/26' }]);
    const noDateXml = `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="dated">
      <clashresult name="Clash1"><clashpoint><pos3f x="0" y="0" z="0"/></clashpoint></clashresult>
    </clashtest>
  </batchtest>
</exchange>`;
    const parsed = await page.evaluate((xml) => _rqNwParseFirstDate(xml), noDateXml);
    expect(parsed).toBeNull();
    // And in the modal path — an ⚠ surfaces for the file.
    await page.evaluate(() => showRqNwExportModal());
    await page.locator('#rq-nw-file-input').setInputFiles({
      name: 'no-date.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from(noDateXml, 'utf-8'),
    });
    await page.waitForFunction(() => document.querySelector('#rq-nw-match-summary')?.innerHTML.length > 0);
    await expect(page.locator('#rq-nw-match-summary')).toContainText('no <createddate> element found');
  });
});
