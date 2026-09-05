import type { ReactNode } from 'react'
import type { CheckBranch, CheckPayload } from '../../shared/types'
import { cx } from '../cx'

const basename = (value: string) => value.split('/').pop() ?? value

const statementKey = (branch: CheckBranch) =>
  `${branch.action}|${JSON.stringify(branch.target ?? {})}`

const Verdict = ({ ok, children }: { ok?: boolean; children: ReactNode }) => (
  <p
    className={cx(
      'mt-0 mb-3.5 rounded-lg border px-3 py-2.5',
      ok ? 'border-ok-line bg-ok-bg' : 'border-warn-line bg-warn-bg',
    )}
  >
    {children}
  </p>
)

/**
 * `drizzle-kit check` reports the same wall of text whether the branches agree or not.
 * This says which of the two it is, because only one of them takes an empty merge migration.
 */
export const CheckPanel = ({
  payload,
  pending,
  error,
}: {
  payload: CheckPayload | undefined
  pending: boolean
  error: Error | null
}) => {
  if (pending) return <p className="my-4 text-muted italic">Running drizzle-kit check…</p>
  if (error) return <Verdict>Failed: {error.message}</Verdict>
  if (!payload) return null

  const report = payload.report
  if (report?.status === 'ok') return <Verdict ok>Everything commutes — exit code 0.</Verdict>

  const details = report?.error?.details
  if (!details || !Array.isArray(details) || details.length === 0)
    return (
      <>
        <Verdict>
          {payload.raw
            ? `drizzle-kit check exited ${payload.code} without a report this page understands.`
            : 'Could not run drizzle-kit. Install it in the project that owns these migrations ' +
              '(npm i -D drizzle-kit), or start drizzle-graph from that project.'}
        </Verdict>
        {payload.raw && (
          <pre className="m-0 overflow-auto rounded-lg border border-line bg-code-bg p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {payload.raw}
          </pre>
        )}
      </>
    )

  const sameStatementEverywhere = details.every((detail) => {
    const keys = detail.branches.map(statementKey)
    return keys.every((key) => key === keys[0])
  })

  return (
    <>
      <Verdict>
        <b className="font-semibold">{report?.error?.conflicts} conflict(s). </b>
        {sameStatementEverywhere
          ? 'Every conflict is the same statement on both branches — two branches merged the same ' +
            'fork independently. An empty merge_migration_heads migration is enough.'
          : 'At least one conflict reports different statements on the same object — the branches ' +
            'genuinely disagree, so the merge needs real SQL, not an empty migration.'}
      </Verdict>

      {details.map((detail) => (
        <div
          key={detail.parentPath}
          className="mb-4 rounded-lg border border-line bg-code-bg px-3 py-2.5"
        >
          <div className="text-xs text-muted">fork point: {basename(detail.parentPath)}</div>
          {detail.branches.map((branch) => (
            <div key={branch.leafPath} className="mt-1.5 font-mono text-xs">
              {basename(branch.leafPath)}
              <div className="text-muted">{branch.statementDescription}</div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
