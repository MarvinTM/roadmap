import { describe, expect, it } from 'vitest';
import { emptyRoadmap } from '@roadmap/shared';
import { changeDocument } from './reducer.js';

const apply = (doc, action) => changeDocument(doc, action).doc;
function setup(scheduled = false) {
  let doc = apply(emptyRoadmap(), { type: 'addBig', id: 'a' });
  if (scheduled) doc = apply(doc, { type: 'updateBig', id: 'a', patch: { placement: { start: '2026-11', row: 0 } } });
  return doc;
}

describe('roadmap actions', () => {
  it('pushes blocks below down when growing downwards, but only when asked to', () => {
    let doc = apply(setup(true), { type: 'addBig', id: 'b' });
    doc = apply(doc, { type: 'updateBig', id: 'b', patch: { placement: { start: '2026-11', row: 1 } } });
    const grow = { type: 'updateBig', id: 'a', patch: { rows: 3 } };
    expect(() => changeDocument(doc, grow)).toThrow('Big blocks overlap');
    const pushed = apply(doc, { ...grow, pushDown: true });
    expect(pushed.bigBlocks.find((b) => b.id === 'a')).toMatchObject({ rows: 3, placement: { row: 0 } });
    expect(pushed.bigBlocks.find((b) => b.id === 'b').placement).toEqual({ start: '2026-11', row: 3 });
  });

  it('preserves shape and contents through unscheduling and rescheduling', () => {
    let doc = setup(true);
    doc = apply(doc, { type: 'updateBig', id: 'a', patch: { months: 3, rows: 2 } });
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 's' });
    const original = doc.bigBlocks[0];
    doc = apply(doc, { type: 'updateBig', id: 'a', patch: { placement: null } });
    expect(doc.bigBlocks[0]).toMatchObject({ months: 3, rows: 2, smallBlocks: original.smallBlocks });
    doc = apply(doc, { type: 'updateBig', id: 'a', patch: { placement: { start: '2027-03', row: 4 } } });
    expect(doc.bigBlocks[0].smallBlocks).toEqual(original.smallBlocks);
    expect(doc.bigBlocks[0].backlogOrder).toBeNull();
  });

  describe('release actions', () => {
    const add = (doc, id, month) => apply(doc, { type: 'addRelease', id, title: id, month });
    it('reveals new off-screen releases with the smallest window shift and keeps view length', () => {
      let doc = apply(setup(true), { type: 'settings', settings: { startMonth: '2026-11', monthsVisible: 6 } });
      const blocks = structuredClone(doc.bigBlocks);
      doc = add(doc, 'first');
      expect(doc.releases[0].month).toBe('2026-11');
      doc = add(doc, 'future', '2028-07');
      expect(doc.settings.startMonth).toBe('2028-02');
      doc = add(doc, 'next');
      expect(doc.releases.at(-1).month).toBe('2028-08');
      expect(doc.settings).toMatchObject({ startMonth: '2028-03', monthsVisible: 6 });
      expect(doc.bigBlocks).toEqual(blocks);
    });
    it('reorders crossing releases without changing identities, colors or block contents', () => {
      let doc = add(add(setup(true), 'first', '2026-11'), 'second', '2027-01');
      const first = doc.releases[0];
      const blocks = structuredClone(doc.bigBlocks);
      doc = apply(doc, { type: 'updateRelease', id: 'first', patch: { month: '2027-02' } });
      expect(doc.releases.map((release) => release.id)).toEqual(['second', 'first']);
      expect(doc.releases[1]).toEqual({ ...first, month: '2027-02' });
      expect(doc.bigBlocks).toEqual(blocks);
      expect(() => apply(doc, { type: 'updateRelease', id: 'first', patch: { month: '2027-01' } })).toThrow(/same month/);
    });
    it('deletes only the boundary and undoes without reverting subsequent edits', () => {
      let doc = add(setup(true), 'r1', '2026-11');
      const deletion = changeDocument(doc, { type: 'deleteRelease', id: 'r1' });
      doc = apply(deletion.doc, { type: 'updateBig', id: 'a', patch: { title: 'Keep later edits' } });
      doc = apply(doc, { type: 'restore', undo: deletion.undo });
      expect(doc.releases).toEqual([deletion.undo.release]);
      expect(doc.bigBlocks[0].title).toBe('Keep later edits');
    });
    it('refuses Undo if the original month has been taken, leaving other releases untouched', () => {
      const deletion = changeDocument(add(setup(), 'original', '2026-11'), { type: 'deleteRelease', id: 'original' });
      const doc = add(deletion.doc, 'replacement', '2026-11');
      const snapshot = structuredClone(doc);
      expect(() => apply(doc, { type: 'restore', undo: deletion.undo })).toThrow('Cannot undo');
      expect(doc).toEqual(snapshot);
    });
  });
  it('shortens new items to free space and refuses a full scheduled block', () => {
    let doc = setup(true);
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 's', slot: { track: 0, offset: 2 } });
    expect(doc.bigBlocks[0].smallBlocks[0].length).toBe(2);
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 't' });
    expect(doc.bigBlocks[0].smallBlocks[1].length).toBe(2);
    expect(() => apply(doc, { type: 'addSmall', parentId: 'a', id: 'u' })).toThrow('full');
  });
  it('adds a track when creating an item in a full backlog block', () => {
    let doc = setup();
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 's' });
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 't' });
    expect(doc.bigBlocks[0].rows).toBe(2);
    expect(doc.bigBlocks[0].smallBlocks[1]).toMatchObject({ track: 1, offset: 0, length: 4 });
  });
  it('transfers items to specified hovered quarters, rather than preserving absolute dates', () => {
    let doc = setup(true);
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 's' });
    doc = apply(doc, { type: 'addBig', id: 'b' });
    doc = apply(doc, { type: 'updateBig', id: 'b', patch: { months: 2, placement: { start: '2027-04', row: 1 } } });
    doc = apply(doc, { type: 'updateSmall', parentId: 'a', id: 's', targetId: 'b', patch: { offset: 3, track: 0 } });
    expect(doc.bigBlocks[0].smallBlocks).toHaveLength(0);
    expect(doc.bigBlocks[1].smallBlocks[0]).toMatchObject({ id: 's', offset: 3, length: 4 });
  });
  it('grows backlog targets on transfer and preserves source state on invalid transfer', () => {
    let doc = setup(true);
    doc = apply(doc, { type: 'updateBig', id: 'a', patch: { months: 2 } });
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 's' });
    doc = apply(doc, { type: 'updateSmall', parentId: 'a', id: 's', patch: { length: 7 } });
    doc = apply(doc, { type: 'addBig', id: 'b' });
    const previous = structuredClone(doc);
    expect(() => apply(doc, { type: 'updateSmall', parentId: 'a', id: 's', targetId: 'b' })).toThrow();
    expect(doc).toEqual(previous);
    doc = apply(doc, { type: 'updateSmall', parentId: 'a', id: 's', targetId: 'b', autoSlot: true });
    expect(doc.bigBlocks[1]).toMatchObject({ months: 2, rows: 2 });
    expect(doc.bigBlocks[1].smallBlocks[0]).toMatchObject({ length: 7, track: 1 });
  });
  it('undoes deletion without reverting later edits; restores to backlog if occupied', () => {
    let doc = setup(true);
    const deletion = changeDocument(doc, { type: 'deleteBig', id: 'a' });
    doc = apply(deletion.doc, { type: 'addBig', id: 'b' });
    doc = apply(doc, { type: 'updateBig', id: 'b', patch: { title: 'Keep later edits', placement: { start: '2026-11', row: 0 } } });
    doc = apply(doc, { type: 'restore', undo: deletion.undo, fallbackId: 'fallback' });
    expect(doc.bigBlocks[0].title).toBe('Keep later edits');
    expect(doc.bigBlocks[1].id).toBe('a');
    expect(doc.bigBlocks[1].placement).toBeNull();
  });
  it('restores a deleted item to a new backlog parent if its old slot is occupied', () => {
    let doc = setup(true);
    doc = apply(doc, { type: 'addSmall', parentId: 'a', id: 's' });
    const deletion = changeDocument(doc, { type: 'deleteSmall', parentId: 'a', id: 's' });
    doc = apply(deletion.doc, { type: 'addSmall', parentId: 'a', id: 't' });
    doc = apply(doc, { type: 'restore', undo: deletion.undo, fallbackId: 'restored' });
    expect(doc.bigBlocks[0].smallBlocks[0].id).toBe('t');
    expect(doc.bigBlocks[1]).toMatchObject({ id: 'restored', placement: null, smallBlocks: [{ id: 's' }] });
  });
});
