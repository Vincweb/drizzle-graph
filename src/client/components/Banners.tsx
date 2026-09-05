import type { ReactNode } from 'react'
import { WELCOME_PATH } from '../../shared/routes'
import type { Graph } from '../../shared/types'
import { Link } from './Link'

const COLLAPSE = 'drizzle-kit generate --custom --name merge_migration_heads --ignore-conflicts'

const Banner = ({ children }: { children: ReactNode }) => (
  <div className="min-w-0 rounded-lg border border-warn-line bg-warn-bg px-3 py-2.5">
    {children}
  </div>
)

/** What the graph itself cannot show: it is forked, or a parent snapshot is missing. */
export const Banners = ({ graph, error }: { graph: Graph | undefined; error: Error | null }) => {
  if (!error && (!graph || (graph.heads.length < 2 && graph.unresolved.length === 0))) return null

  return (
    <div className="grid min-w-0 flex-none gap-2 px-5 pt-3">
      {error && (
        <Banner>
          Failed to load the graph: {error.message}{' '}
          <Link to={WELCOME_PATH} className="text-accent">
            Pick another folder
          </Link>
        </Banner>
      )}

      {graph && graph.heads.length > 1 && (
        <Banner>
          <b className="text-xs font-semibold">{graph.heads.length} open heads. </b>
          <span className="text-xs">
            {graph.heads.join(', ')} — collapse them with{' '}
            <code className="text-xs">{COLLAPSE}</code>
          </span>
        </Banner>
      )}

      {graph?.unresolved.map((id) => (
        <Banner key={id}>
          <b className="text-xs font-semibold">Unresolved parent snapshot. </b>
          <span className="text-xs">
            A migration lists <code className="text-xs break-all">{id}</code> in prevIds but no
            folder in {graph.repoPath}/ declares it.
          </span>
        </Banner>
      ))}
    </div>
  )
}
