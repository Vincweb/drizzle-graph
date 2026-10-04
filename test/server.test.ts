import assert from 'node:assert/strict'
import http, { type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { serveMigrationGraph } from '../src/server/server'
import type { BrowsePayload, DirsPayload, Graph } from '../src/shared/types'

const fixtures = fileURLToPath(new URL('fixtures', import.meta.url))

/** Port 0 picks a free one, known only once the server is listening. */
const originOf = (server: Server) =>
  new Promise<string>((resolve) => {
    const url = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    if (server.listening) resolve(url())
    else server.once('listening', () => resolve(url()))
  })

const server = serveMigrationGraph({ port: 0, root: `${fixtures}/discover` })
const origin = await originOf(server)

after(() => {
  server.close()
})

const graphIn = (dir: string) => fetch(`${origin}/api/graph?dir=${encodeURIComponent(dir)}`)

test('with no folder named, a read says so and the page is offered candidates', async () => {
  const answer = await fetch(`${origin}/api/graph`)
  assert.equal(answer.status, 409)
  assert.match(((await answer.json()) as { error: string }).error, /\?dir=/)

  const dirs = (await (await fetch(`${origin}/api/dirs`)).json()) as DirsPayload
  assert.equal(dirs.default, null)
  assert.deepEqual(dirs.candidates.map((candidate) => candidate.label).sort(), [
    'legacy/drizzle',
    'packages/db/migrations',
  ])
})

test('the folder comes from the request, so two of them can be read side by side', async () => {
  const legacy = (await (await graphIn('legacy/drizzle')).json()) as Graph
  assert.deepEqual(
    legacy.rows.map((row) => row.folder),
    ['20260101000000_init'],
  )

  const other = (await (await graphIn('packages/db/migrations')).json()) as Graph
  assert.deepEqual(
    other.rows.map((row) => row.folder),
    ['20260101000000_init'],
  )
  // Nothing was selected along the way: a request naming no folder still has none.
  assert.equal((await fetch(`${origin}/api/graph`)).status, 409)
})

test('a folder holding no migration is refused, wherever it is', async () => {
  assert.equal((await graphIn('packages')).status, 400)
  assert.equal((await graphIn('/etc')).status, 400)
  assert.equal((await graphIn('../../..')).status, 400)
  assert.equal((await fetch(`${origin}/api/check?dir=packages`)).status, 400)
})

test('a migration is read from the folder its request names', async () => {
  const answer = await fetch(
    `${origin}/api/migration?dir=legacy/drizzle&folder=20260101000000_init`,
  )
  assert.equal(answer.status, 200)
  assert.match(((await answer.json()) as { sql: string }).sql, /create table/i)

  const missing = await fetch(`${origin}/api/migration?dir=legacy/drizzle&folder=../secrets`)
  assert.equal(missing.status, 404, 'and only a folder the graph knows about')
})

test('a check is refused when it comes from another page in the browser', async () => {
  const foreign = await fetch(`${origin}/api/check?dir=legacy/drizzle`, {
    headers: { 'sec-fetch-site': 'cross-site' },
  })
  assert.equal(foreign.status, 403)
  // A folder it would refuse anyway is refused before anything is started.
  assert.equal((await fetch(`${origin}/api/check?dir=packages`)).status, 400)
})

const browse = async (path: string) => {
  const response = await fetch(`${origin}/api/browse?path=${encodeURIComponent(path)}`)
  return { status: response.status, payload: (await response.json()) as BrowsePayload }
}

test('the path field is completed from directory listings, node_modules left out', async () => {
  const root = await browse('')
  assert.equal(root.status, 200)
  assert.deepEqual(
    root.payload.entries.map((entry) => entry.name),
    ['legacy', 'packages'],
  )
  assert.ok(root.payload.parent, 'the listing can walk back up')

  const nested = await browse('packages/db')
  assert.deepEqual(
    nested.payload.entries.map((entry) => ({
      name: entry.name,
      label: entry.label,
      migrations: entry.migrations,
    })),
    [{ name: 'migrations', label: 'packages/db/migrations', migrations: 1 }],
  )
})

test('a listing of something that is not a directory is refused', async () => {
  assert.equal((await browse('/nope')).status, 400)
  assert.equal((await browse('packages/db/drizzle.config.ts')).status, 400)
})

test('the page is told which version is running', async () => {
  const ready = serveMigrationGraph({ port: 0, version: '9.9.9' })
  try {
    const dirs = (await (await fetch(`${await originOf(ready)}/api/dirs`)).json()) as DirsPayload
    assert.equal(dirs.version, '9.9.9')
  } finally {
    ready.close()
  }
})

test('a folder passed in at startup is what a request naming none reads', async () => {
  // Started on one folder while looking for candidates somewhere else, so the startup folder is
  // one the search cannot find on its own.
  const ready = serveMigrationGraph({
    dir: `${fixtures}/single-head`,
    port: 0,
    root: `${fixtures}/discover`,
  })
  try {
    const startup = await originOf(ready)

    const graph = (await (await fetch(`${startup}/api/graph`)).json()) as Graph
    assert.equal(graph.rows.length, 3)

    const dirs = (await (await fetch(`${startup}/api/dirs`)).json()) as DirsPayload
    assert.match(dirs.default ?? '', /single-head$/)
    // And it is offered on the welcome screen too, first, marked for what it is.
    assert.deepEqual(
      dirs.candidates
        .filter((candidate) => candidate.source === 'default')
        .map((candidate) => candidate.label),
      [dirs.default],
    )
  } finally {
    ready.close()
  }
})

test('a busy default port falls through to the next one', async () => {
  const squatter = http.createServer().listen(0, '127.0.0.1')
  const busy = Number(new URL(await originOf(squatter)).port)
  const ready = serveMigrationGraph({ port: busy, strictPort: false })
  try {
    const moved = await originOf(ready)
    assert.equal(new URL(moved).port, String(busy + 1))
    assert.equal((await fetch(`${moved}/api/dirs`)).status, 200)
  } finally {
    ready.close()
    squatter.close()
  }
})
