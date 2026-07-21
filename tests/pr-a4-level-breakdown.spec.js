import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A4-LEVEL-BREAKDOWN contract:
   exportReport (PDF) and exportPPTX (PPT) both include a Level
   Breakdown section grouped by building × normalised level.
   _normaliseLevel collapses:
     - CUP_L30_NN → CUP_L30 (spurious _NN parser noise from Muratec)
     - CUB_* → CUP_* (legacy partner prefix)
   Empty-level clashes bucket as "Unassigned" under the building
   derived from clashBuildingGroup (test-name / source metadata).

   Fixture:
     - 8 clashes on FAB_L40
     - 3 clashes on FAB_B1
     - 2 clashes on CUP_L30_13 (should render as CUP_L30)
     - 1 clash  on CUB_L30     (should render as CUP_L30 — merged)
     - 1 clash  on CUP_L30_99  (should render as CUP_L30 — merged)
     - 2 clashes with empty level, FAB testName (Unassigned → FAB)
     = 17 total
   Post-fix expectations:
     - FAB section:  L40 (8), B1 (3), Unassigned (2), subtotal 13
     - CUP section:  L30 (4 — merged from _13, _99, CUB), subtotal 4
     - Grand total:  17
     - Raw strings 'CUP_L30_13', 'CUP_L30_99', 'CUB_L30' absent
       from any rendered output.

   Test-the-test: on origin/main these tests fail because
   buildLevelBreakdown / _normaliseLevel don't exist yet
   (waitForFunction times out). The structural assertions never
   run. */

async function seedFixture(page) {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';

    let uid = 0;
    const mk = (level, opts) => {
      opts = opts || {};
      const id = 'CLX-' + String(++uid).padStart(4, '0');
      // Give FAB-associated testName so empty-level clashes bucket
      // into FAB via clashBuildingGroup → _rawBuildingFromMeta.
      // Avoid embedding raw level strings in testName so the "no raw
      // CUP_L30_13 anywhere in HTML" assertion isn't defeated by the
      // Test Breakdown section rendering the test name literally.
      const testName = opts.testName || (level ? 'FAB_Exyte_ASSORTED_v_08_AMHS' : 'FAB_Exyte_CSA_v_08_AMHS');
      return {
        uid: id,
        name: id + ' — c',
        testName,
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'High',
        status: 'Active',
        level: level, // seed as-is; _normaliseLevel handles CUB_/CUP_L30_NN
        date: '07/07/26',
        x: 0, y: 0, z: 0,
        weekTag: 'week-260707', weekDate: '2026-07-07',
        firstSeenWeekTag: 'week-260707', firstSeenWeekDate: '2026-07-07',
        statusHistory: [{ week: 28, year: 2026, status: 'Active' }],
      };
    };

    const clashes = [];
    // 8 × FAB_L40
    for (let i = 0; i < 8; i++) clashes.push(mk('FAB_L40'));
    // 3 × FAB_B1
    for (let i = 0; i < 3; i++) clashes.push(mk('FAB_B1'));
    // 2 × CUP_L30_13  (should normalise to CUP_L30)
    for (let i = 0; i < 2; i++) clashes.push(mk('CUP_L30_13'));
    // 1 × CUB_L30    (should normalise to CUP_L30)
    clashes.push(mk('CUB_L30'));
    // 1 × CUP_L30_99 (should normalise to CUP_L30)
    clashes.push(mk('CUP_L30_99'));
    // 2 × empty level, FAB-bound via testName
    clashes.push(mk('', { testName: 'FAB_Exyte_CSA_v_08_AMHS' }));
    clashes.push(mk('', { testName: 'FAB_Exyte_SPM_v_08_AMHS' }));

    S.clashes = clashes;
    sv('clashes', S.clashes);

    // Minimal weekly seed so _platformWeeks() returns [W28/2026].
    S.weekly = [{
      week: 28, year: 2026, label: 'Wk 28 — 06 Jul 2026',
      new: 0, active: 17, reviewed: 0, approved: 0, resolved: 0,
      critical: 0, high: 17, medium: 0, low: 0,
      tests: [],
    }];
    sv('weekly', S.weekly);

    // Stub regen so the seeded state isn't rebucketed on export
    // entry — mirrors the PR-A3 spec discipline.
    window.regenWeeklyFromRegister = () => {};
    window.open = () => null;
  });
}

test.describe('PR-A4-LEVEL-BREAKDOWN — report + PPTX include normalised Level Breakdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined'
      && typeof exportReport === 'function'
      && typeof _normaliseLevel === 'function'
      && typeof buildLevelBreakdown === 'function');
    await seedFixture(page);
  });

  test('_normaliseLevel collapses CUP_L30_NN and CUB_ prefix correctly', async ({ page }) => {
    const out = await page.evaluate(() => ({
      cupSuffix13:  _normaliseLevel('CUP_L30_13'),
      cupSuffix99:  _normaliseLevel('CUP_L30_99'),
      cubL30:       _normaliseLevel('CUB_L30'),
      cubDashL30:   _normaliseLevel('CUB-L30'),
      fabL40:       _normaliseLevel('FAB_L40'),
      fabB1:        _normaliseLevel('FAB_B1'),
      emptyString:  _normaliseLevel(''),
      nullValue:    _normaliseLevel(null),
      unknown:      _normaliseLevel('SOMETHING_ELSE'),
    }));
    expect(out.cupSuffix13).toBe('CUP_L30');
    expect(out.cupSuffix99).toBe('CUP_L30');
    expect(out.cubL30).toBe('CUP_L30');
    expect(out.cubDashL30).toBe('CUP_L30');
    expect(out.fabL40).toBe('FAB_L40');
    expect(out.fabB1).toBe('FAB_B1');
    expect(out.emptyString).toBe('');
    expect(out.nullValue).toBeNull();
    expect(out.unknown).toBe('SOMETHING_ELSE');
  });

  test('buildLevelBreakdown groups fixture correctly (FAB L40+B1+Unassigned, CUP L30 merged, grand total 17)', async ({ page }) => {
    const lb = await page.evaluate(() => buildLevelBreakdown());
    // 2 buildings — FAB then CUP.
    expect(lb.buildings.length).toBe(2);
    expect(lb.buildings.map(b => b.name)).toEqual(['FAB', 'CUP']);

    const fab = lb.buildings.find(b => b.name === 'FAB');
    const cup = lb.buildings.find(b => b.name === 'CUP');
    expect(fab).toBeDefined();
    expect(cup).toBeDefined();

    // FAB: 2 level rows (L40, B1), Unassigned present, subtotal 13.
    expect(fab.levels.length).toBe(2);
    const fabLevels = Object.fromEntries(fab.levels.map(l => [l.level, l]));
    expect(fabLevels['FAB_L40']).toBeDefined();
    expect(fabLevels['FAB_L40'].active).toBe(8);
    expect(fabLevels['FAB_L40'].total).toBe(8);
    expect(fabLevels['FAB_B1']).toBeDefined();
    expect(fabLevels['FAB_B1'].active).toBe(3);
    expect(fabLevels['FAB_B1'].total).toBe(3);
    expect(fab.unassigned).toBeDefined();
    expect(fab.unassigned.total).toBe(2);
    expect(fab.unassigned.active).toBe(2);
    expect(fab.subtotal.total).toBe(13);

    // CUP: 1 level row (L30 with 4 total — merged from CUP_L30_13,
    // CUP_L30_99, and CUB_L30), subtotal 4, no Unassigned.
    expect(cup.levels.length).toBe(1);
    expect(cup.levels[0].level).toBe('CUP_L30');
    expect(cup.levels[0].total).toBe(4);
    expect(cup.levels[0].active).toBe(4);
    expect(cup.unassigned).toBeNull();
    expect(cup.subtotal.total).toBe(4);

    // Grand total 17.
    expect(lb.grandTotal.total).toBe(17);
    expect(lb.grandTotal.active).toBe(17);
  });

  test('exportReport HTML includes Level Breakdown section with normalised rows and no raw CUP_L30_NN / CUB_ text', async ({ page }) => {
    const html = await page.evaluate(async () => {
      const blobs = [];
      const origCreate = URL.createObjectURL;
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:mock'; };
      try { exportReport('pdf'); } catch (e) { console.warn('[PR-A4-TEST] exportReport threw:', e.message); }
      URL.createObjectURL = origCreate;
      const blob = blobs[0];
      return blob ? await blob.text() : null;
    });
    expect(html).not.toBeNull();

    // Section anchor.
    expect(html).toContain('Level Breakdown');
    // Raw pre-normalisation strings must be absent from the rendered
    // Level Breakdown table. (Test-name subtitle uses _shortTestLabel
    // so "CSA"/"SPM" pass through — assert only the raw level codes.)
    expect(html).not.toContain('CUP_L30_13');
    expect(html).not.toContain('CUP_L30_99');
    expect(html).not.toContain('CUB_L30');
    // Normalised levels present.
    expect(html).toContain('CUP_L30');
    expect(html).toContain('FAB_L40');
    expect(html).toContain('FAB_B1');
    // Grand total row.
    expect(html).toContain('GRAND TOTAL');
    expect(html).toContain('FAB subtotal');
    expect(html).toContain('CUP subtotal');
    expect(html).toContain('Unassigned');

    const stats = await page.evaluate((htmlSrc) => {
      const doc = new DOMParser().parseFromString(htmlSrc, 'text/html');
      const h2s = [...doc.querySelectorAll('h2')];
      const anchor = h2s.find(h => (h.textContent || '').trim() === 'Level Breakdown');
      if (!anchor) return { found: false };
      let sib = anchor.nextElementSibling;
      while (sib && sib.tagName !== 'TABLE') sib = sib.nextElementSibling;
      if (!sib) return { found: false };
      const rows = [...sib.querySelectorAll('tbody tr')];
      const parse = tr => {
        const cs = [...tr.querySelectorAll('td')];
        return {
          label: cs[0] ? cs[0].textContent.trim() : '',
          new: parseInt(cs[1] && cs[1].textContent, 10) || 0,
          active: parseInt(cs[2] && cs[2].textContent, 10) || 0,
          reviewed: parseInt(cs[3] && cs[3].textContent, 10) || 0,
          approved: parseInt(cs[4] && cs[4].textContent, 10) || 0,
          resolved: parseInt(cs[5] && cs[5].textContent, 10) || 0,
          total: parseInt(cs[6] && cs[6].textContent, 10) || 0,
        };
      };
      const parsed = rows.map(parse);
      const findLvl = (name) => parsed.find(r => r.label === name);
      const findSub = (name) => parsed.find(r => r.label.indexOf(name + ' subtotal') === 0);
      const grand = parsed.find(r => r.label === 'GRAND TOTAL');
      const unassigned = parsed.find(r => r.label.indexOf('Unassigned') === 0);
      return {
        found: true,
        rowCount: rows.length,
        fabL40: findLvl('FAB_L40'),
        fabB1: findLvl('FAB_B1'),
        cupL30: findLvl('CUP_L30'),
        unassigned,
        fabSub: findSub('FAB'),
        cupSub: findSub('CUP'),
        grand,
      };
    }, html);
    expect(stats.found).toBe(true);
    // Cells (values match the fixture — Active only, no other statuses).
    expect(stats.fabL40).toBeDefined();
    expect(stats.fabL40.active).toBe(8);
    expect(stats.fabL40.total).toBe(8);
    expect(stats.fabB1).toBeDefined();
    expect(stats.fabB1.active).toBe(3);
    expect(stats.fabB1.total).toBe(3);
    expect(stats.cupL30).toBeDefined();
    expect(stats.cupL30.active).toBe(4);
    expect(stats.cupL30.total).toBe(4);
    expect(stats.unassigned).toBeDefined();
    expect(stats.unassigned.active).toBe(2);
    expect(stats.unassigned.total).toBe(2);
    expect(stats.fabSub).toBeDefined();
    expect(stats.fabSub.total).toBe(13);
    expect(stats.cupSub).toBeDefined();
    expect(stats.cupSub.total).toBe(4);
    expect(stats.grand).toBeDefined();
    expect(stats.grand.total).toBe(17);
    expect(stats.grand.active).toBe(17);
  });

  test('exportPPTX Level Breakdown slide receives normalised rows with no raw CUP_L30_NN / CUB_ text', async ({ page }) => {
    const captured = await page.evaluate(async () => {
      const tables = [];
      const slideStub = () => ({
        background: {},
        addText: () => {},
        addShape: () => {},
        addImage: () => {},
        addChart: () => {},
        addTable: (rows /*, opts*/) => { tables.push(rows); },
      });
      class StubPptx {
        constructor(){
          this.ShapeType = { rect: 'rect' };
          this.ChartType = { line: 'line', bar: 'bar', pie: 'pie', doughnut: 'doughnut', column: 'column' };
          this.layout = ''; this.author = ''; this.company = ''; this.title = ''; this.subject = '';
        }
        defineSlideMaster(){}
        addSlide(){ return slideStub(); }
        writeFile(){ return Promise.resolve(); }
      }
      window.PptxGenJS = StubPptx;
      window.confirm = () => true;
      window.alert = () => {};
      try { await exportPPTX(); } catch (e) { console.warn('[PR-A4-TEST] exportPPTX threw:', e.message); }
      return tables;
    });

    // Find the Level Breakdown table: 7-column header, contains a
    // "GRAND TOTAL" row.
    const lbTable = captured.find(t => {
      if (!t || !t.length) return false;
      const head = t[0];
      if (!head || head.length !== 7) return false;
      return t.some(row => (row[0] && String(row[0].text) === 'GRAND TOTAL'));
    });
    expect(lbTable).toBeDefined();

    // Assemble first-cell text array for structural checks.
    const cellText = (row, idx) => (row && row[idx] && row[idx].text != null) ? String(row[idx].text) : '';
    const firstCells = lbTable.map(row => cellText(row, 0));
    // Header row + 2 building headers + 2 FAB levels + 1 Unassigned +
    // 1 FAB subtotal + 1 CUP level + 1 CUP subtotal + 1 Grand total.
    expect(firstCells).toContain('Level'); // header
    expect(firstCells).toContain('FAB');
    expect(firstCells).toContain('CUP');
    expect(firstCells).toContain('FAB_L40');
    expect(firstCells).toContain('FAB_B1');
    expect(firstCells).toContain('CUP_L30');
    expect(firstCells).toContain('FAB subtotal');
    expect(firstCells).toContain('CUP subtotal');
    expect(firstCells).toContain('GRAND TOTAL');

    // Assert no raw CUP_L30_NN or CUB_ strings leaked into any cell.
    const allText = lbTable.flatMap(row => row.map(cell => cellText([cell], 0)));
    allText.forEach(t => {
      expect(t).not.toMatch(/CUP_L30_1\d/);
      expect(t).not.toMatch(/CUP_L30_9\d/);
      expect(t).not.toMatch(/^CUB[_-]/);
    });

    // Grand total row: last row, first cell 'GRAND TOTAL', last cell
    // total = 17.
    const grand = lbTable.find(row => cellText(row, 0) === 'GRAND TOTAL');
    expect(grand).toBeDefined();
    expect(cellText(grand, 6)).toBe('17');
    // Active column = 17 (position 2).
    expect(cellText(grand, 2)).toBe('17');

    // CUP_L30 row: total 4, active 4.
    const cupL30 = lbTable.find(row => cellText(row, 0) === 'CUP_L30');
    expect(cupL30).toBeDefined();
    expect(cellText(cupL30, 2)).toBe('4');
    expect(cellText(cupL30, 6)).toBe('4');

    // FAB Unassigned row.
    const una = lbTable.find(row => (cellText(row, 0)).indexOf('Unassigned') === 0);
    expect(una).toBeDefined();
    expect(cellText(una, 2)).toBe('2');
    expect(cellText(una, 6)).toBe('2');
  });
});
