/**
 * The URLs the page uses, shared so the server can print one and the client can read it back.
 *
 * Which folder is shown lives in the URL rather than in the server, so a link to a graph can be
 * reloaded, bookmarked and shared, and two tabs can hold two folders at once.
 */

/** The picker: the migrations folders found around here, and a field to name another. */
export const WELCOME_PATH = '/'

/** One folder's graph. The folder itself comes from `?dir=`. */
export const GRAPH_PATH = '/graph'

/**
 * A folder as a query string. Slashes are left alone — they are legal in a query, and a path is
 * easier to read than its escapes, in the address bar as much as in the terminal.
 */
export const dirQuery = (dir: string) => `?dir=${encodeURIComponent(dir).replace(/%2F/g, '/')}`

export const graphPath = (dir: string) => `${GRAPH_PATH}${dirQuery(dir)}`
