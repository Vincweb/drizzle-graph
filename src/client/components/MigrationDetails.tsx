import type { ReactNode } from 'react'
import type { Graph, MigrationRow } from '../../shared/types'
import { useMigrationSql } from '../queries'

const CODE =
  'm-0 overflow-auto rounded-lg border border-line bg-code-bg p-3 text-xs leading-relaxed whitespace-pre-wrap'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="m-0 font-mono text-xs break-all whitespace-pre-line">{children}</dd>
  </>
)

/** One migration: what the graph knows about it, then its SQL, fetched on demand. */
export const MigrationDetails = ({
  row,
  graph,
  dir,
}: {
  row: MigrationRow
  graph: Graph
  dir: string
}) => {
  const sql = useMigrationSql(dir, row.folder)

  return (
    <>
      <dl className="my-4 grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 md:grid-cols-[92px_1fr]">
        <Field label="created">{row.createdAt || '—'}</Field>
        <Field label="snapshot">{row.id}</Field>
        <Field label="parents">
          {row.parentFolders.length ? row.parentFolders.join('\n') : 'root'}
        </Field>
        <Field label="statements">{row.statementCount}</Field>
        <Field label="objects">{row.tables.length ? row.tables.join(', ') : '—'}</Field>
        {row.commit && graph.repoUrl ? (
          <>
            <Field label="commit">
              <a
                className="text-accent hover:underline"
                href={`${graph.repoUrl}/commit/${row.commit.sha}`}
                target="_blank"
                rel="noreferrer"
              >
                {row.commit.sha.slice(0, 10)}
              </a>
              {row.commit.pr && (
                <>
                  {' · '}
                  <a
                    className="text-accent hover:underline"
                    href={`${graph.repoUrl}/pull/${row.commit.pr}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{row.commit.pr}
                  </a>
                </>
              )}
            </Field>
            <Field label="subject">{row.commit.subject}</Field>
          </>
        ) : (
          <Field label="commit">not committed</Field>
        )}
      </dl>

      {sql.isPending && <pre className={CODE}>Loading…</pre>}
      {sql.error && <pre className={CODE}>Failed to read migration.sql: {sql.error.message}</pre>}
      {sql.data &&
        (sql.data.sql ? (
          <pre className={CODE}>{sql.data.sql}</pre>
        ) : (
          <pre className={`${CODE} text-muted italic`}>No SQL — empty or merge-only migration.</pre>
        ))}
    </>
  )
}
