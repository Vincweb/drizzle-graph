import http from 'http'
import type { AddressInfo } from 'net'
import path from 'path'
import { graphPath } from '../shared/routes'
import { openInBrowser, pageOrigin } from './browser'
import {
  browseDirectories,
  canonicalDir,
  countMigrations,
  discoverMigrationDirs,
  isMigrationDir,
} from './discover'
import { createScanner } from './scan'
import { DEV_CLIENT, MISSING_CLIENT, clientIsBuilt, devPage, serveClientFile } from './static'

type Scanner = ReturnType<typeof createScanner>

/** Either the folder a request asked for, or the status to answer instead. */
type Target = { scanner: Scanner } | { status: number; error: string }

const json = (response: http.ServerResponse, payload: unknown, status = 200) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

/** The routes that read a migrations folder, and therefore need one named. */
const GRAPH_ROUTES = ['/api/graph', '/api/migration', '/api/check']

/**
 * Whether a request comes from somewhere other than the page itself. Browsers say where in
 * `Sec-Fetch-Site`; `none` is a URL typed by hand, and a request without the header is not a page
 * acting on someone else's behalf — curl, or a browser too old to tell us.
 */
const isForeign = (request: http.IncomingMessage) => {
  const site = request.headers['sec-fetch-site']
  return typeof site === 'string' && site !== 'same-origin' && site !== 'none'
}

export const serveMigrationGraph = ({
  dir = null,
  port,
  host = '127.0.0.1',
  root = process.cwd(),
  version = '',
  strictPort = true,
  open = false,
}: {
  /**
   * The folder to serve when a request names none — what the CLI was started on. Null leaves
   * every page to name its own, which is what the welcome screen is for.
   */
  dir?: string | null
  port: number
  host?: string
  /** Where to look for migrations folders to offer, and what `?dir=` is resolved against. */
  root?: string
  /** Shown by the page. The CLI passes its own. */
  version?: string
  /**
   * False lets a busy port fall through to the next free one, the way the CLI does when no
   * `--port` was asked for. True exits instead: a port someone named is the one they expect.
   */
  strictPort?: boolean
  /** Open the page in the default browser once the server is listening. */
  open?: boolean
}) => {
  const built = clientIsBuilt()
  // Set by `pnpm dev`: the page then lives on the Vite dev server, not in dist/client.
  const devWeb = process.env.DRIZZLE_GRAPH_DEV
    ? (process.env.DRIZZLE_GRAPH_WEB ?? 'http://localhost:4601')
    : null
  const startupDir = dir === null ? null : path.resolve(dir)

  /**
   * The folder a request is about. It comes from the URL — `?dir=<path>`, resolved against the
   * root the server was started in — so which folder a page shows is the page's own business: two
   * tabs can hold two different ones, and a link to one survives a reload. The server keeps no
   * "current folder" of its own, only the fallback the CLI handed it.
   *
   * A scanner is a few closures over that path and re-reads the folder on every call, so there is
   * nothing worth caching between requests.
   */
  const scannerFor = (url: URL): Target => {
    const asked = url.searchParams.get('dir')
    if (asked) {
      const resolved = path.resolve(root, asked)
      // The guard the path field gets too: a path taken from a URL must not turn this into
      // "read any directory on this machine".
      if (!isMigrationDir(resolved))
        return {
          status: 400,
          error: `no migration folder at ${asked} — expected one holding snapshot.json files`,
        }
      return { scanner: createScanner({ migrationsDir: resolved }) }
    }
    if (startupDir) return { scanner: createScanner({ migrationsDir: startupDir }) }
    return { status: 409, error: 'no migrations folder named — add ?dir=<path> to the request' }
  }

  /** What the welcome screen offers: what is on disk, plus the CLI's folder when it is elsewhere. */
  const candidates = () => {
    const found = discoverMigrationDirs(root)
    if (!startupDir || found.some((candidate) => candidate.dir === startupDir)) return found
    return [
      {
        dir: startupDir,
        label: canonicalDir(root, startupDir),
        source: 'default' as const,
        migrations: countMigrations(startupDir),
      },
      ...found,
    ]
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    try {
      if (url.pathname === '/api/dirs') {
        json(response, {
          default: startupDir === null ? null : canonicalDir(root, startupDir),
          root: path.resolve(root),
          candidates: candidates(),
          version,
        })
        return
      }

      if (url.pathname === '/api/browse') {
        const listing = browseDirectories(root, url.searchParams.get('path') ?? '')
        if (!listing) json(response, { error: 'no such directory' }, 400)
        else json(response, listing)
        return
      }

      if (url.pathname.startsWith('/api/')) {
        if (!GRAPH_ROUTES.includes(url.pathname)) {
          // Named, so a page talking to an older server says which route that server is missing
          // rather than a bare "not found".
          json(response, { error: `no such API route: ${url.pathname}` }, 404)
          return
        }
        // A check starts a binary — the `node_modules/.bin/drizzle-kit` nearest the folder in
        // `?dir=` — so it runs for this page only. Another page in the same browser can fire a
        // GET at 127.0.0.1 without a preflight; it cannot read the answer, but it should not be
        // able to choose what runs either.
        if (url.pathname === '/api/check' && isForeign(request)) {
          json(response, { error: 'a check only runs for the page it belongs to' }, 403)
          return
        }

        const target = scannerFor(url)
        if (!('scanner' in target)) {
          json(response, { error: target.error }, target.status)
          return
        }
        const { scanner } = target

        if (url.pathname === '/api/graph') {
          json(response, scanner.buildGraph())
          return
        }
        if (url.pathname === '/api/migration') {
          const folder = url.searchParams.get('folder') ?? ''
          const sql = scanner.readMigrationSql(folder)
          if (sql === null) json(response, { error: 'unknown migration folder' }, 404)
          else json(response, { folder, sql })
          return
        }
        json(response, scanner.runDrizzleCheck())
        return
      }

      if (devWeb) {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        // The same route, on the server that has the page: a `/graph?dir=…` link keeps working.
        response.end(devPage(`${devWeb}${url.pathname}${url.search}`))
        return
      }
      if (!built) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        response.end(MISSING_CLIENT)
        return
      }
      if (serveClientFile(url.pathname, response)) return
      // A path naming a file has to miss rather than fall back to the entry HTML: a browser
      // holding a stale asset URL must see the 404, not an HTML page it cannot parse as a module.
      if (path.extname(url.pathname)) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        response.end(`${url.pathname} is not in this build — reload the page.\n`)
        return
      }
      // Anything else is a client route — `/graph?dir=…` and `/` both live in the page — so it
      // gets the entry HTML and the client reads the URL from there.
      serveClientFile('/', response)
    } catch (error) {
      console.error(error)
      json(response, { error: error instanceof Error ? error.message : 'unexpected error' }, 500)
    }
  })

  /**
   * How far a busy port falls through. In dev it never does: Vite proxies to the port it was told
   * about, and the next one up is Vite's own.
   */
  const lastPort = strictPort || devWeb || port === 0 ? port : Math.min(port + 10, 65535)
  let tried = port

  server.on('error', (error) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
      // Usually another drizzle-graph, on another checkout: this one takes the next port up.
      if (tried < lastPort) {
        server.listen(++tried, host)
        return
      }
      console.error(
        tried === port
          ? `✗ port ${port} is already in use — pass --port <n> to pick another`
          : `✗ ports ${port}–${lastPort} are all in use — pass --port <n> to pick another`,
      )
      process.exit(1)
    }
    throw error
  })

  server.once('listening', () => {
    if (!built) console.warn(process.env.DRIZZLE_GRAPH_DEV ? DEV_CLIENT : MISSING_CLIENT)
    // Read back rather than assumed: the port may have fallen through, or been 0.
    const { port: bound } = server.address() as AddressInfo
    if (bound !== port && port !== 0) console.log(`Port ${port} is in use — took ${bound} instead.`)
    // In dev the page is on the Vite server, so that is where a link has to point.
    const page = devWeb ?? pageOrigin(host, bound)
    // The link opens that folder straight away; `/` is the picker, whether or not there is one.
    const link = startupDir ? `${page}${graphPath(canonicalDir(root, startupDir))}` : page
    console.log(`drizzle-graph → ${link}`)
    if (startupDir)
      console.log(`Serving ${startupDir}, rescanned on every request. Ctrl-C to stop.`)
    else
      console.log(
        `No migrations folder yet — open the page and pick one. Looking under ${path.resolve(root)}.`,
      )
    // Never in dev: `tsx watch` restarts this on every save, and each restart would be a new tab.
    if (open && !devWeb) openInBrowser(link)
  })

  server.listen(port, host)

  const shutdown = () => {
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return server
}
