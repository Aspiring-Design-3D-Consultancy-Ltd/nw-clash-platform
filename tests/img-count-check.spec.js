import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Build a Navisworks-shaped XML with N clashes where the first `withHref`
// carry an href attribute (viewpoint image reference) and the rest do not.
// The href value mirrors real archive files: "files\cd000001.jpg" — the
// parser strips the folder prefix into c.nwImageRef. idPrefix keeps element
// IDs unique across multi-file batches so PAIR-ID merge doesn't dedupe them.
function makeXml(clashCount, withHref, testName = '[H] Img Count Check Test A', idPrefix = 'A') {
  const items = [];
  for (let n = 1; n <= clashCount; n++) {
    const href = n <= withHref ? ` href="files\\cd${String(n).padStart(6,'0')}.jpg"` : '';
    items.push(`<clashresult name="Clash${n}"${href} distance="-0.02">
      <clashpoint><pos3f x="${100*n}" y="${200*n}" z="${300*n}"/></clashpoint>
      <resultstatus>active</resultstatus>
      <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
      <clashobject><pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-${idPrefix}-A-${n}</value></objectattribute></clashobject>
      <clashobject><pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-${idPrefix}-B-${n}</value></objectattribute></clashobject>
    </clashresult>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="${testName}">
      ${items.join('')}
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    S.clashes = [];
    const today = new Date();
    S.weekly = [{
      label: 'Wk ' + isoWeekNum(today),
      date: today.toISOString().slice(0,10),
      week: isoWeekNum(today),
      year: isoWeekYear(today),
      imports: [],
    }];
    sv('clashes', S.clashes);
    sv('weekly', S.weekly);
    nav('bcf');
  });
  await page.waitForSelector('#bxml');
}

async function parseXml(page, xml) {
  await page.evaluate((xml) => {
    document.getElementById('bxml').value = xml;
    bparse();
    window._skipCrossTestDupes = true;
  }, xml);
}

async function latestImportEntry(page) {
  return page.evaluate(() => {
    const allImports = (S.weekly || []).flatMap(w => (w.imports || []));
    return allImports.at(-1) || null;
  });
}

test.describe('IMG-COUNT-CHECK (href-based)', () => {
  test('50 clashes, 50 hrefs → import proceeds silently (no modal)', async ({ page }) => {
    await bootstrap(page);
    await parseXml(page, makeXml(50, 50));

    // Sanity: parser stamped nwImageRef on every clash from the href attribute.
    const parsed = await page.evaluate(() => ({
      count: _bcfC.length,
      withRef: _bcfC.filter(c => c.nwImageRef).length,
      firstRef: _bcfC[0]?.nwImageRef,
    }));
    expect(parsed.count).toBe(50);
    expect(parsed.withRef).toBe(50);
    expect(parsed.firstRef).toBe('cd000001.jpg');

    await page.evaluate(() => _importToRegisterChecked('append'));
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);

    const registerCount = await page.evaluate(() => (S.clashes || []).length);
    expect(registerCount).toBe(50);
    const entry = await latestImportEntry(page);
    expect(entry?.imageCountMismatch).toBeUndefined();
  });

  test('50 clashes, 48 hrefs (real archive shape) → modal fires with "2 of 50", Cancel discards, Continue merges', async ({ page }) => {
    // ── Sub-case A: Cancel discards the batch.
    await bootstrap(page);
    await parseXml(page, makeXml(50, 48));
    await page.evaluate(() => _importToRegisterChecked('append'));

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('2 of 50');
    await expect(modal).toContainText('no image reference (no viewpoint captured in Navisworks)');
    await expect(modal).toContainText('re-export with viewpoints');

    await page.locator('#img-count-check-cancel').click();
    await expect(modal).toHaveCount(0);

    const cancelState = await page.evaluate(() => ({
      registerCount: (S.clashes || []).length,
      parsedCount: _bcfC.length,
    }));
    expect(cancelState.registerCount).toBe(0);
    expect(cancelState.parsedCount).toBe(0);

    // ── Sub-case B: Continue merges + stamps the imports[] entry.
    await parseXml(page, makeXml(50, 48));
    await page.evaluate(() => _importToRegisterChecked('append'));
    await expect(page.locator('#img-count-check-modal')).toBeVisible();
    await page.locator('#img-count-check-continue').click();
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);

    const merged = await page.evaluate(() => (S.clashes || []).length);
    expect(merged).toBe(50);
    const entry = await latestImportEntry(page);
    expect(entry?.imageCountMismatch).toBe(true);
    expect(entry?.clashCount).toBe(50);
    expect(entry?.declaredImages).toBe(48);
    expect(entry?.missing).toBe(2);
  });

  test('50 clashes, 0 hrefs → modal fires with "50 of 50" and Continue works', async ({ page }) => {
    await bootstrap(page);
    await parseXml(page, makeXml(50, 0));
    await page.evaluate(() => _importToRegisterChecked('append'));

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('50 of 50');

    await page.locator('#img-count-check-continue').click();
    await expect(modal).toHaveCount(0);

    const entry = await latestImportEntry(page);
    expect(entry?.imageCountMismatch).toBe(true);
    expect(entry?.clashCount).toBe(50);
    expect(entry?.declaredImages).toBe(0);
    expect(entry?.missing).toBe(50);
  });

  test('empty XML (0 clashes) → no modal', async ({ page }) => {
    await bootstrap(page);
    // Zero clashresults → _bcfC stays empty → clashCount and declaredImages
    // both zero → missing zero → wrapper falls through to importToRegister,
    // which alerts "Parse XML first" — stub the alert to keep the test
    // headless-safe. The important assertion is that the modal did NOT open.
    await page.evaluate(() => {
      _bcfC = [];
      window.alert = () => {};
      _importToRegisterChecked('append');
    });
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);
    const registerCount = await page.evaluate(() => (S.clashes || []).length);
    expect(registerCount).toBe(0);
  });

  test('_bcfImgCount from a prior Load NWC Images run does NOT influence the check', async ({ page }) => {
    // Regression guard: PR #10 conflated the Load NWC Images counter with
    // this check and produced a false positive on every hrefless XML. The
    // href-based rebuild must ignore _bcfImgCount entirely — including
    // whatever value the separate Load NWC Images flow may have left set.
    await bootstrap(page);
    await parseXml(page, makeXml(50, 50));
    await page.evaluate(() => { _bcfImgCount = 3; });
    await page.evaluate(() => _importToRegisterChecked('append'));

    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);
    const merged = await page.evaluate(() => (S.clashes || []).length);
    expect(merged).toBe(50);
    // _bcfImgCount must be left alone by the wrapper (its lifecycle
    // belongs to loadNwImages, not this check).
    const bcfImgCountAfter = await page.evaluate(() => _bcfImgCount);
    expect(bcfImgCountAfter).toBe(3);
  });

  test('multi-file batch (A.xml 5/5, B.xml 10/8, C.xml 20/15) → modal breaks down "7 of 35" by file, imports[] carries missingByFile', async ({ page }) => {
    await bootstrap(page);

    // Parse each XML into _bcfC individually and stamp sourceFile per
    // the real batchParse behaviour (parser 1 sets sourceFile:fname; here
    // we simulate by parsing each XML through bparse then overwriting
    // sourceFile before concatenating). Unique idPrefix keeps element IDs
    // distinct so the merge doesn't collapse cross-file duplicates.
    const XML_A = makeXml(5, 5, '[H] Test A', 'A');
    const XML_B = makeXml(10, 8, '[H] Test B', 'B');
    const XML_C = makeXml(20, 15, '[H] Test C', 'C');

    await page.evaluate(({ a, b, c }) => {
      const capture = (xml, sf) => {
        _bcfFileNames = [sf];
        _bcfFilePaths = [sf]; // SOURCEFILE-FULLPATH: leaf == path when no dir picker
        document.getElementById('bxml').value = xml;
        bparse();
        return _bcfC.slice();
      };
      const partsA = capture(a, 'A.xml');
      const partsB = capture(b, 'B.xml');
      const partsC = capture(c, 'C.xml');
      _bcfC = [...partsA, ...partsB, ...partsC];
      window._skipCrossTestDupes = true;
      _importToRegisterChecked('append');
    }, { a: XML_A, b: XML_B, c: XML_C });

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    // Total mismatch: 5+8+15 = 28 declared, 35 - 28 = 7 missing.
    await expect(modal).toContainText('7 of 35');
    // Per-file breakdown: A had all 5 hrefs → not listed; B missing 2; C missing 5.
    await expect(modal).toContainText('C.xml');
    await expect(modal).toContainText('5 clashes');
    await expect(modal).toContainText('B.xml');
    await expect(modal).toContainText('2 clashes');
    await expect(modal.locator('text=A.xml')).toHaveCount(0);

    // Sort order: count desc — C.xml (5) should render above B.xml (2).
    const listText = await modal.locator('div').filter({ hasText: 'Missing viewpoints by file:' }).first().locator('..').textContent();
    const cIdx = listText.indexOf('C.xml');
    const bIdx = listText.indexOf('B.xml');
    expect(cIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(-1);
    expect(cIdx).toBeLessThan(bIdx);

    await page.locator('#img-count-check-continue').click();
    await expect(modal).toHaveCount(0);

    // Every per-file imports[] entry carries the FULL missingByFile map.
    const entries = await page.evaluate(() => {
      const all = (S.weekly || []).flatMap(w => (w.imports || []));
      return all.filter(e => e.imageCountMismatch === true);
    });
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.clashCount).toBe(35);
      expect(e.declaredImages).toBe(28);
      expect(e.missing).toBe(7);
      expect(e.missingByFile).toEqual({ 'B.xml': 2, 'C.xml': 5 });
    }
  });

  test('overflow: 25 unique source files → visible list capped at 20 with "…and 5 more files" tail', async ({ page }) => {
    await bootstrap(page);
    // Seed 25 hrefless clashes across 25 unique sourceFiles.
    await page.evaluate(() => {
      _bcfC = Array.from({ length: 25 }, (_, i) => ({
        idx: i + 1,
        tn: '[H] Overflow Test',
        nwName: 'Clash' + (i + 1),
        nwCreated: '15/07/26',
        sourceFile: 'file-' + String(i + 1).padStart(2, '0') + '.xml',
        nwImageRef: '',
        x: 100, y: 200, z: 300, depMm: 20,
        eA: { id: 'EID-OA-' + (i + 1), source: 'S.nwc', item: 'B' + i, layer: '' },
        eB: { id: 'EID-OB-' + (i + 1), source: 'M.nwc', item: 'D' + i, layer: '' },
        dA: 'Structural', dB: 'MEP', pri: 'High', mappedSt: 'Active',
      }));
      window._skipCrossTestDupes = true;
      _importToRegisterChecked('append');
    });

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('25 of 25');
    await expect(modal).toContainText('…and 5 more files');
    // The full unfiltered map still lands on imports[] after Continue.
    await page.locator('#img-count-check-continue').click();
    const entry = await latestImportEntry(page);
    expect(entry?.missingByFile && Object.keys(entry.missingByFile).length).toBe(25);
  });

  test('SOURCEFILE-PROPAGATE — bparse threads _bcfFileNames[0] onto c.sourceFile so per-file breakdown shows real XML names, not "pasted"', async ({ page }) => {
    // Simulates importFolderPick's per-file loop: for each XML the driver
    // sets _bcfFileNames=[xmlFile.name] and then calls bparse(). Without
    // the SOURCEFILE-PROPAGATE fix, every clash was stamped 'pasted' and
    // the per-file breakdown collapsed into a single "pasted — N clashes"
    // row (the 82-file production report).
    await bootstrap(page);

    const XML_A = makeXml(5, 3, '[H] Real Test A', 'A');   // 5 clashes, 3 hrefs → 2 missing
    const XML_B = makeXml(10, 6, '[H] Real Test B', 'B');  // 10 clashes, 6 hrefs → 4 missing

    await page.evaluate(({ a, b }) => {
      const parseFile = (xml, filename) => {
        _bcfFileNames = [filename];
        document.getElementById('bxml').value = xml;
        bparse();
        return _bcfC.slice();
      };
      const partsA = parseFile(a, 'Exyte_CSA_v_08_AMHS.xml');
      const partsB = parseFile(b, '04_CHEM_v_08_AHMS.xml');
      _bcfC = [...partsA, ...partsB];
      window._skipCrossTestDupes = true;
      _importToRegisterChecked('append');
    }, { a: XML_A, b: XML_B });

    // Sanity: parser stamped the real filenames from _bcfFileNames.
    const parsedSourceFiles = await page.evaluate(() =>
      [...new Set(_bcfC.map(c => c.sourceFile))].sort()
    );
    expect(parsedSourceFiles).toEqual(['04_CHEM_v_08_AHMS.xml', 'Exyte_CSA_v_08_AMHS.xml']);
    // The old bug would have produced ['pasted'] here.
    expect(parsedSourceFiles).not.toContain('pasted');

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    // Total: 15 clashes, 9 declared → 6 missing.
    await expect(modal).toContainText('6 of 15');
    // Per-file rows carry the real names.
    await expect(modal).toContainText('Exyte_CSA_v_08_AMHS.xml');
    await expect(modal).toContainText('04_CHEM_v_08_AHMS.xml');
    // Explicit negative: the 'pasted' sentinel must NOT appear in the
    // rendered breakdown (that's the exact production regression this
    // marker exists to prevent).
    await expect(modal.locator('text=pasted —')).toHaveCount(0);

    await page.locator('#img-count-check-continue').click();
    const entry = await latestImportEntry(page);
    expect(entry?.missingByFile).toEqual({
      'Exyte_CSA_v_08_AMHS.xml': 2,
      '04_CHEM_v_08_AHMS.xml': 4,
    });
  });

  test('SOURCEFILE-PROPAGATE — pure paste (no file picked, _bcfFileNames empty) still falls back to "pasted"', async ({ page }) => {
    await bootstrap(page);
    // Reset _bcfFileNames the way the app is on first launch — no file has
    // ever been picked. Then invoke bparse directly (paste-only path).
    await page.evaluate(() => {
      _bcfFileNames = [];
      document.getElementById('bxml').value = ''; // clear any prior test's textarea
    });
    await parseXml(page, makeXml(3, 3, '[H] Paste Only', 'P'));
    const sourceFiles = await page.evaluate(() =>
      [...new Set(_bcfC.map(c => c.sourceFile))]
    );
    expect(sourceFiles).toEqual(['pasted']);
  });

  test('SOURCEFILE-FULLPATH — same-named files at different paths disambiguate in the modal + imports[]', async ({ page }) => {
    // Simulates the archived weekly-folder layout the production user hit:
    //   Clash Tests/weekA/test.xml
    //   Clash Tests/weekB/test.xml
    //   Clash Tests/weekC/test.xml
    // All three files share the leaf name "test.xml" but sit at distinct
    // webkitRelativePaths. Pre-fix behaviour collapsed them into a single
    // "test.xml — N clashes" row; this asserts the modal now shows the
    // path-scoped rows.
    await bootstrap(page);

    const XML_A = makeXml(5, 3, '[H] Week A', 'A');   // 5 clashes, 3 hrefs → 2 missing
    const XML_B = makeXml(5, 4, '[H] Week B', 'B');   // 5 clashes, 4 hrefs → 1 missing
    const XML_C = makeXml(5, 5, '[H] Week C', 'C');   // 5 clashes, 5 hrefs → 0 missing (fully covered)

    await page.evaluate(({ a, b, c }) => {
      const parseFile = (xml, filename, path) => {
        _bcfFileNames = [filename];
        _bcfFilePaths = [path];
        document.getElementById('bxml').value = xml;
        bparse();
        return _bcfC.slice();
      };
      const partsA = parseFile(a, 'test.xml', 'weekA/test.xml');
      const partsB = parseFile(b, 'test.xml', 'weekB/test.xml');
      const partsC = parseFile(c, 'test.xml', 'weekC/test.xml');
      _bcfC = [...partsA, ...partsB, ...partsC];
      window._skipCrossTestDupes = true;
      _importToRegisterChecked('append');
    }, { a: XML_A, b: XML_B, c: XML_C });

    // Sanity: every parsed clash carries the correct sourceFilePath while
    // sourceFile stays at the leaf name (backwards-compat contract).
    const parsed = await page.evaluate(() => {
      const summary = {};
      _bcfC.forEach(c => {
        summary[c.sourceFilePath] = (summary[c.sourceFilePath] || 0) + 1;
      });
      return {
        summary,
        allLeaves: [...new Set(_bcfC.map(c => c.sourceFile))],
      };
    });
    expect(parsed.summary).toEqual({
      'weekA/test.xml': 5,
      'weekB/test.xml': 5,
      'weekC/test.xml': 5,
    });
    expect(parsed.allLeaves).toEqual(['test.xml']);

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    // Total: 15 clashes, 12 declared → 3 missing.
    await expect(modal).toContainText('3 of 15');
    // Path-scoped rows appear; weekC (fully covered) does NOT.
    await expect(modal).toContainText('weekA/test.xml');
    await expect(modal).toContainText('2 clashes');
    await expect(modal).toContainText('weekB/test.xml');
    await expect(modal).toContainText('1 clash');
    await expect(modal.locator('text=weekC/')).toHaveCount(0);

    await page.locator('#img-count-check-continue').click();
    const entry = await latestImportEntry(page);
    // Full unfiltered map on imports[] uses path keys, not leaf names.
    expect(entry?.missingByFile).toEqual({
      'weekA/test.xml': 2,
      'weekB/test.xml': 1,
    });
    // Explicit negative: no leaf-only 'test.xml' key from the pre-fix
    // grouping should survive.
    expect(entry?.missingByFile).not.toHaveProperty('test.xml');
  });

  test('SOURCEFILE-FULLPATH-PERSIST — merge-copy carries sourceFile + sourceFilePath onto every S.clashes entry', async ({ page }) => {
    // Regression against production: a 40-clash folder-import landed
    // every register entry with sourceFilePath: undefined because the
    // importToRegister push at ~L7725 never copied it. This asserts both
    // fields survive the merge — the fully-covered case (no modal fires,
    // straight to importToRegister).
    await bootstrap(page);
    const XML = makeXml(5, 5, '[H] Persist Test', 'P');
    await page.evaluate((xml) => {
      _bcfFileNames = ['ESMC_v_08_AMHS.xml'];
      _bcfFilePaths = ['260601 FAB AMHS v 7 Clash test/ESMC_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      _importToRegisterChecked('append');
    }, XML);
    const registered = await page.evaluate(() => (S.clashes || []).map(c => ({
      uid: c.uid,
      sourceFile: c.sourceFile,
      sourceFilePath: c.sourceFilePath,
    })));
    expect(registered.length).toBe(5);
    for (const c of registered) {
      expect(c.sourceFile).toBe('ESMC_v_08_AMHS.xml');
      expect(c.sourceFilePath).toBe('260601 FAB AMHS v 7 Clash test/ESMC_v_08_AMHS.xml');
    }
  });

  test('SOURCEFILE-FULLPATH-PERSIST — back-fill fills sourceFilePath from sourceFile on load for pre-fix registers', async ({ page }) => {
    // Seed a register whose clashes were merged before this fix shipped:
    // sourceFile set, sourceFilePath undefined. Then reload to trigger
    // the init-path back-fill.
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
      // Match the current DATA_VERSION so initAuth loads our seed instead
      // of the DC demo dataset (CLAUDE.md invariant — mirror, don't bump).
      localStorage.setItem('nw:dataVersion', JSON.stringify('v4-correct-dates-jan25'));
      const clashes = [
        // Pre-fix shape: sourceFile set, sourceFilePath missing.
        { uid: 'CLX-001', testName: 'T', nwOrig: 'C1', status: 'Active', sourceFile: 'legacy.xml' },
        { uid: 'CLX-002', testName: 'T', nwOrig: 'C2', status: 'Active' }, // truly ancient, no sourceFile either
      ];
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (S.clashes || []).some(c => c.uid === 'CLX-001'));

    const backfilled = await page.evaluate(() => S.clashes.map(c => ({
      uid: c.uid,
      sourceFile: c.sourceFile,
      sourceFilePath: c.sourceFilePath,
    })));
    // CLX-001 gets its sourceFilePath back-filled from sourceFile.
    expect(backfilled.find(c => c.uid === 'CLX-001').sourceFilePath).toBe('legacy.xml');
    // CLX-002 has neither — no field to back-fill from; sourceFilePath
    // stays undefined (won't cause the modal to break because
    // _importToRegisterChecked reads from _bcfC, not S.clashes).
    expect(backfilled.find(c => c.uid === 'CLX-002').sourceFilePath).toBeUndefined();
  });
});
