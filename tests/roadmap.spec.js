import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:3107/api/roadmap';
const item = (patch = {}) => ({ id: 's1', title: 'API design', jiraUrl: null, track: 0, offset: 0, length: 4, ...patch });
const big = (patch = {}) => ({
  id: 'b1', title: 'Platform v2', color: '#1976d2', months: 3, rows: 2,
  placement: { start: '2026-11', row: 0 }, backlogOrder: null, smallBlocks: [], ...patch,
});
async function seed(request, blocks = []) {
  const doc = await (await request.get(api)).json();
  const response = await request.put(api, { data: { ...doc, settings: { startMonth: '2026-11', monthsVisible: 6 }, bigBlocks: blocks } });
  expect(response.ok()).toBeTruthy();
}
async function persisted(request) { return (await request.get(api)).json(); }
async function saved(page) { await expect(page.getByText('Saved', { exact: true })).toBeVisible(); }
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
async function cell(page, month, row, xOffset = 20, yOffset = 12) {
  const grid = await page.getByRole('main').boundingBox();
  const column = await page.locator('.month-label').first().boundingBox();
  return { x: grid.x + month * column.width + xOffset, y: grid.y + 48 + row * 64 + yOffset };
}
async function center(locator) {
  const rect = await locator.boundingBox();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
test.beforeEach(async ({ request }) => { await seed(request); });

test('creates and renames a backlog block, adds backlog items, grows, and persists across reload', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Big block', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Launch');
  await page.getByRole('textbox', { name: 'Title', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Expand items: Launch' }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Prepare');
  await page.getByRole('textbox', { name: 'Title', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Deliver');
  await page.getByRole('textbox', { name: 'Title', exact: true }).press('Enter');
  await saved(page);
  expect((await persisted(request)).bigBlocks[0]).toMatchObject({ title: 'Launch', rows: 2, smallBlocks: [{ title: 'Prepare' }, { title: 'Deliver' }] });
  await page.reload();
  await expect(page.getByText('Launch', { exact: true })).toBeVisible();
});

test('schedules a backlog card with its stored shape and moves it to the backlog and trash with undo', async ({ page, request }) => {
  await seed(request, [big({ placement: null, backlogOrder: 0, months: 2, smallBlocks: [item()] })]);
  await page.goto('/');
  const card = page.locator('[data-backlog-id="b1"] .backlog-card-title');
  await drag(page, await center(card), await cell(page, 1, 1));
  await expect(page.locator('[data-big-id="b1"]')).toBeVisible();
  await saved(page);
  expect((await persisted(request)).bigBlocks[0]).toMatchObject({ months: 2, rows: 2, placement: { start: '2026-12', row: 1 }, smallBlocks: [{ id: 's1' }] });
  await drag(page, await center(page.locator('.big-header')), { x: 90, y: 180 });
  await expect(page.locator('[data-backlog-id="b1"]')).toBeVisible();
  await drag(page, await center(card), await center(page.getByRole('region', { name: 'Trash drop zone' })));
  await expect(page.locator('[data-backlog-id="b1"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-backlog-id="b1"]')).toBeVisible();
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].smallBlocks[0].id).toBe('s1');
});

test('moves big blocks with grab offset; rejects overlapping targets; Escape cancels', async ({ page, request }) => {
  await seed(request, [big({ months: 2, rows: 1 }), big({ id: 'b2', title: 'Hiring', months: 1, rows: 1, placement: { start: '2027-02', row: 0 } })]);
  await page.goto('/');
  const header = page.locator('[data-big-id="b1"] .big-header');
  const from = await cell(page, 0, 0, 60, 12);
  const column = await page.locator('.month-label').first().boundingBox();
  await drag(page, from, { x: from.x + column.width, y: from.y + 64 });
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].placement).toEqual({ start: '2026-12', row: 1 });
  const shifted = await center(header);
  await drag(page, shifted, { x: shifted.x + column.width, y: shifted.y - 64 });
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].placement).toEqual({ start: '2026-12', row: 1 });
  const cancelStart = await center(header);
  await page.mouse.move(cancelStart.x, cancelStart.y);
  await page.mouse.down();
  await page.mouse.move(cancelStart.x + column.width, cancelStart.y + 64, { steps: 5 });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  expect((await persisted(request)).bigBlocks[0].placement).toEqual({ start: '2026-12', row: 1 });
});

test('resizes all big-block edges and keeps items anchored when resizing from the left', async ({ page, request }) => {
  await seed(request, [big({ smallBlocks: [item({ offset: 4 })] })]);
  await page.goto('/');
  const column = await page.locator('.month-label').first().boundingBox();
  const left = await center(page.getByRole('separator', { name: 'Resize Platform v2 from left' }));
  await drag(page, left, { x: left.x + column.width, y: left.y });
  await saved(page);
  expect((await persisted(request)).bigBlocks[0]).toMatchObject({ months: 2, placement: { start: '2026-12' }, smallBlocks: [{ offset: 0 }] });
  const right = await center(page.getByRole('separator', { name: 'Resize Platform v2 from right' }));
  await drag(page, right, { x: right.x + column.width, y: right.y });
  const bottom = await center(page.getByRole('separator', { name: 'Resize Platform v2 from bottom' }));
  await drag(page, bottom, { x: bottom.x, y: bottom.y + 64 });
  await saved(page);
  expect((await persisted(request)).bigBlocks[0]).toMatchObject({ months: 3, rows: 3, smallBlocks: [{ offset: 0 }] });
});

test('creates at a clicked quarter, resizes an item, and moves it to another track', async ({ page, request }) => {
  await seed(request, [big()]);
  await page.goto('/');
  const column = await page.locator('.month-label').first().boundingBox();
  const point = await cell(page, 0, 0, column.width / 4 + 8, 40);
  await page.mouse.dblclick(point.x, point.y);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('New story');
  await page.getByRole('textbox', { name: 'Title', exact: true }).press('Enter');
  const resize = await center(page.getByRole('separator', { name: 'Resize item from right' }));
  await drag(page, resize, { x: resize.x + column.width / 4, y: resize.y });
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].smallBlocks[0]).toMatchObject({ offset: 1, length: 5 });
  const chip = await center(page.locator('.small-block'));
  await drag(page, chip, { x: chip.x + column.width / 4, y: chip.y + 52 });
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].smallBlocks[0]).toMatchObject({ track: 1, offset: 2, length: 5 });
});

test('moves items across scheduled blocks and into a growing backlog block', async ({ page, request }) => {
  await seed(request, [
    big({ months: 2, rows: 1, smallBlocks: [item()] }),
    big({ id: 'b2', title: 'Hiring', months: 2, rows: 1, placement: { start: '2027-01', row: 1 } }),
    big({ id: 'b3', title: 'Ideas', months: 1, rows: 1, placement: null, backlogOrder: 0, smallBlocks: [item({ id: 's2', title: 'Existing' })] }),
  ]);
  await page.goto('/');
  const from = await center(page.locator('[data-small-id="s1"]'));
  const column = await page.locator('.month-label').first().boundingBox();
  const target = await cell(page, 2, 1, column.width / 2, 44);
  await drag(page, from, target);
  await saved(page);
  let doc = await persisted(request);
  expect(doc.bigBlocks[0].smallBlocks).toHaveLength(0);
  expect(doc.bigBlocks[1].smallBlocks[0]).toMatchObject({ id: 's1', offset: 0, length: 4 });
  await drag(page, await center(page.locator('[data-small-id="s1"]')), await center(page.locator('[data-backlog-id="b3"]')));
  await saved(page);
  doc = await persisted(request);
  expect(doc.bigBlocks[1].smallBlocks).toHaveLength(0);
  expect(doc.bigBlocks[2]).toMatchObject({ rows: 2, smallBlocks: [{ id: 's2' }, { id: 's1', track: 1 }] });
  await page.getByRole('button', { name: 'Expand items: Ideas' }).click();
  await drag(page, await center(page.locator('[data-small-id="s1"]')), target);
  await saved(page);
  expect((await persisted(request)).bigBlocks[1].smallBlocks[0].id).toBe('s1');
});

test('offers menu-based schedule, resize, color and link editing without dragging', async ({ page, request }) => {
  await seed(request, [big({ placement: null, backlogOrder: 0, smallBlocks: [item()] })]);
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Block menu: Platform v2' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Schedule, move, resize & color' }).click();
  await page.getByRole('checkbox', { name: 'Scheduled on roadmap' }).check();
  await page.getByLabel('Start month').fill('2026-12');
  await page.getByRole('spinbutton', { name: 'Top row' }).fill('3');
  await page.getByRole('button', { name: 'Color #00897b' }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('[data-big-id="b1"]')).toBeVisible();
  await page.getByRole('button', { name: 'Item menu: API design' }).click();
  await page.getByRole('menuitem', { name: 'Edit link' }).click();
  await page.getByLabel('Jira URL (optional)').fill('https://example.atlassian.net/browse/PLAT-12');
  await page.getByRole('button', { name: 'Save link', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Jira link for API design' })).toHaveAttribute('target', '_blank');
  await saved(page);
  expect((await persisted(request)).bigBlocks[0]).toMatchObject({ color: '#00897b', placement: { start: '2026-12', row: 2 }, smallBlocks: [{ jiraUrl: 'https://example.atlassian.net/browse/PLAT-12' }] });
});

test('prevents adding to full scheduled blocks and retains the original contents', async ({ page, request }) => {
  await seed(request, [big({ months: 1, rows: 1, smallBlocks: [item()] })]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Block menu: Platform v2' }).click();
  await page.getByRole('menuitem', { name: 'Add item' }).click();
  await expect(page.getByText('This block is full. Enlarge it before adding an item.')).toBeVisible();
  expect((await persisted(request)).bigBlocks[0].smallBlocks).toHaveLength(1);
});

test('handles conflict overwrite using the latest revision, then persists new edits', async ({ page, request }) => {
  await seed(request, [big()]);
  await page.goto('/');
  await saved(page);
  const remote = await persisted(request);
  await request.put(api, { data: { ...remote, settings: { ...remote.settings, monthsVisible: 4 } } });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Overwrite', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await saved(page);
  expect((await persisted(request)).settings).toEqual({ startMonth: '2026-12', monthsVisible: 6 });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await saved(page);
  expect((await persisted(request)).settings.startMonth).toBe('2027-01');
});

test('preserves edits made while an earlier save is in flight', async ({ page, request }) => {
  await page.goto('/');
  await saved(page);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let first = true;
  await page.route('**/api/roadmap', async (route) => {
    if (route.request().method() === 'PUT' && first) {
      first = false;
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByText('Saving...', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  release();
  await saved(page);
  expect((await persisted(request)).settings.startMonth).toBe('2027-01');
});

test('save failures retain edits and offer retry', async ({ page, request }) => {
  await page.goto('/');
  await saved(page);
  await page.route('**/api/roadmap', (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { error: 'Temporary failure' } }) : route.continue());
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByText('Save failed - retry')).toBeVisible();
  await page.unroute('**/api/roadmap');
  await page.getByText('Save failed - retry').click();
  await saved(page);
  expect((await persisted(request)).settings.startMonth).toBe('2026-12');
});

test('scrolls horizontally at minimum column width and shifts the visible range at the edge', async ({ page, request }) => {
  await seed(request, [big({ months: 1, rows: 1 })]);
  await page.goto('/');
  const doc = await persisted(request);
  await request.put(api, { data: { ...doc, settings: { startMonth: '2026-11', monthsVisible: 12 } } });
  await page.reload();
  const header = page.locator('[data-big-id="b1"] .big-header');
  const from = await center(header);
  const grid = await page.getByRole('main').boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(grid.x + grid.width - 6, from.y + 64, { steps: 8 });
  await expect.poll(() => page.getByRole('main').evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByLabel('From', { exact: true })).not.toHaveValue('2026-11', { timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
});

test('rejects overlapping small-item drops and supports left resize, trash and undo', async ({ page, request }) => {
  await seed(request, [big({ rows: 1, smallBlocks: [item({ offset: 2, length: 2 }), item({ id: 's2', title: 'Neighbor', offset: 5, length: 2 })] })]);
  await page.goto('/');
  const column = await page.locator('.month-label').first().boundingBox();
  let from = await center(page.locator('[data-small-id="s1"]'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + column.width * 3 / 4, from.y, { steps: 8 });
  await expect(page.locator('.drag-ghost.invalid')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  expect((await persisted(request)).bigBlocks[0].smallBlocks[0].offset).toBe(2);
  from = await center(page.locator('[data-small-id="s1"] .small-handle.left'));
  await drag(page, from, { x: from.x - column.width / 4, y: from.y });
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].smallBlocks[0]).toMatchObject({ offset: 1, length: 3 });
  await drag(page, await center(page.locator('[data-small-id="s1"]')), await center(page.getByRole('region', { name: 'Trash drop zone' })));
  await expect(page.locator('[data-small-id="s1"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-small-id="s1"]')).toBeVisible();
});

test('clipped blocks retain visible menus and show continuation indicators', async ({ page, request }, testInfo) => {
  await seed(request, [
    big({ months: 10, placement: { start: '2026-09', row: 0 }, smallBlocks: [item({ offset: 12 })] }),
    big({ id: 'b2', title: 'Marketing site', rows: 1, months: 2, placement: { start: '2027-01', row: 2 }, color: '#00897b' }),
    big({ id: 'b3', title: 'Ideas', placement: null, backlogOrder: 0 }),
  ]);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Block menu: Platform v2' })).toBeVisible();
  await expect(page.getByTitle('Continues before visible months')).toBeVisible();
  await expect(page.getByTitle('Continues after visible months')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('roadmap.png') });
  await page.getByRole('button', { name: 'Block menu: Platform v2' }).click();
  await page.getByRole('menuitem', { name: 'Resize from left' }).click();
  await page.getByRole('spinbutton', { name: 'Shift left edge by months' }).fill('1');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await saved(page);
  expect((await persisted(request)).bigBlocks[0]).toMatchObject({ months: 9, placement: { start: '2026-10' }, smallBlocks: [{ offset: 8 }] });
});

test('auto-scrolls vertically and grows the grid while dragging below the last row', async ({ page, request }) => {
  await seed(request, [big({ months: 1, rows: 1 })]);
  await page.goto('/');
  const from = await center(page.locator('.big-header'));
  const grid = await page.getByRole('main').boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, grid.y + grid.height - 8, { steps: 10 });
  await expect.poll(() => page.getByRole('main').evaluate((node) => node.scrollTop)).toBeGreaterThan(64);
  await page.mouse.up();
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].placement.row).toBeGreaterThan(9);
});

test('conflict reload discards local changes and restores the server document', async ({ page, request }) => {
  await page.goto('/');
  await saved(page);
  const remote = await persisted(request);
  await request.put(api, { data: { ...remote, settings: { ...remote.settings, monthsVisible: 4 } } });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Reload latest', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await saved(page);
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-11');
  await expect(page.getByLabel('Visible months')).toHaveText('4');
});

test('one-quarter chips keep link and menu controls within their bounds', async ({ page, request }) => {
  await seed(request, [big({ months: 1, rows: 1, smallBlocks: [item({ length: 1, jiraUrl: 'https://example.com/PROJ-1' }), item({ id: 's2', offset: 1, length: 1 })] })]);
  const doc = await persisted(request);
  await request.put(api, { data: { ...doc, settings: { ...doc.settings, monthsVisible: 12 } } });
  await page.goto('/');
  const chip = page.locator('[data-small-id="s1"]');
  await expect(chip).toBeVisible();
  const bounds = await chip.boundingBox();
  const link = page.getByRole('link', { name: 'Open Jira link for API design' });
  const menu = page.getByRole('button', { name: 'Item menu: API design' }).first();
  for (const control of [link, menu]) {
    const rect = await control.boundingBox();
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  }
  await menu.click();
  await page.getByRole('menuitem', { name: 'Edit link' }).click();
  await page.getByLabel('Jira URL (optional)').fill('');
  await page.getByRole('button', { name: 'Save link', exact: true }).click();
  await expect(link).toHaveCount(0);
  await saved(page);
});

for (const location of ['grid', 'backlog']) {
  for (const interaction of ['mouse', 'keyboard']) {
    test(`big-block menu rename in ${location} works with ${interaction} and supports Escape`, async ({ page, request }) => {
      await seed(request, [big(location === 'backlog' ? { placement: null, backlogOrder: 0 } : {})]);
      await page.goto('/');
      const openRename = async (title) => {
        const button = page.getByRole('button', { name: `Block menu: ${title}` });
        if (interaction === 'keyboard') {
          await button.focus();
          await page.keyboard.press('Enter');
          await page.getByRole('menuitem', { name: 'Rename', exact: true }).focus();
          await page.keyboard.press('Enter');
        } else {
          await button.click();
          await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
        }
      };
      await openRename('Platform v2');
      const title = page.getByRole('textbox', { name: 'Title', exact: true });
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(title).toBeFocused();
      await expect(title).toHaveValue('Platform v2');
      await title.fill('Renamed initiative');
      if (interaction === 'keyboard') await title.press('Enter');
      else await page.getByRole('heading', { name: 'aiRoadmap', exact: true }).click();
      await expect(title).toHaveCount(0);
      await saved(page);
      expect((await persisted(request)).bigBlocks[0].title).toBe('Renamed initiative');
      await openRename('Renamed initiative');
      await expect(title).toBeFocused();
      await title.fill('Discard this title');
      await title.press('Escape');
      await expect(title).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Block menu: Renamed initiative', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Block menu: Renamed initiative', exact: true })).toBeVisible();
    });
  }
}

test('item menu rename and Add item retain editor focus after closing the menu', async ({ page, request }) => {
  await seed(request, [big({ smallBlocks: [item()] })]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Item menu: API design', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(title).toBeFocused();
  await title.fill('Renamed story');
  await title.press('Enter');
  await page.getByRole('button', { name: 'Block menu: Platform v2', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add item', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(title).toBeFocused();
  await title.fill('Another story');
  await title.press('Enter');
  await saved(page);
  expect((await persisted(request)).bigBlocks[0].smallBlocks.map((item) => item.title)).toEqual(['Renamed story', 'Another story']);
});

for (const rows of [1, 2, 3]) {
  test(`small items fill ${rows}-row block tracks with two-line titles while backlog stays compact`, async ({ page, request }, testInfo) => {
    const longTitle = 'Prepare the customer migration documentation and rollout checklist for every regional support team and production environment';
    const tracks = rows === 1 ? [0] : [0, rows - 1];
    await seed(request, [
      big({ rows, smallBlocks: tracks.map((track) => item({ id: `s${track}`, title: longTitle, track })) }),
      big({ id: 'backlog', title: 'Ideas', placement: null, backlogOrder: 0, smallBlocks: [item({ id: 'backlog-item', title: longTitle })] }),
    ]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Expand items: Ideas', exact: true }).click();
    const parent = page.locator('[data-big-id="b1"]');
    const body = await parent.locator('.tracks').boundingBox();
    const parentRect = await parent.boundingBox();
    expect(parentRect.height).toBe(rows * 64 - 2);
    for (const track of tracks) {
      const chip = page.locator(`[data-small-id="s${track}"]`);
      const rect = await chip.boundingBox();
      expect(rect.height).toBeCloseTo(body.height / rows - 4, 0);
      expect(rect.y).toBeCloseTo(body.y + track * body.height / rows + 2, 0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(body.y + body.height - 1);
      await expect(chip).toHaveAttribute('title', longTitle);
      const label = chip.locator('.inline-title');
      await expect(label).toHaveText(longTitle);
      const text = await label.evaluate((node) => ({ height: node.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(node).lineHeight) }));
      expect(text.height).toBeCloseTo(text.lineHeight * 2, 0);
    }
    const backlog = page.locator('[data-small-id="backlog-item"]');
    expect((await backlog.boundingBox()).height).toBe(30);
    const backlogText = await backlog.locator('.inline-title').evaluate((node) => ({ height: node.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(node).lineHeight) }));
    expect(backlogText.height).toBeCloseTo(backlogText.lineHeight, 0);
    await page.screenshot({ path: testInfo.outputPath('two-line-items.png') });
    if (rows === 1) {
      await page.locator('[data-small-id="s0"]').getByRole('button', { name: `Item menu: ${longTitle}`, exact: true }).click();
      await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
      const editor = page.getByRole('textbox', { name: 'Title', exact: true });
      await expect(editor).toBeFocused();
      await editor.fill('Updated customer migration documentation');
      await editor.press('Enter');
      await saved(page);
      expect((await persisted(request)).bigBlocks[0].smallBlocks[0].title).toBe('Updated customer migration documentation');
    }
  });
}

test('small-item drag previews fill the target track and match the dropped item', async ({ page, request }) => {
  await seed(request, [
    big({ rows: 1, months: 2, smallBlocks: [item({ title: 'Prepare the customer migration documentation' })] }),
    big({ id: 'b2', title: 'Rollout', rows: 3, months: 2, placement: { start: '2027-01', row: 2 } }),
  ]);
  await page.goto('/');
  const chip = page.locator('[data-small-id="s1"]');
  const from = await center(chip);
  const sourceRect = await chip.boundingBox();
  const column = await page.locator('.month-label').first().boundingBox();
  const target = await page.locator('[data-big-id="b2"] .tracks').boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + column.width / 4, from.y, { steps: 6 });
  let preview = await page.locator('.drag-ghost.valid').boundingBox();
  expect(preview.height).toBeCloseTo(sourceRect.height, 0);
  expect(preview.y).toBeCloseTo(sourceRect.y, 0);
  expect(preview.x).toBeCloseTo(sourceRect.x + column.width / 4, 0);
  await page.mouse.move(target.x + column.width / 2, target.y + target.height * 5 / 6, { steps: 8 });
  await expect(page.locator('.drag-ghost.valid')).toBeVisible();
  preview = await page.locator('.drag-ghost.valid').boundingBox();
  expect(preview.height).toBeCloseTo(target.height / 3 - 4, 0);
  expect(preview.y).toBeCloseTo(target.y + target.height * 2 / 3 + 2, 0);
  await page.mouse.up();
  const dropped = await chip.boundingBox();
  for (const dimension of ['x', 'y', 'width', 'height']) expect(dropped[dimension]).toBeCloseTo(preview[dimension], 0);
  await saved(page);
  const doc = await persisted(request);
  expect(doc.bigBlocks[0].smallBlocks).toHaveLength(0);
  expect(doc.bigBlocks[1].smallBlocks[0]).toMatchObject({ id: 's1', track: 2, offset: 0, length: 4 });
});
