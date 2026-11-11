import { useState } from 'react';
import { Alert, Button, Popover, Stack, TextField, Typography } from '@mui/material';
import { validUrl } from '@roadmap/shared';
import { useRoadmap } from '../state/RoadmapContext.jsx';

export default function JiraLinkPopover({ selection, onClose }) {
  const { doc, act } = useRoadmap();
  const parent = doc.bigBlocks.find((block) => block.id === selection.parentId);
  const item = parent.smallBlocks.find((item) => item.id === selection.id);
  const [url, setUrl] = useState(item.jiraUrl || '');
  const [error, setError] = useState('');
  const save = (event) => {
    event.preventDefault();
    const jiraUrl = url.trim() || null;
    if (!validUrl(jiraUrl)) { setError('Enter an HTTP or HTTPS URL without embedded credentials.'); return; }
    act({ type: 'updateSmall', parentId: parent.id, id: item.id, patch: { jiraUrl } });
    onClose();
  };
  return <Popover open anchorEl={selection.anchor} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
    <Stack component="form" onSubmit={save} spacing={2} sx={{ p: 2, width: 360 }}>
      <Typography variant="subtitle2">Jira link · {item.title}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField autoFocus size="small" label="Jira URL (optional)" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://company.atlassian.net/browse/PROJ-123" helperText="Leave blank to remove the link." />
      <Stack direction="row" spacing={1} justifyContent="flex-end"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Save link</Button></Stack>
    </Stack>
  </Popover>;
}
