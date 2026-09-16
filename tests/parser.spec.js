import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// clashresult/clashgroup fragment builder. `kind` controls the child shape:
//   'result'  — plain <clashresult>, geometry as direct children.
//   'wrapped' — <clashgroup> wrapping a nested <clashresult> (the pre-
//               existing Navisworks "Group Selected" export shape).
//   'leaf'    — <clashgroup> with geometry as DIRECT children, no nested
//               clashresult/clashgroup (the new W37 CHEM/WWT shape).
function clashFrag(kind, name, itemA, itemB, opts = {}) {
  const geom = `
        <clashpoint><pos3f x="${opts.x ?? 10}" y="${opts.y ?? 20}" z="${opts.z ?? 30}"/></clashpoint>
        <resultstatus>${opts.status || 'active'}</resultstatus>
        ${opts.approvedDate ? `<approveddate>${opts.approvedDate}</approveddate>` : ''}
        ${opts.approvedBy ? `<approvedby>${opts.approvedBy}</approvedby>` : ''}
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>A.nwc</node></pathlink>
          <smarttag><name>Item Name</name><value>${itemA}</value></smarttag>
          <objectattribute><name>Element ID</name><value>EID-${itemA}</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>B.nwc</node></pathlink>
          <smarttag><name>Item Name</name><value>${itemB}</value></smarttag>
          <objectattribute><name>Element ID</name><value>EID-${itemB}</value></objectattribute>
        </clashobject>`;
  if (kind === 'result') {
    return `<clashresult name="${name}" distance="-0.02">${geom}</clashresult>`;
  }
  if (kind === 'leaf') {
    return `<clashgroup name="${name}" distance="-0.03">${geom}</clashgroup>`;
  }
  if (kind === 'wrapped') {
    return `<clashgroup name="${name}-Group"><clashresult name="${name}" distance="-0.02">${geom}</clashresult></clashgroup>`;
  }
  throw new Error('unknown kind ' + kind);
}

// Mixed-shape clashtest: a plain clashresult, an old-style wrapped group, a
// new-style leaf clashgroup, and a composite/container group wrapping two
// more leaf clashgroups — reproducing the W37 CHEM/WWT file where old- and
// new-style tests coexist in one export.
function makeMixedXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Mixed Format Test">
      ${clashFrag('result', 'Clash1', 'Duct-1', 'Beam-1')}
      ${clashFrag('wrapped', 'Clash2', 'Duct-2', 'Beam-2')}
      ${clashFrag('leaf', 'LeafGroup3', 'Duct-3', 'Beam-3')}
      <clashgroup name="Composite">
        ${clashFrag('leaf', 'Sub4', 'Duct-4', 'Beam-4')}
        ${clashFrag('leaf', 'Sub5', 'Duct-5', 'Beam-5')}
      </clashgroup>
    </clashtest>
  </batchtest>
</exchange>`;
}

// Pure W37-style file: clashresult wrapper dropped entirely, every clash is
// a flat leaf clashgroup.
function makeLeafOnlyXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] CHEM vs WWT">
      ${clashFrag('leaf', 'G1', 'Pipe-1', 'Duct-1', { approvedDate: '2026-07-15T10:00:00', approvedBy: 'J. Doe' })}
      ${clashFrag('leaf', 'G2', 'Pipe-2', 'Duct-2')}
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page, view = 'bcf') {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate((v) => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    S.clashes = [];
    sv('clashes', S.clashes);
    nav(v);
  }, view);
}

test.describe('PARSER-IMPROVEMENTS', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrap(page);
  });

  test('_pxLeafClashEls: mixed clashresult / wrapped-group / leaf-group / composite-group batch yields exactly the 5 real clashes, no duplicates, no containers', async ({ page }) => {
    const names = await page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const batch = doc.querySelector('clashtest');
      return _pxLeafClashEls(batch).map(el => el.getAttribute('name'));
    }, makeMixedXml());
    expect(names.sort()).toEqual(['Clash1', 'Clash2', 'LeafGroup3', 'Sub4', 'Sub5'].sort());
  });

  test('batchParse: leaf clashgroup (W37, no clashresult wrapper) extracts real geometry, not Unknown — parser 1', async ({ page }) => {
    const rows = await page.evaluate((xml) => {
      _batchResults = { '260901 CHEM.xml': xml };
      _batchFilePaths = { '260901 CHEM.xml': 'week-260901/260901 CHEM.xml' };
      batchParse([{ name: '260901 CHEM.xml', lastModified: 0 }], [], 1);
      return _bcfC.map(c => ({ nwName: c.nwName, itemA: c.eA.item, itemB: c.eB.item, exporter: c.exporter, approvedDate: c.approvedDate, approvedBy: c.approvedBy }));
    }, makeLeafOnlyXml());

    expect(rows).toHaveLength(2);
    const byName = Object.fromEntries(rows.map(r => [r.nwName, r]));
    expect(byName.G1.itemA).toBe('Pipe-1');
    expect(byName.G1.itemB).toBe('Duct-1');
    expect(byName.G2.itemA).toBe('Pipe-2');
    expect(byName.G2.itemB).toBe('Duct-2');
  });

  test('batchParse: mixed-format file (old wrapped groups + new leaf groups in the same test) parses all 5 real clashes with correct geometry', async ({ page }) => {
    const rows = await page.evaluate((xml) => {
      _batchResults = { 'mixed.xml': xml };
      _batchFilePaths = { 'mixed.xml': 'week-260901/mixed.xml' };
      batchParse([{ name: 'mixed.xml', lastModified: 0 }], [], 1);
      return _bcfC.map(c => ({ nwName: c.nwName, itemA: c.eA.item, itemB: c.eB.item }));
    }, makeMixedXml());

    expect(rows).toHaveLength(5);
    expect(rows.some(r => r.itemA === 'Unknown' || r.itemB === 'Unknown' || !r.itemA || !r.itemB)).toBe(false);
    const byName = Object.fromEntries(rows.map(r => [r.nwName, r]));
    expect(byName.Clash1).toEqual({ nwName: 'Clash1', itemA: 'Duct-1', itemB: 'Beam-1' });
    expect(byName.Clash2).toEqual({ nwName: 'Clash2', itemA: 'Duct-2', itemB: 'Beam-2' });
    expect(byName.LeafGroup3).toEqual({ nwName: 'LeafGroup3', itemA: 'Duct-3', itemB: 'Beam-3' });
    expect(byName.Sub4).toEqual({ nwName: 'Sub4', itemA: 'Duct-4', itemB: 'Beam-4' });
    expect(byName.Sub5).toEqual({ nwName: 'Sub5', itemA: 'Duct-5', itemB: 'Beam-5' });
  });

  test('bparse (parser 2): leaf clashgroup extracts real geometry — dual-parser regression', async ({ page }) => {
    const rows = await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC.map(c => ({ nwName: c.nwName, itemA: c.eA.item, itemB: c.eB.item }));
    }, makeLeafOnlyXml());

    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.itemA && r.itemA !== 'Unknown' && r.itemB && r.itemB !== 'Unknown')).toBe(true);
  });

  test('<approveddate>/<approvedby>: parsed onto the clash and survives into the register on import (both parsers)', async ({ page }) => {
    const afterBatch = await page.evaluate((xml) => {
      _batchResults = { 'approved.xml': xml };
      _batchFilePaths = { 'approved.xml': 'week-260901/approved.xml' };
      batchParse([{ name: 'approved.xml', lastModified: 0 }], [], 1);
      const parsed = _bcfC.find(c => c.nwName === 'G1');
      importToRegister('append');
      const reg = (S.clashes || []).find(c => c.nwOrig === 'G1');
      return {
        parsedApprovedDate: parsed && parsed.approvedDate,
        parsedApprovedBy: parsed && parsed.approvedBy,
        regApprovedDate: reg && reg.approvedDate,
        regApprovedBy: reg && reg.approvedBy,
        // G2 in the fixture carries no <approveddate>/<approvedby> — must
        // default to '', never undefined (schema-guard-style contract).
        regNoApproval: (S.clashes || []).find(c => c.nwOrig === 'G2'),
      };
    }, makeLeafOnlyXml());

    expect(afterBatch.parsedApprovedDate).toBe('2026-07-15T10:00:00');
    expect(afterBatch.parsedApprovedBy).toBe('J. Doe');
    expect(afterBatch.regApprovedDate).toBe('2026-07-15T10:00:00');
    expect(afterBatch.regApprovedBy).toBe('J. Doe');
    expect(afterBatch.regNoApproval.approvedDate).toBe('');
    expect(afterBatch.regNoApproval.approvedBy).toBe('');
  });

  test('exporter tag: inferred from filename for both parsers, "Unknown" when unrecognised', async ({ page }) => {
    const result = await page.evaluate((xml) => {
      const out = {};
      // batchParse — Muratec filename.
      _batchResults = { 'Muratec_260901_GAS.xml': xml };
      _batchFilePaths = { 'Muratec_260901_GAS.xml': 'week-260901/Muratec_260901_GAS.xml' };
      batchParse([{ name: 'Muratec_260901_GAS.xml', lastModified: 0 }], [], 1);
      out.batchMuratec = _bcfC[0].exporter;

      // batchParse — ESMC/Exyte filename.
      _batchResults = { 'ESMC_CM_v_08_AMHS.xml': xml };
      _batchFilePaths = { 'ESMC_CM_v_08_AMHS.xml': 'week-260901/ESMC_CM_v_08_AMHS.xml' };
      batchParse([{ name: 'ESMC_CM_v_08_AMHS.xml', lastModified: 0 }], [], 1);
      out.batchEsmc = _bcfC[0].exporter;

      // batchParse — unrecognised filename.
      _batchResults = { 'export_final_v3.xml': xml };
      _batchFilePaths = { 'export_final_v3.xml': 'week-260901/export_final_v3.xml' };
      batchParse([{ name: 'export_final_v3.xml', lastModified: 0 }], [], 1);
      out.batchUnknown = _bcfC[0].exporter;

      // bparse (parser 2) — Muratec filename via _bcfFileNames.
      _bcfFileNames = ['Muratec_export.xml'];
      _bcfFilePaths = ['week-260901/Muratec_export.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      out.pasteMuratec = _bcfC[0].exporter;

      return out;
    }, makeLeafOnlyXml());

    expect(result.batchMuratec).toBe('Muratec');
    expect(result.batchEsmc).toBe('Exyte');
    expect(result.batchUnknown).toBe('Unknown');
    expect(result.pasteMuratec).toBe('Muratec');
  });

  test('re-import refresh: a later export missing approveddate/exporter does not blank out values already learned', async ({ page }) => {
    const after = await page.evaluate((xml) => {
      // First import: Exyte export with approval data.
      _batchResults = { 'ESMC_first.xml': xml };
      _batchFilePaths = { 'ESMC_first.xml': 'week-260901/ESMC_first.xml' };
      batchParse([{ name: 'ESMC_first.xml', lastModified: 0 }], [], 1);
      importToRegister('append');

      // Re-import from an unrecognised/blank-approval filename — must not
      // clobber the previously-learned approvedDate/approvedBy/exporter.
      const xml2 = xml.replace('<approveddate>2026-07-15T10:00:00</approveddate>', '')
                       .replace('<approvedby>J. Doe</approvedby>', '');
      _batchResults = { 'reexport.xml': xml2 };
      _batchFilePaths = { 'reexport.xml': 'week-260908/reexport.xml' };
      batchParse([{ name: 'reexport.xml', lastModified: 0 }], [], 1);
      importToRegister('append');

      const reg = (S.clashes || []).find(c => c.nwOrig === 'G1');
      return { approvedDate: reg.approvedDate, approvedBy: reg.approvedBy, exporter: reg.exporter };
    }, makeLeafOnlyXml());

    expect(after.approvedDate).toBe('2026-07-15T10:00:00');
    expect(after.approvedBy).toBe('J. Doe');
    expect(after.exporter).toBe('Exyte');
  });
});
