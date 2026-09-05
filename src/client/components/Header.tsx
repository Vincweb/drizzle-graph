import { useEffect, useRef, useState } from 'react'
import { WELCOME_PATH } from '../../shared/routes'
import type { Graph } from '../../shared/types'
import { cx } from '../cx'
import { Link } from './Link'
import { Logo } from './Logo'
import { Spinner } from './Spinner'

type Props = {
  graph: Graph | undefined
  /** The folder from the URL — shown until the graph reports its path inside the repository. */
  dir: string
  filter: string
  onFilter: (value: string) => void
  onCheck: () => void
  onRescan: () => void
  checking: boolean
  rescanning: boolean
}

const BUTTON =
  'cursor-pointer rounded-[7px] border border-line bg-bg px-[11px] py-1.5 text-text ' +
  'hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-50'

const SearchIcon = () => (
  <svg
    viewBox="0 0 16 16"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="6.75" cy="6.75" r="4.75" />
    <path d="M10.4 10.4 14 14" />
  </svg>
)

export const Header = ({
  graph,
  dir,
  filter,
  onFilter,
  onCheck,
  onRescan,
  checking,
  rescanning,
}: Props) => {
  /** On a narrow screen the field is behind the magnifier, and opens in a row of its own. */
  const [searching, setSearching] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searching) field.current?.focus()
  }, [searching])

  const migrations = graph?.rows.filter((row) => !row.phantom).length ?? 0
  const merges = graph?.rows.filter((row) => row.isMerge).length ?? 0
  const heads = graph?.heads.length ?? 0

  return (
    <>
      <header className="flex min-w-0 flex-none flex-wrap items-center gap-3 border-b border-line bg-panel px-5 py-3.5">
        {/* The folder path below is hidden on a narrow screen, so the name is the way back to
            the picker there. */}
        <Link
          to={WELCOME_PATH}
          title="Open another folder"
          className="flex items-center gap-2 text-text no-underline hover:text-accent"
        >
          <Logo className="h-3.5" />
          <h1 className="m-0 text-[15px] font-semibold">drizzle-graph</h1>
        </Link>

        <div className="hidden gap-3.5 text-muted tabular-nums sm:flex">
          <Link
            to={WELCOME_PATH}
            title="Open another folder"
            className="max-w-[40vw] truncate font-mono text-text no-underline hover:text-accent"
          >
            {graph?.repoPath ?? dir}
          </Link>
          <span>
            <b className="font-semibold text-text">{migrations}</b> migrations
          </span>
          <span>
            <b className="font-semibold text-text">{heads}</b> {heads === 1 ? 'head' : 'heads'}
          </span>
          <span>
            <b className="font-semibold text-text">{merges}</b> merges
          </span>
        </div>

        <span className="ml-auto" />

        {/* Narrow: the magnifier opens the field below. Wide: the field is simply there. */}
        <button
          type="button"
          aria-label="Filter the migrations"
          aria-expanded={searching}
          onClick={() => setSearching((open) => !open)}
          className={cx(BUTTON, 'grid place-items-center md:hidden', searching && 'text-accent')}
        >
          <SearchIcon />
        </button>
        <input
          type="search"
          value={filter}
          onChange={(event) => onFilter(event.target.value)}
          placeholder="Filter by name, table, sha…"
          className="hidden min-w-0 rounded-[7px] border border-line bg-bg px-2.5 py-1.5 text-text md:block md:min-w-[220px]"
        />

        <button type="button" className={BUTTON} onClick={onCheck} disabled={checking}>
          <span className="md:hidden">check</span>
          <span className="hidden md:inline">Run drizzle-kit check</span>
        </button>
        {/* The spinner sits over the label rather than beside it, so the button keeps its width. */}
        <button
          type="button"
          className={cx(BUTTON, 'relative disabled:opacity-100')}
          onClick={onRescan}
          disabled={rescanning}
        >
          <span className={rescanning ? 'invisible' : undefined}>Rescan</span>
          {rescanning && (
            <span className="absolute inset-0 grid place-items-center">
              <Spinner />
            </span>
          )}
        </button>
      </header>

      {searching && (
        <div className="flex min-w-0 flex-none items-center gap-2 border-b border-line bg-panel px-5 py-2 md:hidden">
          <input
            ref={field}
            type="search"
            value={filter}
            onChange={(event) => onFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onFilter('')
                setSearching(false)
              }
            }}
            // A filter left on with its field hidden would dim rows for no visible reason,
            // so closing it clears it — and an empty one closes itself on the way out.
            onBlur={() => {
              if (!filter) setSearching(false)
            }}
            placeholder="Filter by name, table, sha…"
            // WebKit's own clear button would sit right next to the one that also closes the row.
            className="min-w-0 flex-1 rounded-[7px] border border-line bg-bg px-2.5 py-1.5 text-text [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Close the filter"
            onClick={() => {
              onFilter('')
              setSearching(false)
            }}
            className="cursor-pointer border-0 bg-transparent px-1 text-xl text-muted hover:text-text"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
