import { backlogSlot, firstSlot, validateRoadmap, COLORS, bigFits, smallFits } from '@roadmap/shared';

const nextOrder = (doc) => Math.max(-1, ...doc.bigBlocks.map((b) => b.backlogOrder ?? -1)) + 1;
const findBig = (doc, id) => {
  const block = doc.bigBlocks.find((b) => b.id === id);
  if (!block) throw new Error('That block no longer exists.');
  return block;
};
const replaceBig = (doc, block) => ({ ...doc, bigBlocks: doc.bigBlocks.map((b) => b.id === block.id ? block : b) });

export function changeDocument(doc, action) {
  let next = doc;
  let undo;
  switch (action.type) {
    case 'settings':
      next = { ...doc, settings: { ...doc.settings, ...action.settings } };
      break;
    case 'addBig':
      next = { ...doc, bigBlocks: [...doc.bigBlocks, {
        id: action.id, title: 'Untitled initiative', color: COLORS[doc.bigBlocks.length % COLORS.length],
        months: 1, rows: 1, placement: null, backlogOrder: nextOrder(doc), smallBlocks: [],
      }] };
      break;
    case 'updateBig': {
      const old = findBig(doc, action.id);
      const block = { ...old, ...action.patch };
      block.backlogOrder = block.placement ? null : old.backlogOrder ?? nextOrder(doc);
      next = replaceBig(doc, block);
      break;
    }
    case 'deleteBig': {
      undo = { kind: 'big', block: findBig(doc, action.id) };
      next = { ...doc, bigBlocks: doc.bigBlocks.filter((b) => b.id !== action.id) };
      break;
    }
    case 'addSmall': {
      let block = findBig(doc, action.parentId);
      let slot = action.slot;
      if (!slot) slot = firstSlot(block, 1);
      if (!slot) {
        if (block.placement) throw new Error('This block is full. Enlarge it before adding an item.');
        ({ block, slot } = backlogSlot(block, 4));
      }
      const occupied = block.smallBlocks.filter((s) => s.track === slot.track && s.offset >= slot.offset).sort((a, b) => a.offset - b.offset);
      const free = (occupied[0]?.offset ?? block.months * 4) - slot.offset;
      const item = { id: action.id, title: 'Untitled item', jiraUrl: null, ...slot, length: Math.min(4, free) };
      next = replaceBig(doc, { ...block, smallBlocks: [...block.smallBlocks, item] });
      break;
    }
    case 'updateSmall': {
      const source = findBig(doc, action.parentId);
      const original = source.smallBlocks.find((s) => s.id === action.id);
      if (!original) throw new Error('That item no longer exists.');
      let target = findBig(doc, action.targetId || source.id);
      const moved = { ...original, ...action.patch };
      if (action.autoSlot) {
        if (target.placement) throw new Error('Automatic placement is only available in the backlog.');
        const allocation = backlogSlot(target, moved.length, moved.id);
        target = allocation.block;
        Object.assign(moved, allocation.slot);
      }
      if (target.id === source.id) next = replaceBig(doc, { ...target, smallBlocks: target.smallBlocks.map((s) => s.id === moved.id ? moved : s) });
      else {
        next = replaceBig(doc, { ...source, smallBlocks: source.smallBlocks.filter((s) => s.id !== moved.id) });
        next = replaceBig(next, { ...target, smallBlocks: [...target.smallBlocks, moved] });
      }
      break;
    }
    case 'deleteSmall': {
      const block = findBig(doc, action.parentId);
      const item = block.smallBlocks.find((s) => s.id === action.id);
      if (!item) throw new Error('That item no longer exists.');
      undo = { kind: 'small', block, item };
      next = replaceBig(doc, { ...block, smallBlocks: block.smallBlocks.filter((s) => s.id !== action.id) });
      break;
    }
    case 'restore': {
      const saved = action.undo;
      if (saved.kind === 'big') {
        const block = { ...saved.block };
        if (!bigFits(doc.bigBlocks, block)) block.placement = null;
        block.backlogOrder = block.placement ? null : nextOrder(doc);
        next = { ...doc, bigBlocks: [...doc.bigBlocks, block] };
      } else {
        const parent = doc.bigBlocks.find((b) => b.id === saved.block.id);
        if (parent && smallFits(parent, saved.item)) {
          next = replaceBig(doc, { ...parent, smallBlocks: [...parent.smallBlocks, saved.item] });
        } else {
          const block = {
            ...saved.block, id: action.fallbackId, placement: null, backlogOrder: nextOrder(doc),
            title: `${saved.block.title} (restored item)`, smallBlocks: [saved.item],
          };
          next = { ...doc, bigBlocks: [...doc.bigBlocks, block] };
        }
      }
      break;
    }
    default: throw new Error('Unknown action.');
  }
  const error = validateRoadmap(next);
  if (error) throw new Error(error);
  return { doc: next, undo };
}

export function reducer(state, action) {
  if (action.type === 'load') return { doc: action.doc, version: 0, undo: null, error: null };
  if (action.type === 'saved') return { ...state, doc: { ...state.doc, ...action.metadata } };
  if (action.type === 'clearError') return { ...state, error: null };
  if (action.type === 'clearUndo') return { ...state, undo: null };
  try {
    const result = changeDocument(state.doc, action);
    return {
      doc: result.doc, version: state.version + 1, error: null,
      undo: action.type === 'restore' ? null : result.undo ? { ...result.undo, token: action.undoToken } : state.undo,
    };
  } catch (error) { return { ...state, error: error.message }; }
}
