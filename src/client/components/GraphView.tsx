import { useEffect, useState } from 'react'
import type { MigrationRow } from '../../shared/types'
import { useCheck, useGraph, useRescan } from '../queries'
import { Banners } from './Banners'
import { CheckPanel } from './CheckPanel'
import { GraphLanes } from './GraphLanes'
import { Header } from './Header'
import { MigrationDetails } from './MigrationDetails'
import { MigrationListRow } from './MigrationListRow'
import { SidePanel } from './SidePanel'

type Panel = { kind: 'migration'; folder: string } | { kind: 'check' } | null

/** The filter dims rather than hides, so the rows stay lined up with their lanes. */
const matches = (row: MigrationRow, term: string) =>
  [
    row.folder,
    row.commit?.subject ?? '',
    row.commit?.sha ?? '',
    row.commit?.pr ?? '',
    ...row.tables,
  ]
    .join(' ')
    .toLowerCase()
    .includes(term)

/**
 * One folder's graph. The folder comes from the URL, and this view is mounted per folder — the
 * open panel and the filter belong to the folder being looked at, so switching starts clean.
 */
export const GraphView = ({ dir }: { dir: string }) => {
  const graph = useGraph(dir)
  const { rescan, busy: rescanning } = useRescan()
  const check = useCheck(dir)

  const [panel, setPanel] = useState<Panel>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const rows = graph.data?.rows ?? []
  const term = filter.trim().toLowerCase()
  const selected = panel?.kind === 'migration' ? panel.folder : null
  const selectedRow = rows.find((row) => row.folder === selected)

  const runCheck = () => {
    setPanel({ kind: 'check' })
    check.mutate()
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <Header
        graph={graph.data}
        dir={dir}
        filter={filter}
        onFilter={setFilter}
        onCheck={runCheck}
        onRescan={rescan}
        checking={check.isPending}
        rescanning={rescanning || graph.isFetching}
      />

      <Banners graph={graph.data} error={graph.error} />

      <div className="flex min-h-0 min-w-0 flex-1">
        <main className="flex min-w-0 flex-1 items-start overflow-auto px-5 pt-3 pb-15">
          {graph.isPending && <p className="text-muted italic">Reading the migrations folder…</p>}
          {graph.data && (
            <>
              <GraphLanes
                rows={rows}
                laneCount={graph.data.laneCount}
                onSelect={(folder) => setPanel({ kind: 'migration', folder })}
              />
              <ol className="m-0 min-w-0 flex-1 list-none p-0">
                {rows.map((row) => (
                  <MigrationListRow
                    key={row.folder}
                    row={row}
                    repoUrl={graph.data.repoUrl}
                    repoPath={graph.data.repoPath}
                    selected={row.folder === selected}
                    dimmed={term.length > 0 && !matches(row, term)}
                    panelOpen={panel !== null}
                    onSelect={(folder) => setPanel({ kind: 'migration', folder })}
                  />
                ))}
              </ol>
            </>
          )}
        </main>

        {panel && (
          <SidePanel
            title={panel.kind === 'check' ? 'drizzle-kit check' : panel.folder}
            onClose={() => setPanel(null)}
          >
            {panel.kind === 'check' ? (
              <CheckPanel payload={check.data} pending={check.isPending} error={check.error} />
            ) : selectedRow && graph.data ? (
              <MigrationDetails row={selectedRow} graph={graph.data} dir={dir} />
            ) : (
              <p className="my-4 text-muted italic">
                This migration is no longer in the folder — rescanned since it was opened.
              </p>
            )}
          </SidePanel>
        )}
      </div>
    </div>
  )
}
