import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { fetchBrowse, fetchCheck, fetchDirs, fetchGraph, fetchMigration } from './api'

/**
 * Everything read from a folder is keyed by that folder, so opening another one never shows the
 * previous graph while the new one loads — and going back to it is instant.
 */
export const useGraph = (dir: string) =>
  useQuery({ queryKey: ['graph', dir], queryFn: () => fetchGraph(dir) })

export const useMigrationSql = (dir: string, folder: string | null) =>
  useQuery({
    queryKey: ['migration', dir, folder],
    queryFn: () => fetchMigration(dir, folder ?? ''),
    enabled: folder !== null,
  })

/** A check runs `drizzle-kit check` for real, so it only runs when asked. */
export const useCheck = (dir: string) => useMutation({ mutationFn: () => fetchCheck(dir) })

/**
 * The folders the server found around it. Only the picker needs them — finding them walks the
 * disk — so a page opened straight on a graph does not ask.
 */
export const useDirs = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: ['dirs'], queryFn: fetchDirs, enabled })

/** One directory listing, for the path field. Keyed by path, so walking back up is instant. */
export const useBrowse = (path: string, enabled: boolean) =>
  useQuery({
    queryKey: ['browse', path],
    queryFn: () => fetchBrowse(path),
    enabled,
    staleTime: 30_000,
  })

/** Long enough for a button's busy state to register as an answer rather than a flicker. */
const FLOOR_MS = 450

/**
 * Runs what it is handed and keeps `busy` on until that is done *and* the floor has passed.
 * Reading a local folder takes a few milliseconds, which is too fast to see, so without this the
 * click would look like it did nothing at all.
 */
const useFlooredAction = () => {
  const [busy, setBusy] = useState(false)

  const start = useCallback((run: () => Promise<unknown>) => {
    setBusy(true)
    const floor = new Promise((resolve) => setTimeout(resolve, FLOOR_MS))
    void Promise.all([run(), floor]).then(() => setBusy(false))
  }, [])

  return { start, busy }
}

/**
 * Rescan: the server re-reads the folder on every request, so dropping what came from it is
 * enough — the graph, and the SQL of an open migration, which may have changed too. The list of
 * candidate folders is left alone: finding those walks the disk, and only "Look again" asks for it.
 *
 * Reading a local folder takes a few milliseconds, which is too fast to see, so `busy` also stays
 * on for a short floor: the click has to look like it did something, even when there is nothing
 * new to show.
 */
export const useRescan = () => {
  const client = useQueryClient()
  const { start, busy } = useFlooredAction()

  const rescan = useCallback(
    () =>
      start(() =>
        Promise.all([
          client.invalidateQueries({ queryKey: ['graph'] }),
          client.invalidateQueries({ queryKey: ['migration'] }),
        ]),
      ),
    [client, start],
  )

  return { rescan, busy }
}

/** Looking again walks the disk, and gets the same floor so the button says it did. */
export const useLookAgain = () => {
  const client = useQueryClient()
  const { start, busy } = useFlooredAction()

  const lookAgain = useCallback(
    () => start(() => client.invalidateQueries({ queryKey: ['dirs'] })),
    [client, start],
  )

  return { lookAgain, busy }
}
