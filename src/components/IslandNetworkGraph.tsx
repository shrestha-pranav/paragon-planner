import React, { useMemo } from 'react';
import type { IslandNetwork, Island } from '../lib/islandOptimizer';

interface Props {
  network: IslandNetwork;
  unitMult: number;
}

export const IslandNetworkGraph: React.FC<Props> = ({ network, unitMult }) => {
  const { islands, links } = network;

  // Simple layout: stack regions vertically, islands in region horizontally
  const regionGroups = useMemo(() => {
    const groups: Record<string, Island[]> = {};
    islands.forEach(isl => {
      if (!groups[isl.region]) groups[isl.region] = [];
      groups[isl.region].push(isl);
    });
    return groups;
  }, [islands]);

  const islandPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    let currentY = 50;
    Object.entries(regionGroups).forEach(([_, isls]) => {
      let currentX = 50;
      isls.forEach(isl => {
        pos[isl.id] = { x: currentX, y: currentY };
        currentX += 300;
      });
      currentY += 250;
    });
    return pos;
  }, [regionGroups]);

  const BOX_WIDTH = 220;
  const BOX_HEIGHT = 160;

  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#1a1210', padding: '20px', borderRadius: '12px' }}>
      <svg width={Math.max(1200, islands.length * 200)} height={Object.keys(regionGroups).length * 300} style={{ fontFamily: 'sans-serif' }}>
        {/* Draw Links */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#d4a373" />
          </marker>
        </defs>

        {links.map((link, i) => {
          const start = islandPositions[link.from];
          const end = islandPositions[link.to];
          if (!start || !end) return null;

          const x1 = start.x + BOX_WIDTH;
          const y1 = start.y + 40 + (i % 5) * 20;
          const x2 = end.x;
          const y2 = end.y + 40 + (i % 5) * 20;

          return (
            <g key={`link-${i}`}>
              <path 
                d={`M ${x1} ${y1} C ${x1+50} ${y1}, ${x2-50} ${y2}, ${x2} ${y2}`} 
                stroke="#d4a373" 
                strokeWidth="1" 
                fill="none" 
                opacity="0.4"
                markerEnd="url(#arrowhead)"
              />
              <text x={(x1+x2)/2} y={(y1+y2)/2 - 5} fontSize="10" fill="#d4a373" textAnchor="middle" opacity="0.8">
                {link.item} ({(link.rate * unitMult).toFixed(1)})
              </text>
            </g>
          );
        })}

        {/* Draw Islands */}
        {islands.map(isl => {
          const pos = islandPositions[isl.id];
          return (
            <g key={isl.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect width={BOX_WIDTH} height={BOX_HEIGHT} rx="8" fill="#2b1d1a" stroke="#d4a373" strokeWidth="2" />
              <text x="10" y="25" fill="#d4a373" fontWeight="bold" fontSize="14">{isl.name}</text>
              <text x="10" y="45" fill="#f5ebe0" fontSize="11" opacity="0.7">{isl.totalSlots} Slots used</text>
              
              {/* Output Nodes (Green Circles) */}
              <g transform={`translate(${BOX_WIDTH}, 0)`}>
                {Object.entries(isl.outputs).map(([item, rate], idx) => (
                  <circle key={item} cx="0" cy={60 + idx * 15} r="5" fill="#8fb339">
                    <title>{`${item}: ${(rate * unitMult).toFixed(2)}`}</title>
                  </circle>
                ))}
              </g>

              {/* Input Nodes (Red Circles) */}
              <g transform="translate(0, 0)">
                {Object.entries(isl.inputs).map(([item, rate], idx) => (
                  <circle key={item} cx="0" cy={60 + idx * 15} r="5" fill="#e07a5f">
                    <title>{`${item}: ${(rate * unitMult).toFixed(2)}`}</title>
                  </circle>
                ))}
              </g>

              {/* Surplus/Extra Arrows */}
              {Object.entries(isl.outputs).map(([item, rate], idx) => {
                // Check if this output is fully used by links
                const used = links.filter(l => l.from === isl.id && l.item === item).reduce((a, b) => a + b.rate, 0);
                const extra = rate - used;
                if (extra > 0.01) {
                  return (
                    <line 
                      key={`extra-${item}`}
                      x1={BOX_WIDTH} y1={60 + idx * 15} 
                      x2={BOX_WIDTH + 20} y2={60 + idx * 15} 
                      stroke="#8fb339" strokeWidth="2" markerEnd="url(#arrowhead)" 
                    />
                  );
                }
                return null;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
