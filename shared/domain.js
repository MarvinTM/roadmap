/** @typedef {{id:string,title:string,jiraUrl:string|null,done?:boolean,track:number,offset:number,length:number}} SmallBlock */
/** @typedef {{id:string,title:string,color:string,months:number,rows:number,placement:{start:string,row:number}|null,backlogOrder:number|null,smallBlocks:SmallBlock[]}} BigBlock */
/** @typedef {{id:string,title:string,month:string,color:string}} Release */
/** @typedef {{schemaVersion:2,revision:number,updatedAt:string,settings:{startMonth:string,monthsVisible:number,tintReleasePeriods:boolean},bigBlocks:BigBlock[],releases:Release[]}} Roadmap */

// Two rows of 8; each second-row color sits under a related hue. All keep
// at least 4.5:1 contrast with the white block-header text.
export const COLORS = [
  '#1976d2', '#7b1fa2', '#00897b', '#e65100', '#c62828', '#455a64', '#558b2f', '#ad1457',
  '#283593', '#5e35b1', '#006064', '#9e5d00', '#6d4c41', '#827717', '#1b5e20', '#d81b60',
];
export const isMonth = (value) => typeof value === 'string' && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const monthIndex = (month) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
export function indexMonth(index) {
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}
export const addMonths = (month, delta) => indexMonth(monthIndex(month) + delta);
export const diffMonths = (a, b) => monthIndex(a) - monthIndex(b);
export const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
export const formatMonth = (month) => new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
export const intervalsOverlap = (a, lengthA, b, lengthB) => a < b + lengthB && b < a + lengthA;
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;

export function emptyRoadmap() {
  return {
    schemaVersion: 2, revision: 0, updatedAt: new Date().toISOString(),
    settings: { startMonth: currentMonth(), monthsVisible: 12, tintReleasePeriods: false }, bigBlocks: [], releases: [],
  };
}

export function validUrl(value) {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function bigFits(blocks, candidate) {
  if (!integer(candidate.months, 1) || !integer(candidate.rows, 1)) return false;
  if (!candidate.placement) return true;
  const { start, row } = candidate.placement;
  if (!isMonth(start) || !integer(row) || !isMonth(addMonths(start, candidate.months - 1)) ||
      !Number.isSafeInteger(row + candidate.rows)) return false;
  return !blocks.some((other) => other.id !== candidate.id && other.placement &&
    intervalsOverlap(monthIndex(start), candidate.months, monthIndex(other.placement.start), other.months) &&
    intervalsOverlap(row, candidate.rows, other.placement.row, other.rows));
}

/**
 * Places `block` (already grown downwards) and pushes every scheduled block it
 * now overlaps down just far enough to clear it, cascading to any block those
 * then overlap. Only blocks that started below their pusher are pushed, so
 * blocks out of the way or above never move (an overlap with one of those is
 * left for validation to reject). Returns the new block list and the ids of
 * the blocks that moved.
 */
export function pushDown(blocks, block) {
  const originalRow = new Map(blocks.filter((b) => b.placement).map((b) => [b.id, b.placement.row]));
  originalRow.set(block.id, block.placement.row);
  const next = new Map(blocks.map((b) => [b.id, b.id === block.id ? block : b]));
  const moved = new Set();
  const queue = [block.id];
  while (queue.length) {
    const pusher = next.get(queue.shift()); // latest position; a block can be queued more than once
    const bottom = pusher.placement.row + pusher.rows;
    for (const other of next.values()) {
      if (other.id === pusher.id || other.id === block.id || !other.placement ||
          originalRow.get(other.id) <= originalRow.get(pusher.id)) continue;
      if (!intervalsOverlap(monthIndex(pusher.placement.start), pusher.months, monthIndex(other.placement.start), other.months) ||
          !intervalsOverlap(pusher.placement.row, pusher.rows, other.placement.row, other.rows)) continue;
      const pushed = { ...other, placement: { ...other.placement, row: bottom } };
      next.set(other.id, pushed);
      moved.add(other.id);
      queue.push(other.id);
    }
  }
  return { blocks: blocks.map((b) => next.get(b.id)), moved: [...moved] };
}

/**
 * Places `block` (already shrunk from the bottom) and pulls up the blocks that
 * were stacked directly beneath it: any block touching its old bottom edge,
 * and transitively any block touching one of those. Each rises only as far as
 * the free space above it allows, so it never overlaps anything; blocks with
 * a gap beneath their neighbour stay put. Returns the same shape as pushDown.
 */
export function pullUp(blocks, block) {
  const old = blocks.find((b) => b.id === block.id);
  const sharesMonths = (a, b) => intervalsOverlap(monthIndex(a.placement.start), a.months, monthIndex(b.placement.start), b.months);
  const placed = blocks.filter((b) => b.placement && b.id !== block.id);
  // Blocks stacked beneath the old block, found in the original layout.
  const stacked = new Set();
  const queue = [old];
  while (queue.length) {
    const above = queue.shift();
    for (const other of placed) {
      if (!stacked.has(other.id) && other.placement.row === above.placement.row + above.rows && sharesMonths(above, other)) {
        stacked.add(other.id);
        queue.push(other);
      }
    }
  }
  const originalRow = new Map([...placed, old].map((b) => [b.id, b.placement.row]));
  const next = new Map(blocks.map((b) => [b.id, b.id === block.id ? block : b]));
  const moved = [];
  // Top to bottom, so every block above has already settled.
  for (const other of placed.filter((b) => stacked.has(b.id)).sort((a, b) => a.placement.row - b.placement.row)) {
    const above = [...next.values()].filter((b) => b.placement && b.id !== other.id &&
      originalRow.get(b.id) < originalRow.get(other.id) && sharesMonths(b, other));
    const floor = Math.max(0, ...above.map((b) => b.placement.row + b.rows));
    if (floor < other.placement.row) {
      next.set(other.id, { ...other, placement: { ...other.placement, row: floor } });
      moved.push(other.id);
    }
  }
  return { blocks: blocks.map((b) => next.get(b.id)), moved };
}

/** Pushes blocks below down when `block` grew in rows, or pulls stacked ones up when it shrank. */
export function reflowBelow(blocks, block) {
  const old = blocks.find((b) => b.id === block.id);
  if (!old?.placement || !block.placement || block.rows === old.rows) return { blocks: blocks.map((b) => b.id === block.id ? block : b), moved: [] };
  return block.rows > old.rows ? pushDown(blocks, block) : pullUp(blocks, block);
}

export function smallFits(parent, item, excludeId = item.id) {
  return integer(item.track) && item.track < parent.rows && integer(item.offset) &&
    integer(item.length, 1) && item.offset + item.length <= parent.months * 4 &&
    !parent.smallBlocks.some((other) => other.id !== excludeId && other.track === item.track &&
      intervalsOverlap(item.offset, item.length, other.offset, other.length));
}

export const contentsFit = (block) => block.smallBlocks.every((item) => smallFits(block, item));

export function firstSlot(block, length, excludeId) {
  const items = block.smallBlocks.filter((item) => item.id !== excludeId);
  // Only occupied tracks need inspection, so sparse, very tall blocks stay cheap.
  const tracks = [...new Set(items.map((item) => item.track))].sort((a, b) => a - b);
  let track = 0;
  for (const occupied of tracks) {
    if (occupied > track && length <= block.months * 4) return { track, offset: 0 };
    const intervals = items.filter((item) => item.track === occupied).sort((a, b) => a.offset - b.offset);
    let offset = 0;
    for (const item of intervals) {
      if (item.offset - offset >= length) return { track: occupied, offset };
      offset = Math.max(offset, item.offset + item.length);
    }
    if (block.months * 4 - offset >= length) return { track: occupied, offset };
    track = occupied + 1;
  }
  return track < block.rows && length <= block.months * 4 ? { track, offset: 0 } : null;
}

export function backlogSlot(block, length, excludeId) {
  const slot = firstSlot(block, length, excludeId);
  if (slot) return { block, slot };
  const grown = { ...block, rows: block.rows + 1, months: Math.max(block.months, Math.ceil(length / 4)) };
  return { block: grown, slot: { track: block.rows, offset: 0 } };
}

export const sortedReleases = (releases) => [...releases].sort((a, b) => monthIndex(a.month) - monthIndex(b.month));
export const releaseFits = (releases, candidate) => isMonth(candidate.month) &&
  !releases.some((release) => release.id !== candidate.id && release.month === candidate.month);

export function nextReleaseMonth(doc) {
  const last = sortedReleases(doc.releases).at(-1);
  return last ? addMonths(last.month, 1) : doc.settings.startMonth;
}

export function revealRelease(settings, month) {
  const offset = diffMonths(month, settings.startMonth);
  if (offset < 0) return { ...settings, startMonth: month };
  if (offset >= settings.monthsVisible) return { ...settings, startMonth: addMonths(month, 1 - settings.monthsVisible) };
  return settings;
}

/** Visible portions of release periods, measured in month columns. */
export function releasePeriods(releases, startMonth, monthsVisible) {
  let previousEnd = -Infinity;
  const periods = [];
  for (const release of sortedReleases(releases)) {
    const end = diffMonths(release.month, startMonth) + 1;
    const left = Math.max(0, previousEnd);
    const right = Math.min(monthsVisible, end);
    if (right > left) periods.push({ id: release.id, color: release.color, left, width: right - left });
    previousEnd = end;
  }
  return periods;
}

/** Returns a human-readable validation error, or null. */
export function validateRoadmap(doc, { allowLegacy = false } = {}) {
  const legacy = allowLegacy && doc?.schemaVersion === 1;
  if (!legacy && doc?.schemaVersion === 1) return 'This roadmap uses an outdated format. Reload the page before saving.';
  if (!doc || (!legacy && doc.schemaVersion !== 2) || !integer(doc.revision) || doc.revision === Number.MAX_SAFE_INTEGER ||
      typeof doc.updatedAt !== 'string' || !Number.isFinite(Date.parse(doc.updatedAt))) return 'Invalid roadmap metadata.';
  if (!doc.settings || !isMonth(doc.settings.startMonth) ||
      !integer(doc.settings.monthsVisible, 3) || doc.settings.monthsVisible > 36 ||
      !isMonth(addMonths(doc.settings.startMonth, doc.settings.monthsVisible - 1))) return 'Invalid visible month range.';
  if (!legacy && (typeof doc.settings.tintReleasePeriods !== 'boolean' || !Array.isArray(doc.releases))) return 'Invalid release settings or releases array.';
  if (!Array.isArray(doc.bigBlocks)) return 'bigBlocks must be an array.';
  const ids = new Set();
  const checkId = (id) => {
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) return false;
    ids.add(id);
    return true;
  };
  if (!legacy) {
    const months = new Set();
    for (const release of doc.releases) {
      if (!release || !checkId(release.id) || typeof release.title !== 'string' || !release.title.trim() ||
          !isMonth(release.month) || typeof release.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(release.color)) return 'Invalid release.';
      if (months.has(release.month)) return 'Two releases cannot end in the same month.';
      months.add(release.month);
    }
  }
  for (const block of doc.bigBlocks) {
    if (!block || !checkId(block.id) || typeof block.title !== 'string' || !block.title.trim() ||
        typeof block.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(block.color) ||
        !integer(block.months, 1) || !integer(block.rows, 1) || !Number.isSafeInteger(block.months * 4) ||
        !Array.isArray(block.smallBlocks)) return 'Invalid big block.';
    if (block.placement !== null && (!block.placement || !isMonth(block.placement.start) || !integer(block.placement.row))) return 'Invalid block placement.';
    if (block.placement ? block.backlogOrder !== null : !integer(block.backlogOrder)) return 'Invalid backlog order.';
    for (const item of block.smallBlocks) {
      if (!item || !checkId(item.id) || typeof item.title !== 'string' || !item.title.trim() ||
          !validUrl(item.jiraUrl) || (item.done !== undefined && typeof item.done !== 'boolean') || !integer(item.track) || !integer(item.offset) || !integer(item.length, 1)) return 'Invalid small block.';
    }
  }
  for (const block of doc.bigBlocks) {
    if (!bigFits(doc.bigBlocks, block)) return 'Big blocks overlap or have invalid bounds.';
    if (!contentsFit(block)) return 'Small blocks overlap or exceed their parent bounds.';
  }
  return null;
}

export function resizedBig(block, edge, delta) {
  if (edge === 'bottom') return { ...block, rows: block.rows + delta };
  if (edge === 'right') return { ...block, months: block.months + delta };
  return {
    ...block, months: block.months - delta,
    placement: { ...block.placement, start: addMonths(block.placement.start, delta) },
    smallBlocks: block.smallBlocks.map((item) => ({ ...item, offset: item.offset - delta * 4 })),
  };
}
