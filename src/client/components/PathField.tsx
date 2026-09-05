import { useRef, useState } from 'react'
import { graphPath } from '../../shared/routes'
import { cx } from '../cx'
import { useBrowse } from '../queries'
import { navigate } from '../router'
import { Link } from './Link'

const BUTTON =
  'cursor-pointer rounded-[7px] border border-line bg-bg px-[11px] py-1.5 text-text ' +
  'hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-50'

const FolderIcon = () => (
  <svg
    viewBox="0 0 16 16"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.3c.4 0 .8.16 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5Z" />
  </svg>
)

/**
 * The path field, completing against the directories the server can see. A browser never hands
 * absolute paths to a page, so the listing has to come from the server — one directory at a time,
 * the way shell completion works: what is typed before the last slash is listed, what follows
 * filters it.
 */
export const PathField = () => {
  const [typed, setTyped] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const cut = typed.lastIndexOf('/')
  const base = cut === -1 ? '' : typed.slice(0, cut + 1)
  const fragment = cut === -1 ? typed : typed.slice(cut + 1)

  const listing = useBrowse(base, open)
  const entries = (listing.data?.entries ?? []).filter((entry) =>
    entry.name.toLowerCase().startsWith(fragment.toLowerCase()),
  )
  const exact = entries.find((entry) => entry.name === fragment && entry.migrations > 0)

  const descend = (name: string) => {
    setTyped(`${base}${name}/`)
    setOpen(true)
    input.current?.focus()
  }

  const up = () => {
    const trimmed = base.replace(/\/$/, '')
    setTyped(trimmed.slice(0, trimmed.lastIndexOf('/') + 1))
    input.current?.focus()
  }

  return (
    <div className="relative">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (exact) navigate(graphPath(exact.label))
          else if (entries.length === 1 && entries[0]) descend(entries[0].name)
          // A path that holds no migration is not refused here: the graph it opens says so, and
          // says it about a URL that can be corrected and reloaded.
          else if (typed.trim()) navigate(graphPath(typed.trim()))
        }}
      >
        <input
          ref={input}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
            // Tab completes the only match, like a shell.
            if (event.key === 'Tab' && entries.length === 1 && entries[0]) {
              event.preventDefault()
              descend(entries[0].name)
            }
          }}
          placeholder="packages/db/drizzle"
          spellCheck={false}
          autoComplete="off"
          aria-label="Path to a migrations folder"
          aria-expanded={open}
          className="min-w-0 flex-1 rounded-[7px] border border-line bg-bg px-2.5 py-1.5 font-mono text-text"
        />
        {/* A field that only opens its list on focus hides that it has one, so the folder
            button says so out loud. */}
        <button
          type="button"
          onClick={() => {
            setOpen((shown) => !shown)
            input.current?.focus()
          }}
          aria-label={open ? 'Hide the folders' : 'Browse the folders'}
          className={cx(BUTTON, 'flex items-center gap-1.5', open && 'text-accent')}
        >
          <FolderIcon />
          Browse
        </button>
        <button type="submit" className={BUTTON} disabled={!typed.trim()}>
          Open
        </button>
      </form>

      {open && (
        <ul
          className={cx(
            'absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line',
            'bg-panel p-1 shadow-lg',
          )}
        >
          <li className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted">
            <span className="min-w-0 flex-1 truncate font-mono">
              {listing.data?.path ?? (listing.isPending ? 'Reading…' : '')}
            </span>
            <button
              type="button"
              aria-label="Hide the folders"
              onClick={() => setOpen(false)}
              className="flex-none cursor-pointer border-0 bg-transparent text-base text-muted hover:text-text"
            >
              ×
            </button>
          </li>

          {listing.isPending && <li className="px-2 py-1.5 text-muted italic">Reading…</li>}

          {listing.error && (
            <li className="px-2 py-1.5 text-muted">
              Could not list that folder: {listing.error.message}
            </li>
          )}

          {listing.data?.parent && base !== '' && (
            <li>
              <button
                type="button"
                className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-muted hover:bg-bg"
                onClick={up}
              >
                ‹ up
              </button>
            </li>
          )}

          {listing.data && entries.length === 0 && (
            <li className="px-2 py-1.5 text-muted italic">
              {fragment ? `Nothing here starts with “${fragment}”.` : 'No folder in here.'}
            </li>
          )}

          {entries.map((entry) => (
            <li key={entry.dir} className="flex items-center gap-2">
              <button
                type="button"
                title={entry.dir}
                className="min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1.5 text-left font-mono hover:bg-bg"
                onClick={() => descend(entry.name)}
              >
                {entry.name}/
              </button>
              {entry.migrations > 0 && (
                <>
                  <span className="flex-none text-xs text-muted tabular-nums">
                    {entry.migrations} {entry.migrations === 1 ? 'migration' : 'migrations'}
                  </span>
                  <Link
                    to={graphPath(entry.label)}
                    className="flex-none rounded border border-line px-2 py-0.5 text-xs text-accent no-underline hover:border-accent"
                  >
                    Open
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
