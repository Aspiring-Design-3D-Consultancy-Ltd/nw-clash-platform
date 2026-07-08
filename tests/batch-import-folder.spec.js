import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Minimal real-shape Clash Detective XML — enough that both parsers
// accept it and stamp exactly one clashresult per test.
function makeXml(clashName = 'Clash1', testName = 'GAS vs Struct') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="${testName}">
      <clashresult name="${clashName}" href="files\\cd000001.jpg" distance="-0.02">
        <clashpoint><pos3f x="100" y="100" z="100"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>GAS.nwc</node></pathlink>
          <objectattribute><name>Item Name</name><value>Duct-1</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structure.nwc</node></pathlink>
          <objectattribute><name>Item Name</name><value>Beam-1</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page, view = 'bcf') {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate((v) => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    // BCF view brings up #bxml + #b-batch-wrap that the parsers touch.
    nav(v);
  }, view);
}

test.describe('BATCH-IMPORT-FOLDER-CAPTURE', () => {
  test('_extractSourceFolder — first path segment for a webkitRelativePath, null for a bare filename', async ({ page }) => {
    await bootstrap(page);
    const cases = await page.evaluate(() => {
      return {
        deepPath: _extractSourceFolder('260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'),
        twoLevel: _extractSourceFolder('Week1/testA.xml'),
        windows:  _extractSourceFolder('Week1\\testA.xml'),
        mixed:    _extractSourceFolder('Week1/sub\\file.xml'),
        bare:     _extractSourceFolder('03_GAS_v_08_AMHS.xml'),
        empty:    _extractSourceFolder(''),
        nullIn:   _extractSourceFolder(null),
      };
    });
    expect(cases.deepPath).toBe('260601 FAB AMHS v 7 Clash test');
    expect(cases.twoLevel).toBe('Week1');
    expect(cases.windows).toBe('Week1');
    expect(cases.mixed).toBe('Week1'); // whichever separator comes first
    expect(cases.bare).toBeNull();
    expect(cases.empty).toBeNull();
    expect(cases.nullIn).toBeNull();
  });

  test('parser 1 (batchParse) — clashes from two folders carry distinct sourceFolder values', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async ({ xmlA, xmlB }) => {
      // Simulate a webkitdirectory pick landing at bloadf/batchLoad. The
      // parser reads _batchResults and _batchFilePaths — both indexed by
      // the bare filename that the caller decided is unique across the
      // batch. importFolderPick achieves that by prefixing filenames when
      // a dir path exists — we mimic that here so the batch can carry
      // two files that live at the same basename in different folders.
      _batchResults = { 'A::03_GAS_v_08_AMHS.xml': xmlA, 'B::03_GAS_v_08_AMHS.xml': xmlB };
      _batchFilePaths = {
        'A::03_GAS_v_08_AMHS.xml': 'Week1/testA.xml/03_GAS_v_08_AMHS.xml',
        'B::03_GAS_v_08_AMHS.xml': 'Week2/testA.xml/03_GAS_v_08_AMHS.xml',
      };
      // Fake File objects — batchParse uses them only for lastModified.
      const filesFake = [
        { name: 'A::03_GAS_v_08_AMHS.xml', lastModified: 0 },
        { name: 'B::03_GAS_v_08_AMHS.xml', lastModified: 0 },
      ];
      batchParse(filesFake, [], 2);
      return _bcfC.map(c => ({
        nwName: c.nwName,
        sourceFile: c.sourceFile,
        sourceFilePath: c.sourceFilePath,
        sourceFolder: c.sourceFolder,
      }));
    }, { xmlA: makeXml('ClashA'), xmlB: makeXml('ClashB') });

    expect(result).toHaveLength(2);
    const byName = Object.fromEntries(result.map(r => [r.nwName, r]));
    expect(byName.ClashA.sourceFolder).toBe('Week1');
    expect(byName.ClashA.sourceFilePath).toBe('Week1/testA.xml/03_GAS_v_08_AMHS.xml');
    expect(byName.ClashB.sourceFolder).toBe('Week2');
    expect(byName.ClashB.sourceFilePath).toBe('Week2/testA.xml/03_GAS_v_08_AMHS.xml');
    // sourceFile stays as the caller-provided leaf (which we chose to
    // include a folder-prefix in above so parser 1's per-file dict keys
    // stayed unique). Real production usage would leave sourceFile as
    // the bare basename — asserted in the parser-2 test below.
  });

  test('parser 2 (bparse) — folder pick threads sourceFolder onto every clash', async ({ page }) => {
    await bootstrap(page);
    const clash = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC[0];
    }, makeXml('Clash1'));
    expect(clash.sourceFile).toBe('03_GAS_v_08_AMHS.xml');
    expect(clash.sourceFilePath).toBe('260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml');
    expect(clash.sourceFolder).toBe('260601 FAB AMHS v 7 Clash test');
  });

  test('parser 2 (bparse) — single-file / paste path stamps sourceFolder=null explicitly (not undefined)', async ({ page }) => {
    await bootstrap(page);
    const clash = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['03_GAS_v_08_AMHS.xml']; // no folder context
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC[0];
    }, makeXml('Clash1'));
    expect(clash.sourceFile).toBe('03_GAS_v_08_AMHS.xml');
    expect(clash.sourceFilePath).toBe('03_GAS_v_08_AMHS.xml');
    // Distinguish from `undefined` — downstream code needs to be able to
    // tell "captured but no folder" apart from "never captured at all".
    expect(clash.sourceFolder).toBeNull();
    expect('sourceFolder' in clash).toBe(true);
  });

  test('importToRegister — sourceFolder is persisted on the register clash (null preserved)', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['Week1/03_GAS_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      // Give it one weekly snapshot so importToRegister has an anchor.
      const today = new Date();
      S.weekly = [{
        label: 'Wk ' + isoWeekNum(today),
        date: today.toISOString().slice(0, 10),
        week: isoWeekNum(today), year: isoWeekYear(today),
        imports: [],
      }];
      window._skipCrossTestDupes = true;
      importToRegister('append');
      return S.clashes.slice();
    }, makeXml('Clash1'));
    expect(state.length).toBe(1);
    expect(state[0].sourceFolder).toBe('Week1');
    expect(state[0].sourceFilePath).toBe('Week1/03_GAS_v_08_AMHS.xml');
    expect(state[0].sourceFile).toBe('03_GAS_v_08_AMHS.xml');
  });

  test('importToRegister — single-file path persists sourceFolder=null', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['03_GAS_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      const today = new Date();
      S.weekly = [{
        label: 'Wk ' + isoWeekNum(today),
        date: today.toISOString().slice(0, 10),
        week: isoWeekNum(today), year: isoWeekYear(today),
        imports: [],
      }];
      window._skipCrossTestDupes = true;
      importToRegister('append');
      return S.clashes.slice();
    }, makeXml('Clash1'));
    expect(state.length).toBe(1);
    expect(state[0].sourceFolder).toBeNull();
    expect('sourceFolder' in state[0]).toBe(true);
  });

  test('backward-compat — legacy clashes without sourceFolder load without errors and render normally', async ({ page }) => {
    await bootstrap(page);
    const info = await page.evaluate(() => {
      // Seed a legacy clash — no sourceFolder field at all (undefined).
      S.clashes = [{
        uid: 'CLX-001',
        name: 'CLX-001 legacy',
        nwOrig: 'ClashLegacy',
        testName: '[H] Legacy Test',
        status: 'Active', priority: 'High',
        disciplineA: 'MEP', disciplineB: 'Structural',
        elementA: 'Duct-1', elementB: 'Beam-1',
        elementIdA: '', elementIdB: '',
        sourceA: '', sourceB: '',
        sourceFile: '03_GAS_v_08_AMHS.xml',
        // sourceFilePath / sourceFolder INTENTIONALLY OMITTED
        date: '01/07/26', x: 100, y: 100, z: 100,
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      sv('clashes', S.clashes);
      // Navigate to the register — this exercises rReg which iterates
      // every clash. A missing sourceFolder must not throw.
      let err = null;
      try { nav('register'); } catch (e) { err = e.message; }
      return { err, count: S.clashes.length, folder: S.clashes[0].sourceFolder };
    });
    expect(info.err).toBeNull();
    expect(info.count).toBe(1);
    expect(info.folder).toBeUndefined();
  });
});

test.describe('RQ-EXPORT-FOLDER-DISPLAY', () => {
  const rqSeed = (folder, base, date, nwOrig, uid) => ({
    uid, name: uid, nwOrig,
    testName: '[H] Test',
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementA: 'a', elementB: 'b',
    elementIdA: '', elementIdB: '',
    sourceA: '', sourceB: '',
    sourceFile: base,
    sourceFilePath: folder ? folder + '/' + base : base,
    sourceFolder: folder,
    penetration: '20mm', status: 'Active', priority: 'High',
    assignedTo: '', notes: '', date, x: 0, y: 0, z: 0,
    nwImageRef: '', statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
    pendingReview: true,
  });

  test('breakdown separates identical basenames from different folders', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate((seed) => {
      S.clashes = seed;
      S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', []);
      nav('review');
    }, [
      rqSeed('Week1', '03_GAS_v_08_AMHS.xml', '15/05/26', 'C1', 'CLX-1'),
      rqSeed('Week1', '03_GAS_v_08_AMHS.xml', '15/05/26', 'C2', 'CLX-2'),
      rqSeed('Week2', '03_GAS_v_08_AMHS.xml', '22/05/26', 'C3', 'CLX-3'),
    ]);
    // Verify the grouper unit-first.
    const groups = await page.evaluate(() => {
      const p = (S.clashes || []).filter(c => c.pendingReview);
      return _rqNwGroupByFileDate(p).map(g => ({ folder: g.folder, base: g.base, date: g.date, count: g.count }));
    });
    expect(groups).toEqual([
      { folder: 'Week1', base: '03_gas_v_08_amhs.xml', date: '15/05/26', count: 2 },
      { folder: 'Week2', base: '03_gas_v_08_amhs.xml', date: '22/05/26', count: 1 },
    ]);
    // Modal render — both folder prefixes surface visibly.
    await page.evaluate(() => showRqNwExportModal());
    const bd = page.locator('#rq-nw-breakdown');
    await expect(bd).toContainText('Week1 / 03_GAS_v_08_AMHS.xml');
    await expect(bd).toContainText('Week2 / 03_GAS_v_08_AMHS.xml');
    await expect(bd).toContainText('15/05/26');
    await expect(bd).toContainText('22/05/26');
  });

  test('breakdown shows "(no folder captured)" prefix for legacy or single-file clashes', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate((seed) => {
      S.clashes = seed;
      S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', []);
      nav('review');
    }, [
      rqSeed(null, '03_GAS_v_08_AMHS.xml', '15/05/26', 'C1', 'CLX-1'),
      rqSeed(null, '03_GAS_v_08_AMHS.xml', '15/05/26', 'C2', 'CLX-2'),
    ]);
    await page.evaluate(() => showRqNwExportModal());
    const bd = page.locator('#rq-nw-breakdown');
    await expect(bd).toContainText('(no folder captured)');
    await expect(bd).toContainText('03_GAS_v_08_AMHS.xml');
  });

  test('DATE-MATCH row labels prefix folder for ✓ and ✗ rows when the manifest has one', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate((seed) => {
      S.clashes = seed;
      S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', []);
      nav('review');
    }, [
      rqSeed('Week1', '03_GAS_v_08_AMHS.xml', '15/05/26', 'C1', 'CLX-1'),
      rqSeed('Week1', '03_GAS_v_08_AMHS.xml', '15/05/26', 'C2', 'CLX-2'),
      rqSeed('Week2', '03_GAS_v_08_AMHS.xml', '22/05/26', 'C3', 'CLX-3'),
    ]);
    await page.evaluate(() => showRqNwExportModal());
    // Provide only the Week1 file (dated 15/05/26). File input can't
    // convey folder, but the ✓ row copies the folder from the expected
    // bucket it consumed.
    const xml = `<?xml version="1.0"?><exchange><batchtest><clashtest>
      <clashresult name="C1"><createddate><date year="2026" month="5" day="15" hour="10" minute="0" second="0"/></createddate></clashresult>
    </clashtest></batchtest></exchange>`;
    await page.locator('#rq-nw-file-input').setInputFiles({
      name: '03_GAS_v_08_AMHS.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from(xml, 'utf-8'),
    });
    await page.waitForFunction(() => document.querySelector('#rq-nw-match-summary')?.innerHTML.length > 0);
    const summary = page.locator('#rq-nw-match-summary');
    await expect(summary).toContainText('Week1 / 03_GAS_v_08_AMHS.xml');
    await expect(summary).toContainText('Missing: Week2 / 03_GAS_v_08_AMHS.xml');
  });
});
