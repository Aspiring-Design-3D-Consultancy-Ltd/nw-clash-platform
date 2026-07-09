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
  test('_extractSourceFolder — index [1] (archive folder) for both 3-seg and 4-seg layouts', async ({ page }) => {
    await bootstrap(page);
    const cases = await page.evaluate(() => {
      return {
        // AMHS side, 4-segment: picked / archive / test-subfolder / XML.
        amhsFourSeg: _extractSourceFolder('Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'),
        // Windows separators must resolve the same way.
        windowsAmhs: _extractSourceFolder('Clash Tests\\260601 FAB AMHS v 7 Clash test\\03_GAS_v_08_AMHS\\03_GAS_v_08_AMHS.xml'),
        // Exyte side, 3-segment: picked / archive / XML (no test subfolder).
        exyteThreeSeg: _extractSourceFolder('Clash Tests/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml'),
        windowsExyte: _extractSourceFolder('Clash Tests\\260629 FAB Exyte v AMHS Clash test\\Exyte AAS_v_08_AMHS.xml'),
        // 2 segments: BATCH-IMPORT-PICK-VALIDATION blocks these before
        // parse, so we don't need the helper to invent an archive.
        twoSeg: _extractSourceFolder('Week1/testA.xml'),
        // Bare filename: no folder captured.
        bare: _extractSourceFolder('03_GAS_v_08_AMHS.xml'),
        empty: _extractSourceFolder(''),
        nullIn: _extractSourceFolder(null),
      };
    });
    expect(cases.amhsFourSeg).toBe('260601 FAB AMHS v 7 Clash test');
    expect(cases.windowsAmhs).toBe('260601 FAB AMHS v 7 Clash test');
    expect(cases.exyteThreeSeg).toBe('260629 FAB Exyte v AMHS Clash test');
    expect(cases.windowsExyte).toBe('260629 FAB Exyte v AMHS Clash test');
    expect(cases.twoSeg).toBeNull(); // fewer than 3 → null (no archive layer)
    expect(cases.bare).toBeNull();
    expect(cases.empty).toBeNull();
    expect(cases.nullIn).toBeNull();
  });

  test('parser 1 (batchParse) — canonical 4-segment paths yield archive folder as sourceFolder', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async ({ xmlA, xmlB }) => {
      // Two weekly archives, same test-subfolder name, same XML basename —
      // the third-from-last segment must differ so the batch's clashes
      // attribute correctly to their archive.
      _batchResults = { 'A::03_GAS_v_08_AMHS.xml': xmlA, 'B::03_GAS_v_08_AMHS.xml': xmlB };
      _batchFilePaths = {
        'A::03_GAS_v_08_AMHS.xml': 'Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
        'B::03_GAS_v_08_AMHS.xml': 'Clash Tests/260616 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
      };
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
    expect(byName.ClashA.sourceFolder).toBe('260601 FAB AMHS v 7 Clash test');
    expect(byName.ClashA.sourceFilePath).toBe('Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml');
    expect(byName.ClashB.sourceFolder).toBe('260616 FAB AMHS v 7 Clash test');
    expect(byName.ClashB.sourceFilePath).toBe('Clash Tests/260616 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml');
  });

  test('parser 2 (bparse) — canonical 4-segment path stamps archive folder as sourceFolder', async ({ page }) => {
    await bootstrap(page);
    const clash = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC[0];
    }, makeXml('Clash1'));
    expect(clash.sourceFile).toBe('03_GAS_v_08_AMHS.xml');
    expect(clash.sourceFilePath).toBe('Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml');
    expect(clash.sourceFolder).toBe('260601 FAB AMHS v 7 Clash test');
  });

  test('parser 2 (bparse) — 3-segment Exyte path stamps archive folder as sourceFolder', async ({ page }) => {
    await bootstrap(page);
    const clash = await page.evaluate((xml) => {
      _bcfFileNames = ['Exyte AAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['Clash Tests/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC[0];
    }, makeXml('Clash1'));
    expect(clash.sourceFile).toBe('Exyte AAS_v_08_AMHS.xml');
    expect(clash.sourceFilePath).toBe('Clash Tests/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml');
    expect(clash.sourceFolder).toBe('260629 FAB Exyte v AMHS Clash test');
  });

  test('parser 1 (batchParse) — mixed batch: AMHS 4-seg + Exyte 3-seg from same picked root, both attribute correctly', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async ({ xmlA, xmlB }) => {
      _batchResults = {
        '03_GAS_v_08_AMHS.xml': xmlA,
        'Exyte AAS_v_08_AMHS.xml': xmlB,
      };
      _batchFilePaths = {
        '03_GAS_v_08_AMHS.xml': 'Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
        'Exyte AAS_v_08_AMHS.xml': 'Clash Tests/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml',
      };
      const filesFake = [
        { name: '03_GAS_v_08_AMHS.xml', lastModified: 0 },
        { name: 'Exyte AAS_v_08_AMHS.xml', lastModified: 0 },
      ];
      batchParse(filesFake, [], 2);
      return _bcfC.map(c => ({
        nwName: c.nwName,
        sourceFile: c.sourceFile,
        sourceFilePath: c.sourceFilePath,
        sourceFolder: c.sourceFolder,
      }));
    }, { xmlA: makeXml('ClashAMHS'), xmlB: makeXml('ClashExyte') });

    expect(result).toHaveLength(2);
    const byName = Object.fromEntries(result.map(r => [r.nwName, r]));
    expect(byName.ClashAMHS.sourceFolder).toBe('260601 FAB AMHS v 7 Clash test');
    expect(byName.ClashAMHS.sourceFile).toBe('03_GAS_v_08_AMHS.xml');
    expect(byName.ClashExyte.sourceFolder).toBe('260629 FAB Exyte v AMHS Clash test');
    expect(byName.ClashExyte.sourceFile).toBe('Exyte AAS_v_08_AMHS.xml');
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

  test('importToRegister — canonical path persists archive folder on the register clash', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'];
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
    expect(state[0].sourceFolder).toBe('260601 FAB AMHS v 7 Clash test');
    expect(state[0].sourceFilePath).toBe('Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml');
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

  test('importToRegister — post-import console log summary lists unique archive folders', async ({ page }) => {
    await bootstrap(page);
    // Capture only [Batch import] lines to avoid noise from other console.log calls.
    const logs = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().startsWith('[Batch import]')) {
        logs.push(msg.text());
      }
    });
    await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'];
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
    }, makeXml('Clash1'));
    // The console listener above is async — give it a tick to settle.
    await page.waitForTimeout(50);
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[0]).toBe('[Batch import] 1 clashes added');
    expect(logs[1]).toContain('Unique archive folders captured:');
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
