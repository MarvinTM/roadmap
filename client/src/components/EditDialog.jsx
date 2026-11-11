import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, MenuItem, Alert, FormControlLabel, Checkbox, IconButton, Tooltip, Typography } from '@mui/material';
import { Check } from '@mui/icons-material';
import { COLORS, currentMonth, resizedBig } from '@roadmap/shared';
import { useRoadmap } from '../state/RoadmapContext.jsx';
import { changeDocument } from '../state/reducer.js';

export default function EditDialog({ selection, onClose }) {
  const { doc, act } = useRoadmap();
  const parent = doc.bigBlocks.find((b) => b.id === (selection.parentId || selection.id));
  const item = selection.type === 'small' ? parent?.smallBlocks.find((s) => s.id === selection.id) : null;
  const [form, setForm] = useState(() => item ? {
    title: item.title, jiraUrl: item.jiraUrl || '', targetId: parent.id, track: item.track + 1,
    offset: item.offset + 1, length: item.length,
  } : {
    title: parent.title, color: parent.color, scheduled: Boolean(parent.placement),
    start: parent.placement?.start || doc.settings.startMonth || currentMonth(), row: (parent.placement?.row || 0) + 1,
    months: parent.months, rows: parent.rows,
  });
  const [error, setError] = useState('');
  const change = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const numberField = (key, label, min = 1) => <TextField fullWidth type="number" label={label} value={form[key]} onChange={change(key)} slotProps={{ htmlInput: { min, step: 1 } }} />;
  const submit = (event) => {
    event.preventDefault();
    let action;
    if (item) {
      const target = doc.bigBlocks.find((b) => b.id === form.targetId);
      action = {
        type: 'updateSmall', parentId: parent.id, id: item.id, targetId: target.id,
        autoSlot: !target.placement && target.id !== parent.id,
        patch: { title: form.title.trim(), jiraUrl: form.jiraUrl.trim() || null, track: Number(form.track) - 1, offset: Number(form.offset) - 1, length: Number(form.length) },
      };
    } else {
      // Start changes in this dialog move the whole block; edge drags alone anchor items.
      const patch = { title: form.title.trim(), color: form.color, months: Number(form.months), rows: Number(form.rows),
        placement: form.scheduled ? { start: form.start, row: Number(form.row) - 1 } : null };
      // Only changing rows in place reflows the blocks below; other changes still reject overlaps.
      const onlyRowsChange = parent.placement && patch.placement && patch.rows !== parent.rows && patch.months === parent.months &&
        patch.placement.start === parent.placement.start && patch.placement.row === parent.placement.row;
      action = { type: 'updateBig', id: parent.id, patch, reflowBelow: Boolean(onlyRowsChange) };
    }
    try { changeDocument(doc, action); act(action); onClose(); }
    catch (error) { setError(error.message); }
  };
  const target = item && doc.bigBlocks.find((b) => b.id === form.targetId);
  const automatic = item && !target?.placement && target?.id !== parent.id;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>{item ? 'Edit item' : 'Edit big block'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField autoFocus label="Title" value={form.title} onChange={change('title')} required />
          {item ? <>
            <TextField label="Jira URL (optional)" type="url" placeholder="https://company.atlassian.net/browse/PROJ-123" value={form.jiraUrl} onChange={change('jiraUrl')} helperText="HTTP or HTTPS links only." />
            <TextField select label="Parent block" value={form.targetId} onChange={change('targetId')}>
              {doc.bigBlocks.map((b) => <MenuItem key={b.id} value={b.id}>{b.title}{!b.placement ? ' (backlog)' : ''}</MenuItem>)}
            </TextField>
            {automatic ? <Typography variant="body2" color="text.secondary">The item will use the first free slot. The backlog block will grow if needed.</Typography> :
              <Stack direction="row" spacing={1}>{numberField('track', 'Track')}{numberField('offset', 'Start quarter')}</Stack>}
            {numberField('length', 'Length in quarters')}
            <Typography variant="caption" color="text.secondary">Track and start quarter count from 1. Four quarters equal one month.</Typography>
          </> : <>
            <div className="palette" role="group" aria-label="Block color">
              {COLORS.map((color) => <Tooltip key={color} title={color}><IconButton aria-label={`Color ${color}`} aria-pressed={form.color === color}
                onClick={() => setForm((old) => ({ ...old, color }))} style={{ backgroundColor: color, color: 'white', width: 30, height: 30 }}>
                {form.color === color && <Check sx={{ fontSize: 20 }} />}
              </IconButton></Tooltip>)}
            </div>
            <Stack direction="row" spacing={1}>{numberField('months', 'Months')}{numberField('rows', 'Rows / tracks')}</Stack>
            <FormControlLabel control={<Checkbox checked={form.scheduled} onChange={change('scheduled')} />} label="Scheduled on roadmap" />
            {form.scheduled && <Stack direction="row" spacing={1}>
              <TextField fullWidth type="month" label="Start month" value={form.start} onChange={change('start')} required slotProps={{ inputLabel: { shrink: true } }} />
              {numberField('row', 'Top row')}
            </Stack>}
            <Typography variant="caption" color="text.secondary">Rows count from 1. Items must fit and blocks cannot overlap, except that adding rows pushes the blocks below down (and removing rows pulls stacked blocks back up). Changing the start month moves all items with the block.</Typography>
            {parent.placement && <Typography variant="caption" color="text.secondary">To resize from the left without moving items, use the left-edge controls in the block menu.</Typography>}
          </>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Apply</Button></DialogActions>
    </Dialog>
  );
}

export function LeftResizeDialog({ block, onClose }) {
  const { doc, act } = useRoadmap();
  const [delta, setDelta] = useState(0);
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const candidate = resizedBig(block, 'left', Number(delta));
    const action = { type: 'updateBig', id: block.id, patch: candidate };
    try { changeDocument(doc, action); act(action); onClose(); }
    catch (error) { setError(error.message); }
  };
  return <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
    <DialogTitle>Resize from left</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField autoFocus type="number" label="Shift left edge by months" value={delta} onChange={(e) => setDelta(e.target.value)} slotProps={{ htmlInput: { step: 1 } }} />
      <Typography variant="body2">Positive values shrink the block; negative values extend it. Items stay in their calendar months.</Typography>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Apply</Button></DialogActions>
  </Dialog>;
}
