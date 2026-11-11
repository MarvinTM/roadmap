import { useState } from 'react';
import { TextField } from '@mui/material';

export default function InlineTitle({ title, editing, onEdit, onSave, onCancel, className = '' }) {
  const [value, setValue] = useState(title);
  if (!editing) return <span className={`inline-title ${className}`} title={title} onDoubleClick={(event) => { event.stopPropagation(); setValue(title); onEdit(); }}>{title}</span>;
  const finish = () => { if (value.trim()) onSave(value.trim()); else onCancel(); };
  return (
    <TextField
      autoFocus size="small" value={value} aria-label="Title"
      slotProps={{ htmlInput: { 'aria-label': 'Title', maxLength: 500 } }}
      onFocus={(event) => event.target.select()} onChange={(event) => setValue(event.target.value)}
      onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}
      onBlur={finish}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); finish(); }
        if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
      }}
      sx={{ flex: 1, minWidth: 30, bgcolor: 'white', borderRadius: 1, '& input': { py: 0.1, px: 0.5, fontSize: 12, height: 20 } }}
    />
  );
}
