import type { MigrationRow } from '../../shared/types'
import { cx } from '../cx'

type Props = {
  row: MigrationRow
  repoUrl: string
  repoPath: string
  selected: boolean
  dimmed: boolean
  panelOpen: boolean
  onSelect: (folder: string) => void
}

const TAG = 'ml-[7px] rounded border px-1.5 py-px text-[10px] tracking-wide uppercase'
const LINK = 'font-mono text-accent hover:underline'

/**
 * A row is exactly one lane-height tall, so a narrow screen cannot wrap — it drops columns
 * instead: the name and the date first, then badges and links, then the objects and the author.
 * Those last two also go when the side panel takes half the width.
 */
const WIDE_COLUMNS =
  'grid-cols-[minmax(0,1fr)_108px] ' +
  'md:grid-cols-[minmax(180px,32%)_minmax(0,1fr)_108px] ' +
  'lg:grid-cols-[minmax(200px,20%)_minmax(0,auto)_minmax(0,1fr)_108px_96px_150px]'
const NARROW_COLUMNS =
  'grid-cols-[minmax(0,1fr)_108px] ' + 'lg:grid-cols-[minmax(180px,34%)_minmax(0,1fr)_108px_150px]'

const badgeClass = (kind: string) => {
  const letters = kind.replace(/[^a-z]/g, '')
  return cx(
    'flex-none rounded-full border border-line bg-code-bg px-[7px] py-px text-[11px]',
    ['table', 'column', 'matview'].includes(letters) ? 'text-text' : 'text-muted',
    kind.endsWith('-') && 'border-warn-line',
    letters === 'data' && 'border-warn-line text-text',
  )
}

export const MigrationListRow = ({
  row,
  repoUrl,
  repoPath,
  selected,
  dimmed,
  panelOpen,
  onSelect,
}: Props) => (
  <li
    data-folder={row.folder}
    tabIndex={0}
    className={cx(
      'grid h-[38px] cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 whitespace-nowrap',
      'hover:bg-panel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
      panelOpen ? NARROW_COLUMNS : WIDE_COLUMNS,
      selected && 'bg-panel shadow-[inset_0_0_0_1px_var(--color-accent)]',
      dimmed && 'opacity-20',
    )}
    onClick={() => onSelect(row.folder)}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onSelect(row.folder)
    }}
  >
    {/* The name gives way before the tags do: a long one is cut, `merge` and `head` stay whole. */}
    <span className={cx('flex min-w-0 items-center', row.phantom && 'text-muted italic')}>
      <span className="truncate font-medium">{row.name}</span>
      {row.isMerge && (
        <span className={cx(TAG, 'flex-none border-line bg-code-bg text-muted')}>merge</span>
      )}
      {row.isHead && (
        <span className={cx(TAG, 'flex-none border-accent bg-code-bg text-accent')}>head</span>
      )}
    </span>

    <span className="hidden gap-[5px] overflow-hidden md:flex">
      {row.badges.map((badge) => (
        <span key={badge.kind} className={badgeClass(badge.kind)}>
          {badge.label}
        </span>
      ))}
    </span>

    {!panelOpen && (
      <span className="hidden overflow-hidden font-mono text-[11.5px] text-ellipsis text-muted lg:block">
        {row.tables.join(', ')}
      </span>
    )}

    <span className="overflow-hidden text-xs text-ellipsis text-muted tabular-nums">
      {row.createdAt}
    </span>

    {!panelOpen && (
      <span className="hidden overflow-hidden text-xs text-ellipsis text-muted lg:block">
        {row.commit?.author ?? ''}
      </span>
    )}

    <span className="hidden justify-end gap-2 text-xs lg:flex">
      {row.commit && repoUrl ? (
        <>
          <a
            className={LINK}
            href={`${repoUrl}/blob/${row.commit.sha}/${repoPath}/${encodeURIComponent(row.folder)}/migration.sql`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            sql
          </a>
          {row.commit.pr && (
            <a
              className={LINK}
              href={`${repoUrl}/pull/${row.commit.pr}`}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              #{row.commit.pr}
            </a>
          )}
          <a
            className={LINK}
            href={`${repoUrl}/commit/${row.commit.sha}`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {row.commit.sha.slice(0, 8)}
          </a>
        </>
      ) : (
        <span className="text-[11px] text-muted">uncommitted</span>
      )}
    </span>
  </li>
)
