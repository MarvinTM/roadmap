import { useCallback, useEffect, useRef, useState } from 'react';
import { addMonths, bigFits, contentsFit, pushDown, diffMonths, indexMonth, monthIndex, resizedBig, smallFits, backlogSlot, isMonth, releaseFits, formatMonth } from '@roadmap/shared';
import { pointInGrid, containsPoint, blockRect, trackAt, blockLabel, ROW_HEIGHT, GRID_HEADER } from '../lib/geometry.js';

export default function useGridDrag({ doc, act, gridRef, colWidthRef }) {
  const [preview, setPreview] = useState(null);
  const [extraRows, setExtraRows] = useState(0);
  const gesture = useRef(null);
  const latest = useRef({ doc, act });
  latest.current = { doc, act };
  const cleanup = useRef(null);

  const begin = useCallback((event, spec) => {
    if (event.button !== 0 || gesture.current || event.target.closest('button,input,a,textarea')) return;
    event.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const { doc } = latest.current;
    const parent = spec.kind === 'release'
      ? doc.releases.find((release) => release.id === spec.id)
      : doc.bigBlocks.find((b) => b.id === (spec.parentId || spec.id));
    if (!parent) return;
    const item = spec.kind === 'small' ? parent.smallBlocks.find((s) => s.id === spec.id) : null;
    const width = colWidthRef.current;
    const point = pointInGrid(grid, event.clientX, event.clientY, width, doc.settings.startMonth);
    const rect = event.currentTarget.getBoundingClientRect();
    const grabX = parent.placement ? point.x - diffMonths(parent.placement.start, doc.settings.startMonth) * width : 0;
    const grabY = parent.placement ? point.y - parent.placement.row * ROW_HEIGHT : 0;
    const grabQuarter = item ? (parent.placement ? grabX / (width / 4) - item.offset : Math.max(0, Math.min(item.length - 0.1, (event.clientX - rect.left) / rect.width * item.length))) : 0;
    const state = {
      ...spec, parent, item, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, pointerId: event.pointerId,
      startWorld: monthIndex(doc.settings.startMonth) * 4 + point.x / (width / 4),
      startGridY: point.y, grabX, grabY, grabQuarter, active: false, candidate: null,
      lastShift: 0, edgeDirection: 0, lastFrame: 0,
    };
    gesture.current = state;
    const capture = event.currentTarget;
    try { capture.setPointerCapture(event.pointerId); } catch { /* Window listeners also support detached cards. */ }

    const calculate = () => {
      const state = gesture.current;
      if (!state?.active) return;
      const { doc } = latest.current;
      const width = colWidthRef.current;
      const start = doc.settings.startMonth;
      const point = pointInGrid(grid, state.x, state.y, width, start);
      const worldQuarter = monthIndex(start) * 4 + point.x / (width / 4);
      const trash = document.querySelector('[data-trash]');
      const backlog = document.querySelector('[data-backlog]');
      const overTrash = trash && containsPoint(trash.getBoundingClientRect(), state.x, state.y);
      const overBacklog = backlog && containsPoint(backlog.getBoundingClientRect(), state.x, state.y);
      let candidate = { kind: state.kind, valid: false, target: 'none', x: state.x, y: state.y, label: 'Drop onto a block or the roadmap' };
      if (state.kind === 'release') {
        const bounds = grid.getBoundingClientRect();
        const overGrid = containsPoint(bounds, state.x, state.y);
        const release = { ...state.parent, month: addMonths(state.parent.month, Math.round((worldQuarter - state.startWorld) / 4)) };
        const valid = overGrid && releaseFits(doc.releases, release);
        candidate = { ...candidate, release, target: overGrid ? 'grid' : 'none', valid,
          label: valid ? `${release.title} · ends ${formatMonth(release.month)}` : overGrid ? 'Blocked: another release ends here, or invalid month' : 'Keep the release on the calendar',
          action: { type: 'updateRelease', id: state.id, patch: { month: release.month }, reveal: true } };
      } else if (state.mode === 'move' && overTrash) {
        candidate = { ...candidate, target: 'trash', valid: true, label: 'Delete · Undo available', action: state.kind === 'big' ? { type: 'deleteBig', id: state.id } : { type: 'deleteSmall', parentId: state.parentId, id: state.id } };
      } else if (state.mode === 'move' && overBacklog) {
        if (state.kind === 'big') {
          candidate = { ...candidate, valid: true, target: 'backlog', label: 'Move to backlog', action: { type: 'updateBig', id: state.id, patch: { placement: null } } };
        } else {
          const card = [...document.querySelectorAll('[data-backlog-id]')].find((node) => containsPoint(node.getBoundingClientRect(), state.x, state.y));
          const target = doc.bigBlocks.find((b) => b.id === card?.dataset.backlogId);
          if (target) {
            const allocation = backlogSlot(target, state.item.length, state.id);
            candidate = { ...candidate, valid: true, target: 'backlog', targetId: target.id,
              label: `Move to ${target.title} · track ${allocation.slot.track + 1}`,
              action: { type: 'updateSmall', parentId: state.parentId, id: state.id, targetId: target.id, autoSlot: true } };
          } else candidate.label = 'Drop onto a backlog card';
        }
      } else if (point.inside) {
        if (state.kind === 'big') {
          let block;
          if (state.mode === 'move') {
            block = { ...state.parent, placement: {
              start: state.parent.placement ? indexMonth(Math.round(monthIndex(start) + (point.x - state.grabX) / width)) : point.month,
              row: state.parent.placement ? Math.max(0, Math.round((point.y - state.grabY) / ROW_HEIGHT)) : Math.max(0, point.row),
            } };
          } else {
            const delta = state.mode === 'bottom' ? Math.round((point.y - state.startGridY) / ROW_HEIGHT) : Math.round((worldQuarter - state.startWorld) / 4);
            block = resizedBig(state.parent, state.mode, delta);
          }
          // Growing from the bottom pushes the blocks below down instead of colliding.
          const push = state.mode === 'bottom' && block.rows > state.parent.rows ? pushDown(doc.bigBlocks, block) : null;
          const blocks = push ? push.blocks : doc.bigBlocks;
          const pushed = push ? push.blocks.filter((b) => push.moved.includes(b.id)) : [];
          const valid = contentsFit(block) && bigFits(blocks, block) && pushed.every((b) => bigFits(blocks, b));
          const pushNote = pushed.length ? ` · pushes ${pushed.length} ${pushed.length === 1 ? 'block' : 'blocks'} down` : '';
          candidate = { ...candidate, block, pushed, target: 'grid', valid, label: valid ? blockLabel(block) + pushNote : 'Blocked: overlap, bounds, or existing items',
            action: { type: 'updateBig', id: state.id, patch: block, pushDown: Boolean(push) } };
        } else {
          const target = state.mode === 'move'
            ? doc.bigBlocks.find((b) => b.placement && containsPoint(blockRect(b, width, start), point.x, point.y))
            : doc.bigBlocks.find((b) => b.id === state.parentId);
          if (target?.placement) {
            let item;
            if (state.mode === 'move') {
              const targetStart = diffMonths(target.placement.start, start) * 4;
              item = { ...state.item, track: trackAt(target, point.y), offset: Math.round(point.x / (width / 4) - targetStart - state.grabQuarter) };
            } else {
              const delta = Math.round(worldQuarter - state.startWorld);
              item = state.mode === 'left' ? { ...state.item, offset: state.item.offset + delta, length: state.item.length - delta } : { ...state.item, length: state.item.length + delta };
            }
            const valid = smallFits(target, item);
            candidate = { ...candidate, target: 'grid', block: target, item, valid,
              label: valid ? `${item.length} q · track ${item.track + 1} · ${target.title}` : 'Blocked: overlap or outside the block',
              action: { type: 'updateSmall', parentId: state.parentId, id: state.id, targetId: target.id, patch: item } };
          }
        }
      }
      state.candidate = candidate;
      setPreview(candidate);
    };
    const move = (event) => {
      if (event.pointerId !== state.pointerId) return;
      state.x = event.clientX;
      state.y = event.clientY;
      if (!state.active && Math.hypot(state.x - state.startX, state.y - state.startY) >= 4) {
        state.active = true;
        document.body.classList.add('dragging');
        window.getSelection()?.removeAllRanges();
      }
      if (state.active) { event.preventDefault(); calculate(); }
    };
    let frame;
    const tick = (time) => {
      if (!gesture.current) return;
      if (state.active) {
        const elapsed = Math.min(32, time - (state.lastFrame || time)) / 16;
        const rect = grid.getBoundingClientRect();
        if (state.x >= rect.left - 10 && state.x <= rect.right + 10 && state.y >= rect.top && state.y <= rect.bottom + 12) {
          const edge = 38;
          const speed = (position, min, max) => position < min + edge ? -Math.min(16, (min + edge - position) / 2) : position > max - edge ? Math.min(16, (position - max + edge) / 2) : 0;
          const dx = speed(state.x, rect.left, rect.right) * elapsed;
          const dy = state.kind === 'release' ? 0 : speed(state.y, rect.top + GRID_HEADER, rect.bottom) * elapsed;
          if (dy > 0 && grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 4) {
            setExtraRows(Math.ceil((grid.scrollTop + grid.clientHeight) / ROW_HEIGHT) + 2);
          }
          grid.scrollLeft += dx;
          grid.scrollTop += dy;
          if (dx && (dx < 0 ? grid.scrollLeft <= 0 : grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 1)) {
            const direction = Math.sign(dx);
            if (state.edgeDirection !== direction) {
              state.edgeDirection = direction;
              state.lastShift = time;
            } else if (time - state.lastShift > 650) {
              const { doc, act } = latest.current;
              const startMonth = addMonths(doc.settings.startMonth, direction);
              if (isMonth(startMonth) && isMonth(addMonths(startMonth, doc.settings.monthsVisible - 1))) {
                act({ type: 'settings', settings: { startMonth } });
                state.lastShift = time;
              }
            }
          } else state.edgeDirection = 0;
          calculate();
        } else {
          state.edgeDirection = 0;
          const cards = document.querySelector('.backlog-cards');
          if (state.kind !== 'release' && cards && containsPoint(cards.getBoundingClientRect(), state.x, state.y)) {
            const bounds = cards.getBoundingClientRect();
            if (state.y < bounds.top + 32) cards.scrollTop -= 8 * elapsed;
            if (state.y > bounds.bottom - 32) cards.scrollTop += 8 * elapsed;
            calculate();
          }
        }
      }
      state.lastFrame = time;
      frame = requestAnimationFrame(tick);
    };
    const finish = (event, cancel = false) => {
      if (event?.pointerId !== undefined && event.pointerId !== state.pointerId) return;
      if (!cancel && state.active) {
        if (event) { state.x = event.clientX; state.y = event.clientY; }
        calculate();
        if (state.candidate?.valid) latest.current.act(state.candidate.action);
      }
      cleanup.current?.();
    };
    const up = (event) => finish(event);
    const cancel = (event) => finish(event, true);
    const key = (event) => { if (event.key === 'Escape') { event.preventDefault(); finish(null, true); } };
    const blur = () => finish(null, true);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', blur);
    grid.addEventListener('scroll', calculate);
    frame = requestAnimationFrame(tick);
    cleanup.current = () => {
      gesture.current = null;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', blur);
      grid.removeEventListener('scroll', calculate);
      try { if (capture.hasPointerCapture(state.pointerId)) capture.releasePointerCapture(state.pointerId); } catch { /* The source can disappear after a transfer. */ }
      document.body.classList.remove('dragging');
      setPreview(null);
      setExtraRows(0);
      cleanup.current = null;
    };
  }, [gridRef, colWidthRef]);

  useEffect(() => () => cleanup.current?.(), []);
  return { begin, preview, extraRows };
}
