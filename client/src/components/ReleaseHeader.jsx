import { IconButton } from '@mui/material';
import { MoreHoriz } from '@mui/icons-material';
import { diffMonths, formatMonth, isMonth, releasePeriods } from '@roadmap/shared';
import { RELEASE_HEADER } from '../lib/geometry.js';

export default function ReleaseHeader({ releases, startMonth, monthsVisible, colWidth, ui, begin, preview }) {
  const position = (release) => (diffMonths(release.month, startMonth) + 1) * colWidth;
  const visible = releasePeriods(releases, startMonth, monthsVisible);
  const byId = new Map(releases.map((release) => [release.id, release]));
  return <div className="release-strip" style={{ height: RELEASE_HEADER }} aria-label="Release timeline">
    {!releases.length && <span className="release-empty">Release boundaries appear here</span>}
    {visible.map((period) => {
      const release = byId.get(period.id);
      return <div key={release.id} data-release-id={release.id} className="release-label"
      style={{ left: period.left * colWidth + 4, width: period.width * colWidth - 5, color: release.color, backgroundColor: `${release.color}14`,
        borderColor: position(release) <= monthsVisible * colWidth ? release.color : 'transparent' }}>
      <div role="button" tabIndex={0} aria-label={`Move release: ${release.title}`} className="release-grab"
        title={`${release.title} · ends ${formatMonth(release.month)} · drag to move`}
        onPointerDown={(event) => begin(event, { kind: 'release', mode: 'move', id: release.id })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); ui.editRelease(release.id, 'month'); }
        }}>{release.title}</div>
      <IconButton size="small" aria-label={`Release menu: ${release.title}`} sx={{ color: 'inherit', p: 0.1 }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => ui.openMenu(event, 'release', release.id)}><MoreHoriz sx={{ fontSize: 16 }} /></IconButton>
    </div>;
    })}
    {preview?.release && isMonth(preview.release.month) && preview.target === 'grid' &&
      <div className={`release-header-preview ${preview.valid ? 'valid' : 'invalid'}`} style={{ left: position(preview.release) - 1 }} />}
  </div>;
}
