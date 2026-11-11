import { addMonths, diffMonths, formatMonth } from '@roadmap/shared';

export const ROW_HEIGHT = 64;
export const HEADER_HEIGHT = 24;
export const MONTH_HEADER = 40;
export const GRID_TOP = MONTH_HEADER + 8;
export const columnWidth = (width, months) => Math.max(120, width / months);

export function pointInGrid(element, x, y, width, startMonth) {
  const rect = element.getBoundingClientRect();
  const gridX = x - rect.left + element.scrollLeft;
  const gridY = y - rect.top + element.scrollTop - GRID_TOP;
  return {
    x: gridX, y: gridY,
    month: addMonths(startMonth, Math.floor(gridX / width)),
    quarter: Math.floor(gridX / (width / 4)),
    row: Math.floor(gridY / ROW_HEIGHT),
    inside: x >= rect.left && x < rect.right && y >= rect.top + MONTH_HEADER && y < rect.bottom && gridY >= 0,
  };
}

export function blockRect(block, width, startMonth) {
  return {
    left: diffMonths(block.placement.start, startMonth) * width,
    top: block.placement.row * ROW_HEIGHT,
    width: block.months * width,
    height: block.rows * ROW_HEIGHT,
  };
}

// The outer vertical gaps and border take 4 px from the block's usable body.
export const trackHeight = (rows) => (rows * ROW_HEIGHT - HEADER_HEIGHT - 4) / rows;
export const trackAt = (block, y) => Math.max(0, Math.min(block.rows - 1, Math.floor((y - block.placement.row * ROW_HEIGHT - HEADER_HEIGHT - 2) / trackHeight(block.rows))));
export const containsPoint = (rect, x, y) => x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;
export const blockLabel = (block) => `${formatMonth(block.placement.start)} - ${formatMonth(addMonths(block.placement.start, block.months - 1))} · ${block.rows} ${block.rows === 1 ? 'row' : 'rows'}`;
