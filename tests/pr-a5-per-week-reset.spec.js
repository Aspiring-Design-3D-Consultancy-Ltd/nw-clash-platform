import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A5-WEEK-RESET contract:
   Data Manager previously offered only Settings → Clear All Data
   (wipes 2,562+ clashes). W31 incident needed a way to remove only
   the 14 partial clashes tagged week-260727 without touching the
   other 8 weeks — this panel provides that surgical reset.

   Fixture: register with clashes across 3 distinct weekTag values:
     week-260713 — 5 clashes
     week-260720 — 3 clashes
     week-260727 — 4 clashes
   Also: 2 untagged clashes (paste imports) — should NOT be touched
   by any weekTag reset.

   Reset week-260727 → assert only those 4 removed, other 10 intact,
   firstSeenWeekTag preserved on all remaining clashes, S.weekly
   entry for (2026, W30) removed. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof _rDataWeekResetPanel === 'function'
    && typeof _resetWeeklyBatch === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';

    let uid = 0;
    const mk = (weekTag, weekDate, weekNum, extra) => ({
      uid: 'CLX-' + String(++uid).padStart(4, '0'),
      name: 'CLX-' + String(uid).padStart(4, '0') + ' — c',
      testName: 'TestA',
      disciplineA: 'S', disciplineB: 'M',
      elementA: 'a', elementB: 'b',
      penetration: '10mm', priority: 'High',
      status: 'Active',
      date: '01/07/26',
      x: 0, y: 0, z: 0,
      weekTag, weekDate,
      firstSeenWeekTag: extra && extra.firstSeenTag ? extra.firstSeenTag : weekTag,
      firstSeenWeekDate: extra && extra.firstSeenDate ? extra.firstSeenDate : weekDate,
      statusHistory: [{ week: weekNum, year: 2026, status: 'Active' }],
    });
    S.clashes = [];
    // 5 × week-260713 (ISO Wk 29 2026 — Monday 13 Jul 2026)
    for (let i = 0; i < 5; i++) S.clashes.push(mk('week-260713', '2026-07-13', 29));
    // 3 × week-260720 (ISO Wk 30 2026 — Monday 20 Jul 2026)
    for (let i = 0; i < 3; i++) S.clashes.push(mk('week-260720', '2026-07-20', 30));
    // 4 × week-260727 (ISO Wk 31 2026 — Monday 27 Jul 2026)
    // Include one with different firstSeenWeekTag to verify preservation
    for (let i = 0; i < 4; i++) S.clashes.push(mk('week-260727', '2026-07-27', 31, i===0 ? { firstSeenTag: 'week-260713', firstSeenDate: '2026-07-13' } : null));
    // 2 untagged
    S.clashes.push({ uid:'CLX-9998', name:'CLX-9998 — u', testName:'TestB', disciplineA:'S', disciplineB:'M', elementA:'a', elementB:'b', penetration:'5mm', priority:'Low', status:'Active', date:'01/07/26', x:0,y:0,z:0, statusHistory:[{week:29,year:2026,status:'Active'}] });
    S.clashes.push({ uid:'CLX-9999', name:'CLX-9999 — u', testName:'TestB', disciplineA:'S', disciplineB:'M', elementA:'a', elementB:'b', penetration:'5mm', priority:'Low', status:'Active', date:'01/07/26', x:0,y:0,z:0, statusHistory:[{week:29,year:2026,status:'Active'}] });
    sv('clashes', S.clashes);

    S.weekly = [
      { week: 29, year: 2026, label: 'Wk 29', date: '13 Jul 2026', new: 0, active: 5, reviewed: 0, approved: 0, resolved: 0, critical: 0, high: 5, medium: 0, low: 0, tests: [] },
      { week: 30, year: 2026, label: 'Wk 30', date: '20 Jul 2026', new: 0, active: 3, reviewed: 0, approved: 0, resolved: 0, critical: 0, high: 3, medium: 0, low: 0, tests: [] },
      { week: 31, year: 2026, label: 'Wk 31', date: '27 Jul 2026', new: 0, active: 4, reviewed: 0, approved: 0, resolved: 0, critical: 0, high: 4, medium: 0, low: 0, tests: [] },
    ];
    sv('weekly', S.weekly);
  });
}

test.describe('PR-A5-WEEK-RESET — per-weekTag surgical reset', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('_rDataWeekResetPanel renders one row per distinct weekTag with correct counts', async ({ page }) => {
    const html = await page.evaluate(() => _rDataWeekResetPanel());
    expect(html).toContain('week-260713');
    expect(html).toContain('week-260720');
    expect(html).toContain('week-260727');
    expect(html).toContain('Reset this batch');
    expect(html).toContain('untagged');
    // Counts render with locale-formatted numbers, but "5", "3", "4" appear
    // as the tbody counts. Verify the tag+count adjacency indirectly by
    // rendering into a DOM and parsing rows.
    const rows = await page.evaluate(() => {
      const tmp = document.createElement('div');
      tmp.innerHTML = _rDataWeekResetPanel();
      const trs = [...tmp.querySelectorAll('tbody tr')];
      return trs.map(tr => {
        const cs = [...tr.querySelectorAll('td')];
        return {
          firstCell: cs[0] ? cs[0].textContent.trim().replace(/\s+/g,' ') : '',
          count: parseInt(cs[1] && cs[1].textContent, 10) || 0,
        };
      });
    });
    // Sorted asc: 260713, 260720, 260727, then untagged.
    const map = Object.fromEntries(rows.map(r => [r.firstCell.split(' ')[0], r.count]));
    expect(map['week-260713']).toBe(5);
    expect(map['week-260720']).toBe(3);
    expect(map['week-260727']).toBe(4);
    // Untagged row present with count 2.
    const untagged = rows.find(r => /untagged/i.test(r.firstCell));
    expect(untagged).toBeDefined();
    expect(untagged.count).toBe(2);
  });

  test('_resetWeeklyBatch removes only clashes with that weekTag; others intact; firstSeenWeekTag preserved', async ({ page }) => {
    const before = await page.evaluate(() => ({
      total: (S.clashes||[]).length,
      byTag: (S.clashes||[]).reduce((m,c)=>{const k=c.weekTag||'(untagged)';m[k]=(m[k]||0)+1;return m;},{}),
      weeklyCount: (S.weekly||[]).length,
      hasWk31: (S.weekly||[]).some(w => w.week===31 && (w.year||0)===2026),
      firstSeenPreserved: (S.clashes||[]).filter(c => c.weekTag==='week-260727' && c.firstSeenWeekTag==='week-260713').length,
    }));
    expect(before.total).toBe(14);
    expect(before.byTag['week-260727']).toBe(4);
    expect(before.hasWk31).toBe(true);
    expect(before.firstSeenPreserved).toBe(1);  // one clash carries different firstSeenWeekTag

    // Auto-confirm the reset.
    await page.evaluate(() => { window.confirm = () => true; window.alert = () => {}; });
    await page.evaluate(() => { _resetWeeklyBatch('week-260727'); });

    const after = await page.evaluate(() => ({
      total: (S.clashes||[]).length,
      byTag: (S.clashes||[]).reduce((m,c)=>{const k=c.weekTag||'(untagged)';m[k]=(m[k]||0)+1;return m;},{}),
      hasWk31: (S.weekly||[]).some(w => w.week===31 && (w.year||0)===2026),
      hasWk29: (S.weekly||[]).some(w => w.week===29 && (w.year||0)===2026),
      hasWk30: (S.weekly||[]).some(w => w.week===30 && (w.year||0)===2026),
      // Every remaining clash on week-260713 or week-260720 must still
      // carry its original firstSeenWeekTag — reset must not have
      // mutated per-clash history.
      firstSeenIntact: (S.clashes||[]).every(c => !c.weekTag || c.firstSeenWeekTag),
      untaggedCount: (S.clashes||[]).filter(c => !c.weekTag).length,
    }));
    // 14 − 4 = 10 remaining
    expect(after.total).toBe(10);
    expect(after.byTag['week-260727']).toBeUndefined();
    expect(after.byTag['week-260713']).toBe(5);
    expect(after.byTag['week-260720']).toBe(3);
    expect(after.byTag['(untagged)']).toBe(2);
    // S.weekly W31 removed; W29/W30 intact
    expect(after.hasWk31).toBe(false);
    expect(after.hasWk29).toBe(true);
    expect(after.hasWk30).toBe(true);
    expect(after.firstSeenIntact).toBe(true);
    expect(after.untaggedCount).toBe(2);
  });

  test('_resetWeeklyBatch declines to reset an unknown weekTag with alert', async ({ page }) => {
    const alerted = await page.evaluate(() => {
      const alerts = [];
      window.alert = (m) => alerts.push(String(m));
      window.confirm = () => true;
      _resetWeeklyBatch('week-999999');
      return { alerts, totalAfter: (S.clashes||[]).length };
    });
    expect(alerted.alerts.length).toBe(1);
    expect(alerted.alerts[0]).toMatch(/No clashes tagged/);
    expect(alerted.totalAfter).toBe(14);
  });

  test('_resetWeeklyBatch respects confirm cancellation (no state change)', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.confirm = () => false; window.alert = () => {};
      const before = (S.clashes||[]).length;
      _resetWeeklyBatch('week-260727');
      const after = (S.clashes||[]).length;
      return { before, after };
    });
    expect(result.before).toBe(14);
    expect(result.after).toBe(14);
  });
});
