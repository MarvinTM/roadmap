import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Menu, MenuItem, Divider, Snackbar, Typography } from '@mui/material';
import { useRoadmap } from './state/RoadmapContext.jsx';
import useGridDrag from './dnd/useGridDrag.js';
import TopBar from './components/TopBar.jsx';
import Backlog from './components/Backlog.jsx';
import Grid from './components/Grid.jsx';
import EditDialog, { LeftResizeDialog } from './components/EditDialog.jsx';
import JiraLinkPopover from './components/JiraLinkPopover.jsx';
import ReleaseDialog from './components/ReleaseDialog.jsx';

export default function App() {
  const { doc, act, status, message, reload, undo, error } = useRoadmap();
  const gridRef = useRef(null);
  const colWidthRef = useRef(120);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const pendingMenuAction = useRef(null);
  const [dialog, setDialog] = useState(null);
  const drag = useGridDrag({ doc, act, gridRef, colWidthRef });
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => act({ type: 'clearUndo' }), 5000);
    return () => clearTimeout(timer);
  }, [undo, act]);
  const addSmall = (parentId, slot) => {
    const id = crypto.randomUUID();
    act({ type: 'addSmall', parentId, id, slot });
    setExpanded((old) => new Set([...old, parentId]));
    setEditing(id);
  };
  const ui = { editing, setEditing, addSmall, editRelease: (id, focus) => setDialog({ type: 'release', id, focus }), openMenu: (event, type, id, parentId) => {
    event.stopPropagation(); setMenu({ anchor: event.currentTarget, type, id, parentId });
  } };
  if (!doc) return <Box sx={{ height: '100vh', display: 'grid', placeItems: 'center', p: 4 }}>
    {status === 'loadError' ? <Alert severity="error" action={<Button onClick={reload}>Retry</Button>}>{message}</Alert> : <CircularProgress aria-label="Loading roadmap" />}
  </Box>;
  const menuParent = menu && doc.bigBlocks.find((b) => b.id === (menu.parentId || menu.id));
  const menuItem = menu?.type === 'small' ? menuParent?.smallBlocks.find((s) => s.id === menu.id) : null;
  const runMenu = (fn) => { pendingMenuAction.current = fn; setMenu(null); };
  return (
    <div className="app">
      <TopBar onAdd={() => {
        const id = crypto.randomUUID();
        act({ type: 'addBig', id }); setCollapsed(false); setEditing(id);
      }} onAddRelease={() => setDialog({ type: 'release' })} />
      <div className="workspace">
        <Backlog ui={ui} begin={drag.begin} collapsed={collapsed} setCollapsed={setCollapsed} expanded={expanded} setExpanded={setExpanded} preview={drag.preview} />
        <Grid doc={doc} gridRef={gridRef} colWidthRef={colWidthRef} ui={ui} begin={drag.begin} preview={drag.preview} extraRows={drag.extraRows} />
      </div>
      <div className="help-bar"><span>Drag headers to move · Drag edges to resize · Double-click a track to add an item</span><span>Menus provide keyboard-accessible alternatives · Esc cancels dragging</span></div>
      {drag.preview && <div role="status" className={`drag-label ${drag.preview.valid ? '' : 'invalid-label'}`} style={{ left: Math.max(8, Math.min(window.innerWidth - 330, drag.preview.x + 14)), top: Math.min(window.innerHeight - 46, drag.preview.y + 20) }}>{drag.preview.label}</div>}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}
        slotProps={{ transition: { onExited: () => {
          // Finish restoring menu focus before mounting an autofocused editor.
          const action = pendingMenuAction.current;
          pendingMenuAction.current = null;
          action?.();
        } } }}>
        <MenuItem onClick={() => runMenu(() => menu.type === 'release' ? setDialog({ type: 'release', id: menu.id }) : setEditing(menu.id))}>Rename</MenuItem>
        <MenuItem onClick={() => runMenu(() => setDialog({ ...menu, anchor: undefined }))}>{menu?.type === 'release' ? 'Change month & color' : menu?.type === 'big' ? 'Schedule, move, resize & color' : 'Move, resize & edit'}</MenuItem>
        {menu?.type === 'big' && [
          <MenuItem key="add" onClick={() => runMenu(() => addSmall(menu.id))}>Add item</MenuItem>,
          menuParent?.placement && <MenuItem key="left" onClick={() => runMenu(() => setDialog({ type: 'left', id: menu.id }))}>Resize from left</MenuItem>,
          menuParent?.placement && <MenuItem key="unschedule" onClick={() => runMenu(() => act({ type: 'updateBig', id: menu.id, patch: { placement: null } }))}>Unschedule</MenuItem>,
        ]}
        {menu?.type === 'small' && menuItem && <MenuItem onClick={() => runMenu(() => act({ type: 'updateSmall', parentId: menu.parentId, id: menu.id, patch: { done: !menuItem.done } }))}>{menuItem.done ? 'Mark as not done' : 'Mark as done'}</MenuItem>}
        {menu?.type === 'small' && <MenuItem onClick={() => runMenu(() => setDialog({ ...menu, type: 'link' }))}>Edit link</MenuItem>}
        <Divider />
        <MenuItem sx={{ color: 'error.main' }} onClick={() => runMenu(() => act(menu.type === 'release' ? { type: 'deleteRelease', id: menu.id } : menu.type === 'big' ? { type: 'deleteBig', id: menu.id } : { type: 'deleteSmall', parentId: menu.parentId, id: menu.id }))}>Delete</MenuItem>
      </Menu>
      {dialog && (dialog.type === 'left'
        ? <LeftResizeDialog key={dialog.id} block={doc.bigBlocks.find((b) => b.id === dialog.id)} onClose={() => setDialog(null)} />
        : dialog.type === 'release' ? <ReleaseDialog key={dialog.id || 'new-release'} selection={dialog} onClose={() => setDialog(null)} />
        : dialog.type === 'link' ? <JiraLinkPopover key={dialog.id} selection={dialog} onClose={() => setDialog(null)} />
        : <EditDialog key={dialog.id} selection={dialog} onClose={() => setDialog(null)} />)}
      <Snackbar open={Boolean(undo)} key={undo?.token || 'undo'} message="Deleted" anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        action={<Button color="inherit" size="small" onClick={() => act({ type: 'restore', undo, fallbackId: crypto.randomUUID() })}>Undo</Button>} />
      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => act({ type: 'clearError' })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="warning" onClose={() => act({ type: 'clearError' })}>{error}</Alert>
      </Snackbar>
      <Dialog open={status === 'conflict'} aria-labelledby="conflict-title">
        <DialogTitle id="conflict-title">Someone else just changed the roadmap</DialogTitle>
        <DialogContent><DialogContentText>Your last change was made at the same moment as theirs and could not be saved. Reload to see their changes, then redo yours.</DialogContentText></DialogContent>
        <DialogActions><Button variant="contained" onClick={reload}>Reload latest</Button></DialogActions>
      </Dialog>
      {status === 'loadError' && <Alert severity="error" sx={{ position: 'fixed', bottom: 40, left: '25%', right: '25%' }} action={<Button onClick={reload}>Retry reload</Button>}>{message}</Alert>}
      <Typography component="span" className="sr-only" aria-live="polite">{status === 'error' ? message : ''}</Typography>
    </div>
  );
}
