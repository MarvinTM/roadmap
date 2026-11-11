import { useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Check } from '@mui/icons-material';
import { COLORS, nextReleaseMonth } from '@roadmap/shared';
import { useRoadmap } from '../state/RoadmapContext.jsx';
import { changeDocument } from '../state/reducer.js';

export default function ReleaseDialog({ selection, onClose }) {
  const { doc, act } = useRoadmap();
  const release = doc.releases.find((release) => release.id === selection.id);
  const [form, setForm] = useState(() => ({
    title: release?.title || '',
    month: release?.month || nextReleaseMonth(doc),
    color: release?.color || COLORS[doc.releases.length % COLORS.length],
  }));
  const [error, setError] = useState('');
  const nameInput = useRef(null);
  const monthInput = useRef(null);
  const submit = (event) => {
    event.preventDefault();
    const values = { ...form, title: form.title.trim() };
    const action = release
      ? { type: 'updateRelease', id: release.id, patch: values, reveal: true }
      : { type: 'addRelease', id: crypto.randomUUID(), ...values };
    try { changeDocument(doc, action); act(action); onClose(); }
    catch (error) { setError(error.message); }
  };
  return <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ component: 'form', onSubmit: submit }}
    slotProps={{ transition: { onEntered: () => (selection.focus === 'month' ? monthInput : nameInput).current?.focus() } }}>
    <DialogTitle>{release ? 'Edit release' : 'Create release'}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField inputRef={nameInput} autoFocus={selection.focus !== 'month'} label="Release name" required value={form.title}
          onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} />
        <TextField inputRef={monthInput} autoFocus={selection.focus === 'month'} type="month" label="End month" required value={form.month}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => setForm((old) => ({ ...old, month: event.target.value }))} />
        <Typography variant="caption" color="text.secondary">The line appears after this month. Moving a release never moves its blocks.</Typography>
        <div className="palette" role="group" aria-label="Release color">
          {COLORS.map((color) => <Tooltip key={color} title={color}><IconButton aria-label={`Color ${color}`} aria-pressed={form.color === color}
            onClick={() => setForm((old) => ({ ...old, color }))} style={{ backgroundColor: color, color: 'white', width: 30, height: 30 }}>
            {form.color === color && <Check sx={{ fontSize: 20 }} />}
          </IconButton></Tooltip>)}
        </div>
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">{release ? 'Apply' : 'Create release'}</Button></DialogActions>
  </Dialog>;
}
