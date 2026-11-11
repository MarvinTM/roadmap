import { IconButton, Typography, Button, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight, ExpandMore, ExpandLess, MoreHoriz, DeleteOutline, Add } from '@mui/icons-material';
import InlineTitle from './InlineTitle.jsx';
import SmallBlock from './SmallBlock.jsx';
import { useRoadmap } from '../state/RoadmapContext.jsx';

export default function Backlog({ ui, begin, collapsed, setCollapsed, expanded, setExpanded, preview }) {
  const { doc, act } = useRoadmap();
  const blocks = doc.bigBlocks.filter((b) => !b.placement).sort((a, b) => a.backlogOrder - b.backlogOrder);
  return (
    <aside className={`backlog ${collapsed ? 'collapsed' : ''}`} data-backlog>
      <div className="backlog-heading">
        {!collapsed && <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5 }}>Backlog <span className="muted">{blocks.length}</span></Typography>}
        <Tooltip title={collapsed ? 'Expand backlog' : 'Collapse backlog'}><IconButton aria-label={collapsed ? 'Expand backlog' : 'Collapse backlog'} size="small" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight /> : <ChevronLeft />}</IconButton></Tooltip>
      </div>
      <div className={`backlog-cards ${preview?.target === 'backlog' ? 'drop-active' : ''}`}>
        {!collapsed && !blocks.length && <div className="backlog-empty">Ideas start here.<br />Create a big block, then drag it onto the roadmap.</div>}
        {!collapsed && blocks.map((block) => {
          const editing = ui.editing === block.id;
          return (
            <section key={block.id} className={`backlog-card ${preview?.targetId === block.id ? 'drop-active' : ''}`} data-backlog-id={block.id} style={{ borderTopColor: block.color }}>
              <div className="backlog-card-title" onPointerDown={(event) => { if (!editing) begin(event, { kind: 'big', mode: 'move', id: block.id }); }}>
                <InlineTitle key={`${block.id}-${editing}`} title={block.title} editing={editing} onEdit={() => ui.setEditing(block.id)}
                  onSave={(title) => { act({ type: 'updateBig', id: block.id, patch: { title } }); ui.setEditing(null); }} onCancel={() => ui.setEditing(null)} />
                <IconButton size="small" aria-label={`Block menu: ${block.title}`} onPointerDown={(e) => e.stopPropagation()} onClick={(event) => ui.openMenu(event, 'big', block.id)}><MoreHoriz sx={{ fontSize: 18 }} /></IconButton>
              </div>
              <div className="backlog-card-details" onPointerDown={(event) => begin(event, { kind: 'big', mode: 'move', id: block.id })}>
                <span>{block.months}m × {block.rows}r · {block.smallBlocks.length} {block.smallBlocks.length === 1 ? 'item' : 'items'}</span>
                <IconButton size="small" aria-label={`${expanded.has(block.id) ? 'Collapse' : 'Expand'} items: ${block.title}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setExpanded((old) => { const next = new Set(old); if (next.has(block.id)) next.delete(block.id); else next.add(block.id); return next; })}>
                  {expanded.has(block.id) ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </IconButton>
              </div>
              {expanded.has(block.id) && <div className="backlog-items">
                {block.smallBlocks.map((item) => <SmallBlock key={item.id} item={item} parent={block} ui={ui} begin={begin} compact />)}
                <Button size="small" startIcon={<Add />} onClick={() => ui.addSmall(block.id)}>Add item</Button>
              </div>}
            </section>
          );
        })}
      </div>
      <div className={`trash-zone ${preview?.target === 'trash' ? 'trash-active' : ''}`} data-trash role="region" aria-label="Trash drop zone">
        <DeleteOutline />
        {!collapsed && <><span>Drop here to delete</span><small>Undo available for 5 seconds</small></>}
      </div>
    </aside>
  );
}
