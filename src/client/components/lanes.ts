/** Geometry shared by the SVG lanes and the rows they line up with. */

export const ROW_HEIGHT = 38
const LANE_WIDTH = 16
const PADDING = 14

const LANE_COLORS = [
  '#3b82f6',
  '#f97316',
  '#10b981',
  '#a855f7',
  '#ef4444',
  '#0ea5e9',
  '#eab308',
  '#ec4899',
]

export const laneX = (lane: number) => PADDING + lane * LANE_WIDTH

export const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length] ?? LANE_COLORS[0]

export const graphWidth = (laneCount: number) => PADDING * 2 + (laneCount - 1) * LANE_WIDTH

/** A lane crossing into another one, bent halfway through the row. */
export const laneCurve = (
  fromLane: number,
  toLane: number,
  fromY: number,
  toY: number,
  midY: number,
) =>
  `M${laneX(fromLane)},${fromY}C${laneX(toLane)},${midY} ${laneX(toLane)},${midY} ${laneX(toLane)},${toY}`
