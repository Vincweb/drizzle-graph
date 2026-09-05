import { WELCOME_PATH, graphPath } from '../../shared/routes'
import type { DirsPayload, MigrationDirCandidate } from '../../shared/types'
import { cx } from '../cx'
import { Link } from './Link'
import { Logo } from './Logo'
import { PathField } from './PathField'
import { Spinner } from './Spinner'

type Props = {
  dirs: DirsPayload | undefined
  /** Set when the search for folders could not run at all. */
  error: Error | null
  onLookAgain: () => void
  /** True while that search is walking the disk. */
  looking: boolean
}

const LINK = 'text-muted underline decoration-line hover:text-accent hover:decoration-accent'

const SOURCE: Record<MigrationDirCandidate['source'], string> = {
  'drizzle.config': 'from drizzle.config',
  disk: 'found on disk',
  default: 'started on this one',
}

/**
 * What `/` shows: the migrations folders the server found — the ones a Drizzle config points at,
 * and the ones that look like one — plus a path field that completes against the directories it
 * can see. Each one is a link to its own graph, so it can be opened in another tab.
 */
export const Welcome = ({ dirs, error, onLookAgain, looking }: Props) => {
  const candidates = dirs?.candidates ?? []

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col px-5 py-8 md:py-12">
      <header>
        <Link to={WELCOME_PATH} aria-label="drizzle-graph">
          <Logo className="h-7 md:h-9" />
        </Link>
        <h1 className="mt-4 mb-1 text-xl font-semibold">drizzle-graph</h1>
        <p className="m-0 font-medium">Browse and guard a Drizzle migration graph.</p>
      </header>

      <p className="mt-6 mb-8 text-muted">
        {dirs ? (
          <>
            Looking under <code className="font-mono break-all text-text">{dirs.root}</code>. A
            Drizzle config is read as text to find its{' '}
            <code className="font-mono text-text">out</code> — never executed, so nothing in your{' '}
            <code className="font-mono text-text">.env</code> is touched.
          </>
        ) : (
          'Looking for migrations folders…'
        )}
      </p>

      <div className="mb-2 flex items-center gap-3">
        <h2 className="m-0 text-sm font-semibold">Found here</h2>
        <button
          type="button"
          onClick={onLookAgain}
          disabled={looking}
          className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-muted hover:text-accent disabled:cursor-default"
        >
          {looking && <Spinner className="size-3" />}
          {looking ? 'Looking…' : 'Look again'}
        </button>
      </div>

      {candidates.length > 0 && (
        <ul className="m-0 mb-8 grid list-none gap-2 p-0">
          {candidates.map((candidate) => (
            <li key={candidate.dir}>
              <Link
                to={graphPath(candidate.label)}
                title={candidate.dir}
                className={cx(
                  'flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line',
                  'bg-panel px-4 py-3 text-left no-underline hover:border-accent',
                )}
              >
                {/* The label is relative to the root shown above, so the absolute path only
                    needs to be a tooltip. */}
                <span className="min-w-0 flex-1 basis-full truncate font-mono text-text sm:basis-auto">
                  {candidate.label}
                </span>
                <span className="flex-none rounded-full border border-line bg-code-bg px-[7px] py-px text-[11px] text-muted">
                  {SOURCE[candidate.source]}
                </span>
                <span className="flex-none text-muted tabular-nums">
                  {candidate.migrations} {candidate.migrations === 1 ? 'migration' : 'migrations'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {dirs && candidates.length === 0 && (
        <p className="mb-8 rounded-lg border border-warn-line bg-warn-bg px-3 py-2.5">
          Nothing found here. Generate a migration with <code>drizzle-kit generate</code>, or type
          the path below — a Drizzle Kit v1 folder holds one directory per migration, each with a{' '}
          <code>snapshot.json</code>.
        </p>
      )}

      <div>
        <h2 className="m-0 mb-2 text-sm font-semibold">Or open one by path</h2>
        <PathField />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-warn-line bg-warn-bg px-3 py-2.5">
          Could not look for migrations folders: {error.message}
        </p>
      )}

      <footer className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-10 text-xs text-muted">
        <span className="font-mono">drizzle-graph{dirs?.version ? ` v${dirs.version}` : ''}</span>
        <span>·</span>
        <a
          className={LINK}
          href="https://github.com/Vincweb/drizzle-graph"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <span>·</span>
        <a
          className={LINK}
          href="https://orm.drizzle.team/docs/migrations"
          target="_blank"
          rel="noreferrer"
        >
          Drizzle migrations
        </a>
      </footer>
    </div>
  )
}
