import { describe, it, expect } from 'vitest';
import { addMonths, diffMonths, monthIndex, indexMonth, emptyRoadmap, validateRoadmap, bigFits, smallFits, firstSlot, backlogSlot, resizedBig, releaseFits, nextReleaseMonth, releasePeriods } from './domain.js';

const item = (patch = {}) => ({ id: 's1', title: 'Story', jiraUrl: null, track: 0, offset: 0, length: 4, ...patch });
const block = (patch = {}) => ({
  id: 'b1', title: 'Initiative', color: '#1976d2', months: 3, rows: 2,
  placement: { start: '2026-11', row: 0 }, backlogOrder: null, smallBlocks: [], ...patch,
});
const doc = (...blocks) => ({ ...emptyRoadmap(), bigBlocks: blocks });

describe('month arithmetic', () => {
  it('crosses year boundaries in either direction without date/DST arithmetic', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2027-01', -13)).toBe('2025-12');
    expect(diffMonths('2027-02', '2026-11')).toBe(3);
    expect(indexMonth(monthIndex('0001-01'))).toBe('0001-01');
  });
});

describe('rectangle and item collisions', () => {
  it('allows touching edges and own cells but rejects a shared cell', () => {
    const a = block();
    expect(bigFits([a], a)).toBe(true);
    expect(bigFits([a], block({ id: 'b2', placement: { start: '2027-02', row: 0 } }))).toBe(true);
    expect(bigFits([a], block({ id: 'b2', placement: { start: '2027-01', row: 1 } }))).toBe(false);
    expect(bigFits([a], block({ id: 'b2', placement: { start: '2026-11', row: 2 } }))).toBe(true);
  });
  it('allows neighboring items and separate tracks, but not overlap or out-of-bounds', () => {
    const parent = block({ smallBlocks: [item()] });
    expect(smallFits(parent, item({ id: 's2', offset: 4 }))).toBe(true);
    expect(smallFits(parent, item({ id: 's2', offset: 3 }))).toBe(false);
    expect(smallFits(parent, item({ id: 's2', track: 1 }))).toBe(true);
    expect(smallFits(parent, item({ offset: 11, length: 2 }))).toBe(false);
    expect(smallFits(parent, item({ length: 0 }))).toBe(false);
    expect(smallFits(parent, item({ track: 2 }))).toBe(false);
  });
  it('left resizing anchors items to absolute quarters and constrains all shrinking edges', () => {
    const original = block({ smallBlocks: [item({ offset: 4, track: 1 })] });
    const resized = resizedBig(original, 'left', 1);
    expect(resized.placement.start).toBe('2026-12');
    expect(resized.months).toBe(2);
    expect(resized.smallBlocks[0].offset).toBe(0);
    expect(validateRoadmap(doc(resized))).toBe(null);
    expect(validateRoadmap(doc(resizedBig(original, 'left', 2)))).not.toBe(null);
    expect(validateRoadmap(doc(resizedBig(original, 'right', -2)))).not.toBe(null);
    expect(validateRoadmap(doc(resizedBig(original, 'bottom', -1)))).not.toBe(null);
  });
});

describe('first-free-slot allocation', () => {
  it('prefers lowest track, then earliest fitting gap', () => {
    const parent = block({ smallBlocks: [item({ offset: 2, length: 2 }), item({ id: 's2', offset: 8, length: 4 })] });
    expect(firstSlot(parent, 2)).toEqual({ track: 0, offset: 0 });
    expect(firstSlot(parent, 4)).toEqual({ track: 0, offset: 4 });
    expect(firstSlot(parent, 5)).toEqual({ track: 1, offset: 0 });
  });
  it('grows a full backlog block by one track and widens only if necessary', () => {
    const parent = block({ placement: null, backlogOrder: 0, months: 1, rows: 1, smallBlocks: [item()] });
    const result = backlogSlot(parent, 7);
    expect(result.slot).toEqual({ track: 1, offset: 0 });
    expect(result.block.months).toBe(2);
    expect(result.block.rows).toBe(2);
    expect(parent.rows).toBe(1);
    expect(backlogSlot(parent, 4, 's1').block.rows).toBe(1);
  });
  it('does not enumerate huge empty track ranges', () => {
    const parent = block({ rows: 1000000000, smallBlocks: [item({ track: 999999999 })] });
    expect(firstSlot(parent, 4)).toEqual({ track: 0, offset: 0 });
  });
});

describe('document integrity', () => {
  it('accepts empty documents and valid unscheduled content', () => {
    expect(validateRoadmap(emptyRoadmap())).toBe(null);
    expect(validateRoadmap(doc(block({ placement: null, backlogOrder: 0, smallBlocks: [item()] })))).toBe(null);
  });

  describe('release boundaries', () => {
    const release = (id, month, color = '#1976d2') => ({ id, month, title: id, color });
    it('starts in the first visible month, then follows the chronological last release across years', () => {
      const roadmap = { ...emptyRoadmap(), settings: { ...emptyRoadmap().settings, startMonth: '2026-11' } };
      expect(nextReleaseMonth(roadmap)).toBe('2026-11');
      expect(nextReleaseMonth({ ...roadmap, releases: [release('later', '2027-12'), release('earlier', '2026-11')] })).toBe('2028-01');
    });
    it('permits crossing but rejects another release at the same boundary or invalid months', () => {
      const releases = [release('first', '2026-11'), release('second', '2027-01')];
      expect(releaseFits(releases, release('first', '2027-02'))).toBe(true);
      expect(releaseFits(releases, releases[0])).toBe(true);
      expect(releaseFits(releases, release('first', '2027-01'))).toBe(false);
      expect(releaseFits(releases, release('first', '2026-13'))).toBe(false);
    });
    it('clips periods to the view, includes the ending month, and leaves time after the last release clear', () => {
      const releases = [release('last', '2027-02'), release('first', '2026-11', '#00897b')];
      expect(releasePeriods(releases, '2026-10', 6)).toEqual([
        { id: 'first', color: '#00897b', left: 0, width: 2 },
        { id: 'last', color: '#1976d2', left: 2, width: 3 },
      ]);
      expect(releasePeriods(releases, '2026-12', 6)).toEqual([{ id: 'last', color: '#1976d2', left: 0, width: 3 }]);
      expect(releasePeriods(releases, '2027-03', 6)).toEqual([]);
      expect(releasePeriods([release('future', '2028-01')], '2026-11', 6)).toEqual([{ id: 'future', color: '#1976d2', left: 0, width: 6 }]);
    });
    it('rejects invalid releases and IDs shared with blocks or stories', () => {
      const roadmap = doc(block({ smallBlocks: [item()] }));
      for (const bad of [
        release('b1', '2026-11'), release('s1', '2026-11'),
        { ...release('r', '2026-11'), title: ' ' }, { ...release('r', '2026-11'), color: 'red' },
        release('r', '0000-01'),
      ]) expect(validateRoadmap({ ...roadmap, releases: [bad] })).not.toBeNull();
      expect(validateRoadmap({ ...roadmap, releases: [release('a', '2026-11'), release('b', '2026-11')] })).toMatch(/same month/);
      expect(validateRoadmap({ ...roadmap, releases: [release('r', '2026-11')] })).toBeNull();
    });
  });
  it.each([
    ['duplicate IDs', () => doc(block({ smallBlocks: [item({ id: 'b1' })] }))],
    ['invalid month', () => doc(block({ placement: { start: '2026-13', row: 0 } }))],
    ['zero width', () => doc(block({ months: 0 }))],
    ['fractional row', () => doc(block({ rows: 1.5 }))],
    ['invalid URL', () => doc(block({ smallBlocks: [item({ jiraUrl: 'javascript:alert(1)' })] }))],
    ['credential URL', () => doc(block({ smallBlocks: [item({ jiraUrl: 'https://user:pass@example.com' })] }))],
    ['blank title', () => doc(block({ title: ' ' }))],
    ['invalid color', () => doc(block({ color: 'red' }))],
    ['overflowing month', () => doc(block({ placement: { start: '9999-12', row: 0 } }))],
    ['missing small blocks', () => doc(block({ smallBlocks: null }))],
    ['overlap', () => doc(block(), block({ id: 'b2' }))],
    ['out-of-bounds item', () => doc(block({ smallBlocks: [item({ track: 5 })] }))],
  ])('rejects %s', (_label, factory) => expect(validateRoadmap(factory())).not.toBe(null));
});
