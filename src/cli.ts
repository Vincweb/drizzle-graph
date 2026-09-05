#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { checkMigrationHeads } from './server/check'
import { serveMigrationGraph } from './server/server'

const DEFAULT_DIR = 'drizzle'
const DEFAULT_PORT = 4600
const DEFAULT_HOST = '127.0.0.1'

const USAGE = `drizzle-graph — browse and guard a Drizzle migration graph

Usage
  drizzle-graph [options]

Options
  -d, --dir <path>    migrations folder (default: ./${DEFAULT_DIR}, or pick one in the page)
  -p, --port <n>      port to serve on (default: ${DEFAULT_PORT})
      --host <host>   host to bind (default: ${DEFAULT_HOST})
  -c, --check         print the open heads and exit 1 when there is more than one
  -h, --help          show this message
  -v, --version       show the version

Examples
  drizzle-graph                        serve ./drizzle on http://127.0.0.1:${DEFAULT_PORT},
                                       or offer what it finds when there is no ./drizzle
  drizzle-graph --dir packages/db/drizzle
  drizzle-graph --check                use it as a CI guard
`

const readVersion = () => {
  const manifest = fileURLToPath(new URL('../package.json', import.meta.url))
  const raw: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  return raw && typeof raw === 'object' && 'version' in raw && typeof raw.version === 'string'
    ? raw.version
    : '0.0.0'
}

const valueOf = (argv: string[], ...names: string[]) => {
  for (const name of names) {
    const index = argv.indexOf(name)
    if (index !== -1) return argv[index + 1]
  }
  return undefined
}

const has = (argv: string[], ...names: string[]) => names.some((name) => argv.includes(name))

export const run = (argv = process.argv.slice(2)): number | null => {
  if (has(argv, '-h', '--help')) {
    console.log(USAGE)
    return 0
  }
  if (has(argv, '-v', '--version')) {
    console.log(readVersion())
    return 0
  }

  const asked = valueOf(argv, '-d', '--dir')
  const migrationsDir = path.resolve(asked ?? DEFAULT_DIR)
  const exists = fs.existsSync(migrationsDir)

  // A folder named on the command line has to be there — a typo is an error, not a welcome screen.
  if (asked !== undefined && !exists) {
    console.error(`✗ no such folder: ${migrationsDir}`)
    console.error('  Pass --dir <path> to point at your Drizzle migrations folder.')
    return 1
  }

  if (has(argv, '-c', '--check')) {
    if (!exists) {
      console.error(`✗ no such folder: ${migrationsDir}`)
      console.error('  Pass --dir <path> to point at your Drizzle migrations folder.')
      return 1
    }
    return checkMigrationHeads({ migrationsDir })
  }

  const port = Number(valueOf(argv, '-p', '--port') ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`✗ invalid port: ${valueOf(argv, '-p', '--port')}`)
    return 1
  }

  serveMigrationGraph({
    // Without a folder the page opens on the welcome screen and offers what it finds here.
    dir: exists ? migrationsDir : null,
    port,
    host: valueOf(argv, '--host') ?? DEFAULT_HOST,
    root: process.cwd(),
    version: readVersion(),
  })
  return null
}

const code = run()
if (code !== null) process.exit(code)
