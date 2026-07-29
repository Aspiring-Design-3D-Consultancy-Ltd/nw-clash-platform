import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A13-FOLDER-PICK-SUMMARY contract:
   importFolderPick counts webkitRelativePath matches of /CUP/i and
   /FAB/i on every picked file and shows a summary toast BEFORE any
   parsing runs. Both non-zero → normal (dark) toast, short duration.
   Either zero → warning (amber) toast, extended duration + a
   parenthetical hint about the likely cause + console.warn.

   Matches the failure mode a user hitting the pick dialog can
   silently walk into: they mean to pick the whole week wrapper
   (week-260727/…) but end up picking just one subfolder
   (260727 FAB AMHS v 7 Clash test/…) and get a plausible-looking
   import that's missing an entire building.

   Non-blocking: the pick still proceeds through the downstream
   validation gates. This is a warning, not a gate. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof importFolderPick === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    // Auto-accept downstream gates so importFolderPick doesn't stall
    // during the test — the summary toast fires early, before any of
    // the gates are reached.
    window.confirm = () => false;   // decline shape-warn / proceed dialog
    window.alert = () => {};
    window._skipCrossTestDupes = true;
  });
}

// Build a synthetic file with a webkitRelativePath — the FileList
// property is read-only on real inputs, so we synthesise a POJO shape
// importFolderPick treats identically.
function fakeInput(files) {
  return { files, value: 'ignored' };
}

// Kick importFolderPick and read the toast state it emitted.
async function pickAndReadToast(page, filesSpec) {
  return await page.evaluate(async (filesSpec) => {
    // Rebuild File objects with webkitRelativePath — importFolderPick
    // reads .webkitRelativePath and .name plus .files.length; a
    // constructed File plus Object.defineProperty covers all reads.
    const files = filesSpec.map(({name, relPath}) => {
      const f = new File([''], name, {type: 'text/xml'});
      Object.defineProperty(f, 'webkitRelativePath', {value: relPath, writable: false});
      Object.defineProperty(f, 'lastModified', {value: 0, writable: false});
      return f;
    });
    const inputEl = { files, value: 'ignored' };
    // Also stub _bifShowPickValidation and its siblings via confirm
    // to short-circuit the modal chain. The toast fires BEFORE any
    // of them so we can read state immediately.
    // Fire importFolderPick and don't await — the toast is added
    // synchronously right after the file-count block.
    importFolderPick(inputEl).catch(() => {});
    // Read the toast one microtask later so the DOM append settles.
    await new Promise(r => setTimeout(r, 0));
    const el = document.getElementById('pr-a13-pick-summary');
    if (!el) return null;
    return {
      text: el.textContent,
      warnFlag: el.getAttribute('data-warn'),
      // Extract background colour from inline style.
      color: (el.style && el.style.background) || '',
    };
  }, filesSpec);
}

test.describe('PR-A13-FOLDER-PICK-SUMMARY — pick-time CUP/FAB summary toast', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('both CUP and FAB present: normal (dark) toast, no warning marker', async ({ page }) => {
    const toast = await pickAndReadToast(page, [
      { name: '03_GAS.xml', relPath: 'week-260727/260727 CUP AMHS v 7 Clash test/03_GAS.xml' },
      { name: '04_ELE.xml', relPath: 'week-260727/260727 CUP Exyte v AMHS Clash test/04_ELE.xml' },
      { name: '03_GAS.xml', relPath: 'week-260727/260727 FAB AMHS v 7 Clash test/03_GAS.xml' },
      { name: '04_ELE.xml', relPath: 'week-260727/260727 FAB AMHS v 7 Clash test/04_ELE.xml' },
      { name: 'Exyte AAS.xml', relPath: 'week-260727/260727 FAB Exyte v AMHS Clash test/Exyte AAS.xml' },
    ]);
    expect(toast).not.toBeNull();
    expect(toast.warnFlag).toBe('0');
    // Non-warning colour (dark navy).
    expect(toast.color.toLowerCase().replace(/\s+/g, '')).toContain('rgb(15,24,36)');
    // Text carries both counts + total.
    expect(toast.text).toMatch(/CUP:\s*2/);
    expect(toast.text).toMatch(/FAB:\s*3/);
    expect(toast.text).toMatch(/Picked:\s*5\s*files?/i);
    expect(toast.text).not.toMatch(/⚠/);
  });

  test('only FAB files picked: warning (amber) toast with CUP=0', async ({ page }) => {
    const toast = await pickAndReadToast(page, [
      { name: '03_GAS.xml', relPath: 'week-260727/260727 FAB AMHS v 7 Clash test/03_GAS.xml' },
      { name: '04_ELE.xml', relPath: 'week-260727/260727 FAB AMHS v 7 Clash test/04_ELE.xml' },
    ]);
    expect(toast).not.toBeNull();
    expect(toast.warnFlag).toBe('1');
    // Amber colour — matches PR-A5-CROSSTEST-STRICT's Keep-all button
    // palette (#B45309) so warning toasts share visual vocabulary.
    expect(toast.color.toLowerCase().replace(/\s+/g, '')).toContain('rgb(180,83,9)');
    // Text carries warning marker + hint about the likely cause.
    expect(toast.text).toMatch(/⚠/);
    expect(toast.text).toMatch(/CUP:\s*0/);
    expect(toast.text).toMatch(/FAB:\s*2/);
    expect(toast.text.toLowerCase()).toContain('no cup files detected');
  });

  test('only CUP files picked: warning (amber) toast with FAB=0', async ({ page }) => {
    const toast = await pickAndReadToast(page, [
      { name: '03_GAS.xml', relPath: 'week-260727/260727 CUP AMHS v 7 Clash test/03_GAS.xml' },
    ]);
    expect(toast).not.toBeNull();
    expect(toast.warnFlag).toBe('1');
    expect(toast.color.toLowerCase().replace(/\s+/g, '')).toContain('rgb(180,83,9)');
    expect(toast.text).toMatch(/⚠/);
    expect(toast.text).toMatch(/CUP:\s*1/);
    expect(toast.text).toMatch(/FAB:\s*0/);
    expect(toast.text.toLowerCase()).toContain('no fab files detected');
  });

  test('neither CUP nor FAB present: still warns clearly ("wrong folder?")', async ({ page }) => {
    const toast = await pickAndReadToast(page, [
      { name: 'stray.xml', relPath: 'other-project/misc/stray.xml' },
    ]);
    expect(toast).not.toBeNull();
    expect(toast.warnFlag).toBe('1');
    expect(toast.text).toMatch(/CUP:\s*0/);
    expect(toast.text).toMatch(/FAB:\s*0/);
    expect(toast.text.toLowerCase()).toContain('wrong folder');
  });

  test('non-blocking: toast appears synchronously and does NOT gate the pick', async ({ page }) => {
    // Confirm the toast lands as a DOM element within a microtask of
    // importFolderPick being invoked. That the downstream gate might
    // reject the pick (e.g. shape-warn declined via window.confirm =>
    // false in bootstrap) does not prevent the summary toast from
    // firing — it's the first thing importFolderPick does after
    // reading the file list.
    const toast = await pickAndReadToast(page, [
      { name: '03_GAS.xml', relPath: 'week-260727/260727 CUP AMHS/03_GAS.xml' },
      { name: '04_ELE.xml', relPath: 'week-260727/260727 FAB AMHS/04_ELE.xml' },
    ]);
    expect(toast).not.toBeNull();
    // Text confirms both counts recorded even though the shape/confirm
    // gate downstream might have refused to proceed.
    expect(toast.text).toMatch(/CUP:\s*1/);
    expect(toast.text).toMatch(/FAB:\s*1/);
  });
});
