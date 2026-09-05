import type { MigrationRow } from '../../shared/types'
import { cx } from '../cx'
import { ROW_HEIGHT, graphWidth, laneColor, laneCurve, laneX } from './lanes'

type Props = {
  rows: MigrationRow[]
  laneCount: number
  onSelect: (folder: string) => void
}

/** The git-log-style lanes, rebuilt from each snapshot's prevIds. One row per migration. */
export const GraphLanes = ({ rows, laneCount, onSelect }: Props) => {
  const width = graphWidth(laneCount)
  const height = rows.length * ROW_HEIGHT

  const edges = rows.flatMap((row, index) => {
    const top = index * ROW_HEIGHT
    const mid = top + ROW_HEIGHT / 2
    const bottom = top + ROW_HEIGHT
    return [
      ...row.passThrough.map((lane) => ({
        key: `${row.folder}-through-${lane}`,
        lane,
        d: `M${laneX(lane)},${top}V${bottom}`,
      })),
      ...row.incoming.map((lane) => ({
        key: `${row.folder}-in-${lane}`,
        lane,
        d:
          lane === row.lane
            ? `M${laneX(lane)},${top}V${mid}`
            : laneCurve(lane, row.lane, top, mid, mid),
      })),
      ...row.outgoing.map((lane) => ({
        key: `${row.folder}-out-${lane}`,
        lane,
        d:
          lane === row.lane
            ? `M${laneX(lane)},${mid}V${bottom}`
            : laneCurve(row.lane, lane, mid, bottom, mid),
      })),
    ]
  })

  return (
    <svg
      className="block flex-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {edges.map((edge) => (
        <path
          key={edge.key}
          d={edge.d}
          fill="none"
          strokeWidth={1.9}
          stroke={laneColor(edge.lane)}
        />
      ))}
      {rows.map((row, index) => (
        <circle
          key={row.folder}
          className={cx(
            'cursor-pointer stroke-bg',
            row.isHead && 'stroke-text',
            row.phantom && 'fill-muted!',
          )}
          cx={laneX(row.lane)}
          cy={index * ROW_HEIGHT + ROW_HEIGHT / 2}
          r={row.isMerge ? 6 : 4.5}
          strokeWidth={2.5}
          fill={laneColor(row.lane)}
          onClick={() => onSelect(row.folder)}
        />
      ))}
    </svg>
  )
}
