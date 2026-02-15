/* ============================================================
   EYES ONLY — Ops UI: Lane Grid Component
   Subway-style SVG lane visualization.
   Each lane is a horizontal track with station dots.
   ============================================================ */

import type { Lane } from '../store';

interface LaneGridProps {
  lanes: Lane[];
  actorLane?: string;
}

const LANE_COLORS = [
  '#33ff33', '#3399ff', '#ffaa33', '#ff3333',
  '#ff33ff', '#33ffff', '#ffff33', '#aa33ff',
];

const LANE_HEIGHT = 50;
const PADDING = 20;
const STATION_RADIUS = 8;
const TRACK_WIDTH = 3;

export function LaneGrid({ lanes, actorLane }: LaneGridProps) {
  const width = 320;
  const height = lanes.length * LANE_HEIGHT + PADDING * 2;

  return (
    <div class="lane-grid">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto' }}
      >
        {/* Background */}
        <rect width={width} height={height} fill="#0a0a0a" rx="4" />

        {/* Lanes */}
        {lanes.map((lane, i) => {
          const y = PADDING + i * LANE_HEIGHT + LANE_HEIGHT / 2;
          const color = LANE_COLORS[i % LANE_COLORS.length];
          const isActive = actorLane === lane.lane_id;

          return (
            <g key={lane.lane_id}>
              {/* Track line */}
              <line
                x1={PADDING}
                y1={y}
                x2={width - PADDING}
                y2={y}
                stroke={color}
                stroke-width={TRACK_WIDTH}
                opacity={isActive ? 1 : 0.4}
              />

              {/* Station dot (left) */}
              <circle
                cx={PADDING + 20}
                cy={y}
                r={STATION_RADIUS}
                fill={isActive ? color : '#0a0a0a'}
                stroke={color}
                stroke-width={2}
              />

              {/* Station dot (right) */}
              <circle
                cx={width - PADDING - 20}
                cy={y}
                r={STATION_RADIUS / 2}
                fill={color}
                opacity={0.5}
              />

              {/* Actor indicator (pulsing) */}
              {isActive && (
                <>
                  <circle
                    cx={PADDING + 20}
                    cy={y}
                    r={STATION_RADIUS + 4}
                    fill="none"
                    stroke={color}
                    stroke-width={1.5}
                    opacity={0.6}
                  >
                    <animate
                      attributeName="r"
                      from={String(STATION_RADIUS + 2)}
                      to={String(STATION_RADIUS + 10)}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <text
                    x={PADDING + 38}
                    y={y - 10}
                    fill={color}
                    font-size="9"
                    font-family="'Courier New', monospace"
                    letter-spacing="1"
                  >
                    YOU ARE HERE
                  </text>
                </>
              )}

              {/* Lane label */}
              <text
                x={PADDING + 38}
                y={y + (isActive ? 5 : 4)}
                fill={isActive ? color : '#666'}
                font-size="11"
                font-family="'Courier New', monospace"
                font-weight={isActive ? 'bold' : 'normal'}
                letter-spacing="1"
              >
                {lane.label.toUpperCase()}
              </text>

              {/* Lane ID badge */}
              <text
                x={width - PADDING - 40}
                y={y + 4}
                fill="#444"
                font-size="9"
                font-family="'Courier New', monospace"
                text-anchor="end"
              >
                {lane.lane_id}
              </text>
            </g>
          );
        })}

        {/* Title */}
        <text
          x={width / 2}
          y={height - 6}
          fill="#333"
          font-size="8"
          font-family="'Courier New', monospace"
          text-anchor="middle"
          letter-spacing="2"
        >
          LANE GRID — OPERATIONAL MAP
        </text>
      </svg>
    </div>
  );
}
