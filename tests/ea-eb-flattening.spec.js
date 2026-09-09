import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* EA-EB-FLATTENING test:
   Verify that baseLevel and gridHead properties on eA/eB elements survive
   the storage cycle (being stored to IndexedDB/localStorage and read back). */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof sv === 'function'
    && typeof lv === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    S.clashes = []; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
  });
}

test.describe('EA-EB-FLATTENING — baseLevel and gridHead preservation', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('eA/eB nested objects with baseLevel and gridHead are preserved', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Directly create a clash with the expected eA/eB structure
      // to verify that when stored and read back from storage, the properties survive
      const testClash = {
        uid: 'CLX-001',
        name: 'CLX-001 — TestClash',
        testName: 'TestStructure',
        nwOrig: 'Clash1',
        status: 'New',
        priority: 'High',
        elementA: 'Column A',
        elementIdA: 'REV-STR-001',
        elementB: 'Pipe Run B',
        elementIdB: 'CAD-MEP-042',
        sourceA: 'Revit',
        sourceB: 'AutoCAD',
        penetration: '5mm',
        x: 1, y: 2, z: 3,
        date: '15/09/26',
        weekTag: 'week-260915',
        weekDate: '2026-09-15',
        nwImageRef: '',
        sourceFile: 'test.xml',
        sourceFilePath: 'test.xml',
        sourceFolder: null,
        eA: {
          id: 'REV-STR-001',
          idSrc: 'Element ID',
          item: 'Column A',
          layer: 'Structural Frame',
          source: 'Revit',
          baseLevel: 'Level 3',
          gridHead: 'Grid A-1'
        },
        eB: {
          id: 'CAD-MEP-042',
          idSrc: 'Handle',
          item: 'Pipe Run B',
          layer: 'Mechanical',
          source: 'AutoCAD',
          baseLevel: 'Level 3',
          gridHead: 'Grid B-2'
        },
        statusHistory: [{week:1, year:2026, status:'New'}]
      };

      // Store the clash directly in S.clashes
      S.clashes = [testClash];
      sv('clashes', S.clashes);

      // Read back from storage
      await new Promise(r => setTimeout(r, 100));
      const retrieved = lv('clashes', []);
      const imported = (retrieved || [])[0];

      return {
        hadEA: !!testClash.eA,
        hasEA: !!imported?.eA,
        eAId: imported?.eA?.id,
        eABaseLevel: imported?.eA?.baseLevel,
        eAGridHead: imported?.eA?.gridHead,
        eALayer: imported?.eA?.layer,
        hasEB: !!imported?.eB,
        eBId: imported?.eB?.id,
        eBBaseLevel: imported?.eB?.baseLevel,
        eBGridHead: imported?.eB?.gridHead,
        eBLayer: imported?.eB?.layer
      };
    });

    // Verify original had eA
    expect(result.hadEA).toBe(true);

    // Verify eA object was preserved through storage round-trip
    expect(result.hasEA).toBe(true);
    expect(result.eAId).toBe('REV-STR-001');
    expect(result.eABaseLevel).toBe('Level 3');
    expect(result.eAGridHead).toBe('Grid A-1');
    expect(result.eALayer).toBe('Structural Frame');

    // Verify eB object was preserved through storage round-trip
    expect(result.hasEB).toBe(true);
    expect(result.eBId).toBe('CAD-MEP-042');
    expect(result.eBBaseLevel).toBe('Level 3');
    expect(result.eBGridHead).toBe('Grid B-2');
    expect(result.eBLayer).toBe('Mechanical');
  });
});
