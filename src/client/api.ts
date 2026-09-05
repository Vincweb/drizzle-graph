import { dirQuery } from '../shared/routes'
import type {
  BrowsePayload,
  CheckPayload,
  DirsPayload,
  Graph,
  MigrationPayload,
} from '../shared/types'

/** What the server says went wrong, when it is the one answering. */
const errorIn = (payload: unknown) =>
  typeof payload === 'object' &&
  payload !== null &&
  'error' in payload &&
  typeof payload.error === 'string'
    ? payload.error
    : null

const read = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  const payload: unknown = await response.json().catch(() => null)
  // The server explains a refused folder in the body; the status is the fallback for an answer
  // that is not one of ours, such as a 404 from a stale asset URL.
  if (!response.ok) throw new Error(errorIn(payload) ?? `${url} answered ${response.status}`)
  return payload as T
}

/** Every read names its folder: it comes from the page's URL, not from the server's memory. */
export const fetchGraph = (dir: string) => read<Graph>(`/api/graph${dirQuery(dir)}`)

export const fetchMigration = (dir: string, folder: string) =>
  read<MigrationPayload>(`/api/migration${dirQuery(dir)}&folder=${encodeURIComponent(folder)}`)

export const fetchCheck = (dir: string) => read<CheckPayload>(`/api/check${dirQuery(dir)}`)

export const fetchDirs = () => read<DirsPayload>('/api/dirs')

export const fetchBrowse = (path: string) =>
  read<BrowsePayload>(`/api/browse?path=${encodeURIComponent(path)}`)
