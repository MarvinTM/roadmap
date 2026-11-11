import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { RoadmapProvider } from './state/RoadmapContext.jsx';
import App from './App.jsx';
import './styles.css';

const theme = createTheme({
  palette: { mode: 'light', background: { default: '#f5f7fa' } },
  typography: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', button: { textTransform: 'none' } },
  shape: { borderRadius: 8 },
  components: { MuiButton: { defaultProps: { disableElevation: true } } },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RoadmapProvider><App /></RoadmapProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
