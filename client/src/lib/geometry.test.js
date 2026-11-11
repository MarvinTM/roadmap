import { expect, it } from 'vitest';
import { pointInGrid, blockRect, trackAt, columnWidth, GRID_TOP, MONTH_HEADER, containsPoint } from './geometry.js';

it('accounts for viewport offsets and both scroll axes when snapping to cells', () => {
  const element = { scrollLeft: 120, scrollTop: 64, getBoundingClientRect: () => ({ left: 240, top: 68, right: 1200, bottom: 800 }) };
  const point = pointInGrid(element, 270, 68 + GRID_TOP + 10, 120, '2026-11');
  expect(point).toMatchObject({ x: 150, y: 74, month: '2026-12', quarter: 5, row: 1, inside: true });
  expect(pointInGrid(element, 270, 70, 120, '2026-11').inside).toBe(false);
  expect(pointInGrid(element, 270, 68 + MONTH_HEADER + 10, 120, '2026-11').inside).toBe(false);
});

it('uses the post-header body height for track geometry', () => {
  const block = { months: 3, rows: 2, placement: { start: '2026-12', row: 1 } };
  expect(blockRect(block, 120, '2026-11')).toEqual({ left: 120, top: 64, width: 360, height: 128 });
  expect(containsPoint(blockRect(block, 120, '2026-11'), 150, 100)).toBe(true);
  expect(containsPoint(blockRect(block, 120, '2026-11'), 480, 100)).toBe(false);
  expect(trackAt(block, 90)).toBe(0);
  expect(trackAt(block, 141)).toBe(1);
  expect(columnWidth(600, 12)).toBe(120);
});
