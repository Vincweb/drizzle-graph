import { useSyncExternalStore } from 'react'
import { GRAPH_PATH } from '../shared/routes'

export type Route = {
  /** Which screen the URL names: the picker, or one folder's graph. */
  view: 'welcome' | 'graph'
  /** The folder the URL carries, empty on the picker and on a `/graph` without one. */
  dir: string
}

const parse = (): Route => {
  const url = new URL(window.location.href)
  // A trailing slash names the same route, and the server hands the page to both.
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  return {
    view: pathname === GRAPH_PATH ? 'graph' : 'welcome',
    dir: url.searchParams.get('dir') ?? '',
  }
}

/**
 * One snapshot for the whole page, kept at module level: a hook holding state of its own would
 * give every component a private copy of the URL, and they would drift apart on the first click.
 */
let route = parse()
const listeners = new Set<() => void>()

const publish = () => {
  route = parse()
  for (const listener of listeners) listener()
}

// The back and forward buttons change the URL without asking us.
window.addEventListener('popstate', publish)

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useRoute = () => useSyncExternalStore(subscribe, () => route)

/** Go somewhere in the page. `replace` swaps the current entry instead of adding one. */
export const navigate = (to: string, { replace = false }: { replace?: boolean } = {}) => {
  if (replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  publish()
}
