import { useEffect } from 'react'
import { graphPath } from '../shared/routes'
import { GraphView } from './components/GraphView'
import { Welcome } from './components/Welcome'
import { useDirs, useLookAgain } from './queries'
import { navigate, useRoute } from './router'

/**
 * Which screen is on is decided by the URL: `/` is the picker, `/graph?dir=<path>` is one folder's
 * graph. Nothing about it is kept in the server, so a graph can be reloaded, bookmarked, opened in
 * a second tab next to another folder, or sent to someone with the same checkout.
 */
export const App = () => {
  const route = useRoute()
  const { lookAgain, busy: looking } = useLookAgain()

  // Only the picker needs the list of folders — and so does a bare `/graph`, to find the one the
  // CLI was started on. A page opened straight on a graph never asks, so it never waits for a
  // walk of the disk.
  const needsDirs = route.view === 'welcome' || route.dir === ''
  const dirs = useDirs({ enabled: needsDirs })
  const fallback = dirs.data?.default ?? null

  useEffect(() => {
    // `/graph` on its own is not a URL worth keeping: name the folder it ended up showing, in
    // place, so a reload lands on the same graph without leaving a dead entry behind.
    if (route.view === 'graph' && !route.dir && fallback)
      navigate(graphPath(fallback), { replace: true })
  }, [route.view, route.dir, fallback])

  if (route.view === 'graph') {
    const dir = route.dir || fallback
    if (dir) return <GraphView key={dir} dir={dir} />
    // Still finding out whether there is a folder to fall back to.
    if (dirs.isPending)
      return <p className="px-5 py-12 text-center text-muted italic">Looking for migrations…</p>
  }

  return (
    <Welcome
      dirs={dirs.data}
      error={dirs.error}
      onLookAgain={lookAgain}
      looking={looking || dirs.isFetching}
    />
  )
}
