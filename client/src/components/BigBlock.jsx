import { IconButton } from '@mui/material';
import { MoreHoriz } from '@mui/icons-material';
import { diffMonths } from '@roadmap/shared';
import { HEADER_HEIGHT, ROW_HEIGHT, trackHeight } from '../lib/geometry.js';
import { useRoadmap } from '../state/RoadmapContext.jsx';
import InlineTitle from './InlineTitle.jsx';
import SmallBlock from './SmallBlock.jsx';

export default function BigBlock({ block, colWidth, startMonth, monthsVisible, ui, begin }) {
  const { act } = useRoadmap();
  const start = diffMonths(block.placement.start, startMonth);
  const leftClip = Math.max(0, -start * colWidth);
  const rightClip = Math.max(0, (start + block.months - monthsVisible) * colWidth);
  const editing = ui.editing === block.id;
  const height = trackHeight(block.rows);
  return (
    <section
      className="big-block" data-big-id={block.id}
      aria-label={`${block.title}, ${block.months} months, ${block.rows} rows`}
      style={{
        left: start * colWidth + 2, top: block.placement.row * ROW_HEIGHT + 1,
        width: block.months * colWidth - 4, height: block.rows * ROW_HEIGHT - 2,
        borderColor: block.color, backgroundColor: `${block.color}14`,
        '--quarter-width': `${colWidth / 4}px`,
      }}
    >
      <div className="big-header" style={{ backgroundColor: block.color, paddingLeft: leftClip + 7, paddingRight: rightClip + 2 }}
        onPointerDown={(event) => { if (!editing) begin(event, { kind: 'big', mode: 'move', id: block.id }); }}>
        {leftClip > 0 && <span className="continuation" title="Continues before visible months">◀</span>}
        <InlineTitle key={`${block.id}-${editing}`} title={block.title} editing={editing} onEdit={() => ui.setEditing(block.id)}
          onSave={(title) => { act({ type: 'updateBig', id: block.id, patch: { title } }); ui.setEditing(null); }} onCancel={() => ui.setEditing(null)} />
        {rightClip > 0 && <span className="continuation" title="Continues after visible months">▶</span>}
        <IconButton aria-label={`Block menu: ${block.title}`} size="small" sx={{ color: 'white', p: 0.1 }} onPointerDown={(e) => e.stopPropagation()} onClick={(event) => ui.openMenu(event, 'big', block.id)}><MoreHoriz sx={{ fontSize: 20 }} /></IconButton>
      </div>
      <div className="tracks" style={{ top: HEADER_HEIGHT, backgroundSize: `${colWidth / 4}px 100%, 100% ${height}px` }}
        onDoubleClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          ui.addSmall(block.id, {
            track: Math.min(block.rows - 1, Math.floor((event.clientY - rect.top) / height)),
            offset: Math.max(0, Math.floor((event.clientX - rect.left) / (colWidth / 4))),
          });
        }}>
        {block.smallBlocks.map((item) => <div key={item.id} className="item-position" style={{ top: item.track * height + 2, height: height - 4, left: item.offset * colWidth / 4 + 2, width: item.length * colWidth / 4 - 4 }}>
          <SmallBlock item={item} parent={block} ui={ui} begin={begin} />
        </div>)}
      </div>
      <div role="separator" aria-label={`Resize ${block.title} from left`} className="big-handle left" onPointerDown={(event) => begin(event, { kind: 'big', mode: 'left', id: block.id })} />
      <div role="separator" aria-label={`Resize ${block.title} from right`} className="big-handle right" onPointerDown={(event) => begin(event, { kind: 'big', mode: 'right', id: block.id })} />
      <div role="separator" aria-label={`Resize ${block.title} from bottom`} className="big-handle bottom" onPointerDown={(event) => begin(event, { kind: 'big', mode: 'bottom', id: block.id })} />
    </section>
  );
}
