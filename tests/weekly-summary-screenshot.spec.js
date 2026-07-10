import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

function makeXml({ testName, clashes }) {
  const items = clashes.map((c, i) => {
    const nameNum = parseInt(String(c.name).match(/\d+/)?.[0] || '0', 10) || 0;
    const x = 1000 + nameNum * 50;
    const y = 1000 + nameNum * 50;
    const z = 1000 + nameNum * 50;
    const date = c.date || { y: 2026, m: 6, d: 8 };
    return `<clashresult name="${c.name}" href="files\\cd0000${String(i + 1).padStart(2, '0')}.jpg" distance="-0.02">
        <clashpoint><pos3f x="${x}" y="${y}" z="${z}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="${date.y}" month="${date.m}" day="${date.d}" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>GAS.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-A-${testName}-${c.name}</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structure.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-B-${testName}-${c.name}</value></objectattribute>
        </clashobject>
      </clashresult>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm"><batchtest units="mm"><clashtest name="${testName}">${items}</clashtest></batchtest></exchange>`;
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
    nav('bcf');
  });
}

async function importWeek(page, { weekTag, archives }) {
  return await page.evaluate(async ({ weekTag, archives }) => {
    _batchResults = {};
    _batchFilePaths = {};
    _bcfFileNames = [];
    const filesFake = [];
    archives.forEach((a) => {
      const filePath = `${weekTag}/${a.archiveFolder}/${a.fileName}`;
      _batchResults[a.fileName] = a.xml;
      _batchFilePaths[a.fileName] = filePath;
      _bcfFileNames.push(a.fileName);
      filesFake.push({ name: a.fileName, lastModified: 0 });
    });
    batchParse(filesFake, [], archives.length);
    window._skipCrossTestDupes = true;
    if (!Array.isArray(S.weekly) || !S.weekly.length) {
      const today = new Date();
      S.weekly = [{
        label: 'Wk ' + isoWeekNum(today),
        date: today.toISOString().slice(0, 10),
        week: isoWeekNum(today), year: isoWeekYear(today),
        imports: [],
      }];
    }
    window.nav = () => {};
    importToRegister('append');
    return true;
  }, { weekTag, archives });
}

test('capture: WEEKLY-IMPORT-SUMMARY modal on a real two-week import (week-260608 after week-260601)', async ({ page }) => {
  await bootstrap(page);

  // Seed week 1 quietly (no modal capture — this is history).
  await importWeek(page, {
    weekTag: 'week-260601',
    archives: [
      {
        archiveFolder: '260601 FAB AMHS v 7 Clash test', fileName: '03_GAS_v_08_AMHS.xml',
        xml: makeXml({
          testName: '03_GAS_v_08_AMHS',
          clashes: [
            { name: 'C1', date: { y: 2026, m: 6, d: 1 } },
            { name: 'C2', date: { y: 2026, m: 6, d: 1 } },
            { name: 'C3', date: { y: 2026, m: 6, d: 1 } },
          ],
        }),
      },
      {
        archiveFolder: '260601 FAB AMHS v 7 Clash test', fileName: '04_CHEM_v_08_AMHS.xml',
        xml: makeXml({
          testName: '04_CHEM_v_08_AMHS',
          clashes: [
            { name: 'C1', date: { y: 2026, m: 6, d: 1 } },
            { name: 'C2', date: { y: 2026, m: 6, d: 1 } },
          ],
        }),
      },
      {
        archiveFolder: '260601 CUP Exyte v AMHS Clash test', fileName: 'Exyte AAS_v_08_AMHS.xml',
        xml: makeXml({
          testName: 'Exyte AAS_v_08_AMHS',
          clashes: [
            { name: 'C1', date: { y: 2026, m: 6, d: 1 } },
          ],
        }),
      },
    ],
  });
  // Dismiss the week-1 summary modal — we want to capture the week-2 one.
  await page.evaluate(() => {
    const el = document.getElementById('weekly-import-summary');
    if (el) el.remove();
  });

  // Import week 2 — new / persisting / disappeared all present.
  await importWeek(page, {
    weekTag: 'week-260608',
    archives: [
      {
        archiveFolder: '260608 FAB AMHS v 7 Clash test', fileName: '03_GAS_v_08_AMHS.xml',
        xml: makeXml({
          testName: '03_GAS_v_08_AMHS',
          clashes: [
            { name: 'C2', date: { y: 2026, m: 6, d: 8 } },
            { name: 'C3', date: { y: 2026, m: 6, d: 8 } },
            { name: 'C4', date: { y: 2026, m: 6, d: 8 } },
            { name: 'C5', date: { y: 2026, m: 6, d: 8 } },
          ],
        }),
      },
      {
        archiveFolder: '260608 FAB AMHS v 7 Clash test', fileName: '04_CHEM_v_08_AMHS.xml',
        xml: makeXml({
          testName: '04_CHEM_v_08_AMHS',
          clashes: [
            { name: 'C2', date: { y: 2026, m: 6, d: 8 } },
            { name: 'C3', date: { y: 2026, m: 6, d: 8 } },
          ],
        }),
      },
      {
        archiveFolder: '260608 CUP Exyte v AMHS Clash test', fileName: 'Exyte AAS_v_08_AMHS.xml',
        xml: makeXml({
          testName: 'Exyte AAS_v_08_AMHS',
          clashes: [
            { name: 'C1', date: { y: 2026, m: 6, d: 8 } },
            { name: 'C2', date: { y: 2026, m: 6, d: 8 } },
          ],
        }),
      },
    ],
  });

  // The modal is now attached — screenshot the whole viewport.
  await expect(page.locator('#weekly-import-summary')).toBeVisible();
  await page.screenshot({
    path: path.resolve(__dirname, '..', 'weekly-import-summary.png'),
    fullPage: false,
  });
});
