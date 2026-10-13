import { useMemo, useState } from 'react';
import type { PertNetwork, PertNode } from '@gantt/shared';
import { EmptyState } from '../ui/States';

const NODE_WIDTH = 176;
const NODE_HEIGHT = 92;
const COLUMN_GAP = 60;
const ROW_GAP = 18;
const PADDING = 24;

interface PositionedNode {
  node: PertNode;
  x: number;
  y: number;
}

interface PertDiagramProps {
  network: PertNetwork;
}

export function PertDiagram({ network }: PertDiagramProps) {
  const [scale, setScale] = useState(1);

  const { nodes, width, height } = useMemo(() => {
    const byColumn = new Map<number, PertNode[]>();
    for (const node of network.nodes) {
      const list = byColumn.get(node.column) ?? [];
      list.push(node);
      byColumn.set(node.column, list);
    }
    const positioned: PositionedNode[] = [];
    let maxRows = 1;
    for (const [column, list] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
      const ordered = [...list].sort((a, b) => a.es - b.es || a.name.localeCompare(b.name));
      maxRows = Math.max(maxRows, ordered.length);
      ordered.forEach((node, index) => {
        positioned.push({
          node,
          x: PADDING + column * (NODE_WIDTH + COLUMN_GAP),
          y: PADDING + index * (NODE_HEIGHT + ROW_GAP),
        });
      });
    }
    const columns = byColumn.size;
    return {
      nodes: positioned,
      width: PADDING * 2 + columns * NODE_WIDTH + Math.max(0, columns - 1) * COLUMN_GAP,
      height: PADDING * 2 + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP,
    };
  }, [network]);

  const positionById = useMemo(
    () => new Map(nodes.map((item) => [item.node.id, item])),
    [nodes],
  );

  if (network.nodes.length === 0) {
    return <EmptyState title="Belum ada tugas daun" description="Tambahkan tugas untuk melihat diagram PERT." />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <button type="button" className="btn-secondary px-2 py-1" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}>
          Perkecil
        </button>
        <button type="button" className="btn-secondary px-2 py-1" onClick={() => setScale((s) => Math.min(1.6, s + 0.1))}>
          Perbesar
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <span className="ml-2 inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-red-600 bg-red-100" /> Node kritis
        </span>
        {network.totalVariance !== null ? (
          <span className="ml-auto">
            Total variansi jalur kritis: {network.totalVariance} · Simpangan baku: {network.stdDeviation}
          </span>
        ) : null}
      </div>
      <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200 bg-slate-50">
        <svg
          width={width * scale}
          height={height * scale}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Diagram PERT"
        >
          <defs>
            <marker id="pert-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
            <marker id="pert-arrow-critical" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
            </marker>
          </defs>

          {network.edges.map((edge, index) => {
            const from = positionById.get(edge.from);
            const to = positionById.get(edge.to);
            if (!from || !to) return null;
            const startX = from.x + NODE_WIDTH;
            const startY = from.y + NODE_HEIGHT / 2;
            const endX = to.x;
            const endY = to.y + NODE_HEIGHT / 2;
            const midX = (startX + endX) / 2;
            const path = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
            return (
              <path
                key={`${edge.from}-${edge.to}-${index}`}
                d={path}
                fill="none"
                stroke={edge.critical ? '#dc2626' : '#94a3b8'}
                strokeWidth={edge.critical ? 2 : 1.25}
                markerEnd={edge.critical ? 'url(#pert-arrow-critical)' : 'url(#pert-arrow)'}
                data-testid={`pert-edge-${edge.from}-${edge.to}`}
              />
            );
          })}

          {nodes.map(({ node, x, y }) => (
            <g
              key={node.id}
              data-testid={`pert-node-${node.id}`}
              data-critical={node.critical ? 'true' : 'false'}
            >
              <rect
                x={x}
                y={y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
                fill={node.critical ? '#fee2e2' : '#ffffff'}
                stroke={node.critical ? '#dc2626' : '#cbd5e1'}
                strokeWidth={node.critical ? 2 : 1}
              />
              <text x={x + 8} y={y + 16} fontSize={11} fontWeight={600} fill={node.critical ? '#991b1b' : '#0f172a'}>
                {node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name}
              </text>
              <text x={x + 8} y={y + 32} fontSize={10} fill="#475569">
                Durasi: {node.durationDays} hari
              </text>
              <text x={x + 8} y={y + 46} fontSize={10} fill="#475569">
                ES/EF: {node.es} / {node.ef}
              </text>
              <text x={x + 8} y={y + 60} fontSize={10} fill="#475569">
                LS/LF: {node.ls} / {node.lf}
              </text>
              <text x={x + 8} y={y + 74} fontSize={10} fill="#475569">
                Slack: {node.slack}
              </text>
              {node.expectedDays !== null ? (
                <text x={x + 8} y={y + 87} fontSize={10} fill="#7c3aed">
                  te: {node.expectedDays} hari
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
