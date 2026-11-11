import { AppBar, Toolbar, Typography, IconButton, Button, TextField, Tooltip, Chip, Checkbox, FormControlLabel } from '@mui/material';
import { ChevronLeft, ChevronRight, Today, Add, Remove, CheckCircleOutline, Sync, ErrorOutline, FlagOutlined } from '@mui/icons-material';
import { addMonths, currentMonth } from '@roadmap/shared';
import { useRoadmap } from '../state/RoadmapContext.jsx';

export default function TopBar({ onAdd, onAddRelease }) {
  const { doc, act, status, message, retrySave } = useRoadmap();
  const { startMonth, monthsVisible } = doc.settings;
  const settings = (patch) => act({ type: 'settings', settings: patch });
  const labels = { saved: 'Saved', pending: 'Unsaved', saving: 'Saving...', error: 'Save failed - retry', conflict: 'Save conflict', loading: 'Loading...' };
  return (
    <AppBar position="static" color="inherit" elevation={0} className="top-bar">
      <Toolbar variant="dense" sx={{ gap: 1, minHeight: 68, flexWrap: 'wrap', py: 1 }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 750, mr: 1 }}>ai<span style={{ color: '#1976d2' }}>Roadmap</span></Typography>
        <Tooltip title="Previous month"><IconButton aria-label="Previous month" onClick={() => settings({ startMonth: addMonths(startMonth, -1) })}><ChevronLeft /></IconButton></Tooltip>
        <Button startIcon={<Today />} color="inherit" onClick={() => settings({ startMonth: currentMonth() })}>Today</Button>
        <Tooltip title="Next month"><IconButton aria-label="Next month" onClick={() => settings({ startMonth: addMonths(startMonth, 1) })}><ChevronRight /></IconButton></Tooltip>
        <TextField label="From" type="month" size="small" value={startMonth} onChange={(e) => { if (e.target.value) settings({ startMonth: e.target.value }); }} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 168, ml: 1 }} />
        <Typography variant="body2" sx={{ ml: 1 }}>Months</Typography>
        <IconButton aria-label="Show fewer months" size="small" disabled={monthsVisible <= 3} onClick={() => settings({ monthsVisible: monthsVisible - 1 })}><Remove fontSize="small" /></IconButton>
        <Typography aria-label="Visible months" sx={{ minWidth: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{monthsVisible}</Typography>
        <IconButton aria-label="Show more months" size="small" disabled={monthsVisible >= 36} onClick={() => settings({ monthsVisible: monthsVisible + 1 })}><Add fontSize="small" /></IconButton>
        <FormControlLabel sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 12, whiteSpace: 'nowrap' } }}
          control={<Checkbox size="small" checked={doc.settings.tintReleasePeriods} onChange={(event) => settings({ tintReleasePeriods: event.target.checked })} />}
          label="Tint release periods" />
        <Button variant="outlined" startIcon={<FlagOutlined />} onClick={onAddRelease} sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>Release</Button>
        <Button variant="contained" startIcon={<Add />} onClick={onAdd} sx={{ whiteSpace: 'nowrap' }}>Big block</Button>
        <Tooltip title={['error', 'conflict'].includes(status) ? message : 'Changes are saved automatically to this computer'}>
          <Chip
            size="small" aria-live="polite" label={labels[status] || status}
            icon={status === 'saved' ? <CheckCircleOutline /> : ['error', 'conflict'].includes(status) ? <ErrorOutline /> : <Sync />}
            color={['error', 'conflict'].includes(status) ? 'error' : 'default'}
            onClick={status === 'error' ? retrySave : undefined}
            variant="outlined"
          />
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
