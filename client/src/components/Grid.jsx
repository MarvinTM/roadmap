import { useEffect, useRef, useState } from 'react';
import { currentMonth, addMonths, diffMonths } from '@roadmap/shared';
import { columnWidth, ROW_HEIGHT, GRID_TOP, MONTH_HEADER, blockRect, trackHeight, HEADER_HEIGHT } from '../lib/geometry.js';
import BigBlock from './BigBlock.jsx';

export default function Grid({ doc, gridRef, colWidthRef, ui, begin, preview, extraRows }) {
  const [size, setSize] = useState({ width: 1200, height: 600 });
  const previousStart = useRef(doc.settings.startMonth);
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
        <div className="month-header" style={{ height: MONTH_HEADER }}>
          {Array.from({ length: monthsVisible }, (_, i) => {
            const month = addMonths(startMonth, i);
            return <div key={month} className={`month-label ${month === currentMonth() ? 'current-month' : ''} ${month.endsWith('-01') ? 'year-start' : ''}`} style={{ width: colWidth }}>
              <span>{new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span><small>{month.slice(0, 4)}</small>
            </div>;
          })}
        </div>
        <div className="grid-canvas" style={{
          height: Math.max(rows * ROW_HEIGHT, size.height - GRID_TOP), marginTop: GRID_TOP - MONTH_HEADER,
          '--column-width': `${colWidth}px`, '--quarter-width': `${colWidth / 4}px`,
        }}>
          {Array.from({ length: monthsVisible }, (_, i) => {
            const month = addMonths(startMonth, i);
            return month === currentMonth() || month.endsWith('-01') ? <div key={month} className={`column-highlight ${month === currentMonth() ? 'current-month' : ''} ${month.endsWith('-01') ? 'year-start' : ''}`} style={{ left: i * colWidth, width: colWidth }} /> : null;
          })}
          {visible.map((block) => <BigBlock key={block.id} block={block} colWidth={colWidth} startMonth={startMonth} monthsVisible={monthsVisible} ui={ui} begin={begin} />)}
          {ghost}
          {!doc.bigBlocks.length && <div className="grid-empty"><h2>Your roadmap, one block at a time.</h2><p>Create a big block in the backlog, then drag it here.<br />Double-click a track to add a story.</p></div>}
        </div>
      </div>
    </main>
  );
}
