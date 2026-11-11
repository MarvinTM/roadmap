import { useEffect, useRef, useState } from 'react';
import { currentMonth, addMonths, diffMonths, isMonth, releasePeriods } from '@roadmap/shared';
import { columnWidth, ROW_HEIGHT, GRID_TOP, GRID_HEADER, MONTH_HEADER, blockRect, trackHeight, HEADER_HEIGHT } from '../lib/geometry.js';
import BigBlock from './BigBlock.jsx';
import ReleaseHeader from './ReleaseHeader.jsx';

export default function Grid({ doc, gridRef, colWidthRef, ui, begin, preview, extraRows }) {
  const [size, setSize] = useState({ width: 1200, height: 600 });
  const previousStart = useRef(doc.settings.startMonth);
  const previousReleases = useRef(new Map(doc.releases.map((release) => [release.id, release.month])));
  const { startMonth, monthsVisible } = doc.settings;
  const colWidth = columnWidth(size.width, monthsVisible);
  colWidthRef.current = colWidth;
  useEffect(() => {
    const node = gridRef.current;
    const observer = new ResizeObserver(() => setSize({ width: node.clientWidth, height: node.clientHeight }));
    observer.observe(node);
    return () => observer.disconnect();
  }, [gridRef]);
  useEffect(() => {
    const delta = diffMonths(startMonth, previousStart.current);
    previousStart.current = startMonth;
    if (delta && !preview) { gridRef.current.scrollLeft = 0; }
  }, [startMonth, gridRef, preview]);
  useEffect(() => {
    const changed = doc.releases.find((release) => previousReleases.current.get(release.id) !== release.month);
    previousReleases.current = new Map(doc.releases.map((release) => [release.id, release.month]));
    if (!changed) return;
    const end = (diffMonths(changed.month, startMonth) + 1) * colWidth;
    if (end <= 0 || end > monthsVisible * colWidth) return;
    const grid = gridRef.current;
    const left = Math.max(0, end - colWidth + 8);
    if (left < grid.scrollLeft) grid.scrollLeft = left;
    else if (end > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = end - grid.clientWidth;
  }, [doc.releases, startMonth, monthsVisible, colWidth, gridRef]);
  const scheduled = doc.bigBlocks.filter((b) => b.placement);
  const rows = Math.max(1, ...scheduled.map((b) => b.placement.row + b.rows + 1), extraRows);
  const visible = scheduled.filter((b) => diffMonths(b.placement.start, startMonth) < monthsVisible && diffMonths(b.placement.start, startMonth) + b.months > 0);
  let ghost = null;
  if (preview?.block?.placement && preview.target === 'grid') {
    const rect = blockRect(preview.block, colWidth, startMonth);
    if (preview.item) {
      // Include the block's outer gap, border, and the item's 2 px inset.
      rect.left += preview.item.offset * colWidth / 4 + 5;
      rect.top += HEADER_HEIGHT + preview.item.track * trackHeight(preview.block.rows) + 4;
      rect.width = preview.item.length * colWidth / 4 - 4;
      rect.height = trackHeight(preview.block.rows) - 4;
    }
    ghost = <div className={`drag-ghost ${preview.valid ? 'valid' : 'invalid'}`} style={rect} />;
  }
  return (
    <main ref={gridRef} className={`grid-scroll ${preview?.kind === 'small' ? 'is-small-drag' : ''}`} aria-label="Roadmap grid" tabIndex={0}>
      <div className="grid-content" style={{ width: colWidth * monthsVisible, minHeight: '100%' }}>
        <div className="calendar-header">
          <div className="month-header" style={{ height: MONTH_HEADER }}>
          {Array.from({ length: monthsVisible }, (_, i) => {
            const month = addMonths(startMonth, i);
            return <div key={month} className={`month-label ${month === currentMonth() ? 'current-month' : ''} ${month.endsWith('-01') ? 'year-start' : ''}`} style={{ width: colWidth }}>
              <span>{new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span><small>{month.slice(0, 4)}</small>
            </div>;
          })}
          </div>
          <ReleaseHeader releases={doc.releases} startMonth={startMonth} monthsVisible={monthsVisible} colWidth={colWidth} ui={ui} begin={begin} preview={preview} />
        </div>
        <div className="grid-canvas" style={{
          height: Math.max(rows * ROW_HEIGHT, size.height - GRID_TOP), marginTop: GRID_TOP - GRID_HEADER,
          '--column-width': `${colWidth}px`, '--quarter-width': `${colWidth / 4}px`,
        }}>
          {Array.from({ length: monthsVisible }, (_, i) => {
            const month = addMonths(startMonth, i);
            return month === currentMonth() || month.endsWith('-01') ? <div key={month} className={`column-highlight ${month === currentMonth() ? 'current-month' : ''} ${month.endsWith('-01') ? 'year-start' : ''}`} style={{ left: i * colWidth, width: colWidth }} /> : null;
          })}
          {doc.settings.tintReleasePeriods && releasePeriods(doc.releases, startMonth, monthsVisible).map((period) =>
            <div key={period.id} className="release-tint" data-release-tint={period.id}
              style={{ left: period.left * colWidth, width: period.width * colWidth, backgroundColor: period.color }} />)}
          {visible.map((block) => <BigBlock key={block.id} block={block} colWidth={colWidth} startMonth={startMonth} monthsVisible={monthsVisible} ui={ui} begin={begin} />)}
          {doc.releases.map((release) => <div key={release.id} className="release-boundary" data-release-line={release.id}
            style={{ left: (diffMonths(release.month, startMonth) + 1) * colWidth - 1, borderColor: release.color }} />)}
          {preview?.release && isMonth(preview.release.month) && preview.target === 'grid' &&
            <div data-release-preview className={`release-boundary release-preview ${preview.valid ? 'valid' : 'invalid'}`}
              style={{ left: (diffMonths(preview.release.month, startMonth) + 1) * colWidth - 1 }} />}
          {ghost}
          {!doc.bigBlocks.length && <div className="grid-empty"><h2>Your roadmap, one block at a time.</h2><p>Create a big block in the backlog, then drag it here.<br />Double-click a track to add a story.</p></div>}
        </div>
      </div>
    </main>
  );
}
