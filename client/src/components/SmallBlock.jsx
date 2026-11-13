import { IconButton, Tooltip } from '@mui/material';
import { MoreHoriz, OpenInNew, DragIndicator, CheckCircle } from '@mui/icons-material';
import InlineTitle from './InlineTitle.jsx';
import { useRoadmap } from '../state/RoadmapContext.jsx';

export default function SmallBlock({ item, parent, ui, begin, compact = false }) {
  const { act } = useRoadmap();
  const editing = ui.editing === item.id;
  return (
    <div
      className={`small-block ${compact ? 'compact-item' : ''} ${item.done ? 'done' : ''}`}
      data-small-id={item.id} data-parent-id={parent.id}
      title={item.done ? `${item.title} (done)` : item.title}
      style={{ borderLeftColor: parent.color }}
      onPointerDown={(event) => { if (!editing) begin(event, { kind: 'small', mode: 'move', parentId: parent.id, id: item.id }); }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); ui.openMenu(event, 'small', item.id, parent.id); }}
    >
      {!compact && <div role="separator" aria-label="Resize item from left" className="small-handle left" onPointerDown={(event) => begin(event, { kind: 'small', mode: 'left', parentId: parent.id, id: item.id })} />}
      <DragIndicator className="item-grip" sx={{ fontSize: 14 }} />
      {item.done && <CheckCircle className="done-mark" titleAccess={`Done: ${item.title}`} sx={{ fontSize: 13 }} />}
      <InlineTitle key={`${item.id}-${editing}`} title={item.title} editing={editing} onEdit={() => ui.setEditing(item.id)}
        onSave={(title) => { act({ type: 'updateSmall', parentId: parent.id, id: item.id, patch: { title } }); ui.setEditing(null); }}
        onCancel={() => ui.setEditing(null)} />
      {item.jiraUrl && <Tooltip title="Open Jira link"><IconButton component="a" href={item.jiraUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open Jira link for ${item.title}`} size="small" onPointerDown={(e) => e.stopPropagation()} sx={{ p: 0.2 }}><OpenInNew sx={{ fontSize: 12 }} /></IconButton></Tooltip>}
      <IconButton aria-label={`Item menu: ${item.title}`} size="small" onPointerDown={(e) => e.stopPropagation()} onClick={(event) => ui.openMenu(event, 'small', item.id, parent.id)} sx={{ p: 0.1 }}><MoreHoriz sx={{ fontSize: 14 }} /></IconButton>
      {!compact && <div role="separator" aria-label="Resize item from right" className="small-handle right" onPointerDown={(event) => begin(event, { kind: 'small', mode: 'right', parentId: parent.id, id: item.id })} />}
    </div>
  );
}
