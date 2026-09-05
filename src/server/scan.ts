import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { CheckPayload, CheckReport, Graph, MigrationRow } from '../shared/types'

const parseSnapshot = (raw: unknown, folder: string) => {
  if (typeof raw !== 'object' || raw === null || !('id' in raw) || !('prevIds' in raw))
    throw new Error(`${folder}/snapshot.json: missing "id" or "prevIds"`)
  const { id, prevIds } = raw
  if (typeof id !== 'string' || !Array.isArray(prevIds))
    throw new Error(`${folder}/snapshot.json: unexpected shape for "id" or "prevIds"`)
  const parents = prevIds.filter((prev): prev is string => typeof prev === 'string' && prev !== '')
  return { id, parents: [...new Set(parents)] }
}

const splitStatements = (sql: string) => {
  const statements: string[] = []
  let current = ''
  let index = 0
  while (index < sql.length) {
    const rest = sql.slice(index)
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', index)
      index = end === -1 ? sql.length : end + 1
      current += ' '
      continue
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', index + 2)
      index = end === -1 ? sql.length : end + 2
      current += ' '
      continue
    }
    const dollarTag = /^\$[A-Za-z_]*\$/.exec(rest)
    if (dollarTag) {
      const tag = dollarTag[0]
      const end = sql.indexOf(tag, index + tag.length)
      const stop = end === -1 ? sql.length : end + tag.length
      current += sql.slice(index, stop)
      index = stop
      continue
    }
    const char = sql[index]
    if (char === "'" || char === '"') {
      let cursor = index + 1
      while (cursor < sql.length) {
        if (sql[cursor] === char && sql[cursor + 1] === char) cursor += 2
        else if (sql[cursor] === char) break
        else cursor += 1
      }
      current += sql.slice(index, cursor + 1)
      index = cursor + 1
      continue
    }
    if (char === ';') {
      statements.push(current)
      current = ''
      index += 1
      continue
    }
    current += char
    index += 1
  }
  statements.push(current)
  return statements.map((statement) => statement.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

const cleanObjectName = (raw: string) =>
  raw
    .replace(/[();,]+$/g, '')
    .split('.')
    .map((part) => part.replace(/^"|"$/g, ''))
    .filter((part) => part !== 'public')
    .join('.')

const BADGE_LABELS: Record<string, (n: number) => string> = {
  table: (n) => `+${n} table${n > 1 ? 's' : ''}`,
  'table-': (n) => `−${n} table${n > 1 ? 's' : ''}`,
  'column+': (n) => `+${n} col${n > 1 ? 's' : ''}`,
  'column-': (n) => `−${n} col${n > 1 ? 's' : ''}`,
  'constraint+': (n) => `+${n} constraint${n > 1 ? 's' : ''}`,
  'constraint-': (n) => `−${n} constraint${n > 1 ? 's' : ''}`,
  rename: (n) => `${n} rename${n > 1 ? 's' : ''}`,
  alter: (n) => `${n} alter${n > 1 ? 's' : ''}`,
  'index+': (n) => `+${n} index${n > 1 ? 'es' : ''}`,
  'index-': (n) => `−${n} index${n > 1 ? 'es' : ''}`,
  'matview+': (n) => `+${n} matview${n > 1 ? 's' : ''}`,
  'matview-': (n) => `−${n} matview${n > 1 ? 's' : ''}`,
  refresh: (n) => `${n} refresh`,
  'view+': (n) => `+${n} view${n > 1 ? 's' : ''}`,
  'view-': (n) => `−${n} view${n > 1 ? 's' : ''}`,
  function: (n) => `${n} function${n > 1 ? 's' : ''}`,
  trigger: (n) => `${n} trigger${n > 1 ? 's' : ''}`,
  type: (n) => `${n} enum${n > 1 ? 's' : ''}`,
  sequence: (n) => `${n} sequence${n > 1 ? 's' : ''}`,
  extension: (n) => `${n} extension${n > 1 ? 's' : ''}`,
  data: (n) => `${n} data stmt${n > 1 ? 's' : ''}`,
  do: (n) => `${n} DO block${n > 1 ? 's' : ''}`,
  maintenance: (n) => `${n} maintenance`,
  other: (n) => `${n} other`,
}

const summarize = (sql: string) => {
  const statements = splitStatements(sql)
  const counts = new Map<string, number>()
  const tables = new Set<string>()
  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1)

  for (const statement of statements) {
    const upper = statement.toUpperCase()
    const table = (pattern: RegExp) => {
      const match = pattern.exec(statement)
      if (match?.[1]) tables.add(cleanObjectName(match[1]))
    }

    if (/^CREATE\s+(TABLE|UNLOGGED\s+TABLE)/.test(upper)) {
      bump('table')
      table(/^CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i)
    } else if (/^ALTER\s+TABLE/.test(upper)) {
      table(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(\S+)/i)
      if (/\bADD\s+COLUMN\b/.test(upper)) bump('column+')
      else if (/\bDROP\s+COLUMN\b/.test(upper)) bump('column-')
      else if (/\bADD\s+CONSTRAINT\b/.test(upper)) bump('constraint+')
      else if (/\bDROP\s+CONSTRAINT\b/.test(upper)) bump('constraint-')
      else if (/\bRENAME\b/.test(upper)) bump('rename')
      else bump('alter')
    } else if (/^CREATE\s+(UNIQUE\s+)?INDEX/.test(upper)) {
      bump('index+')
      table(/\bON\s+(?:ONLY\s+)?(\S+)/i)
    } else if (/^DROP\s+INDEX/.test(upper)) {
      bump('index-')
    } else if (/^CREATE\s+(OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW/.test(upper)) {
      bump('matview+')
      table(/MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i)
    } else if (/^DROP\s+MATERIALIZED\s+VIEW/.test(upper)) {
      bump('matview-')
      table(/MATERIALIZED\s+VIEW\s+(?:IF\s+EXISTS\s+)?(\S+)/i)
    } else if (/^REFRESH\s+MATERIALIZED\s+VIEW/.test(upper)) {
      bump('refresh')
    } else if (/^CREATE\s+(OR\s+REPLACE\s+)?VIEW/.test(upper)) {
      bump('view+')
    } else if (/^DROP\s+VIEW/.test(upper)) {
      bump('view-')
    } else if (/^DROP\s+TABLE/.test(upper)) {
      bump('table-')
      table(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\S+)/i)
    } else if (/^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/.test(upper)) {
      bump('function')
    } else if (/^CREATE\s+(OR\s+REPLACE\s+)?TRIGGER/.test(upper) || /^DROP\s+TRIGGER/.test(upper)) {
      bump('trigger')
    } else if (/^CREATE\s+TYPE/.test(upper) || /^ALTER\s+TYPE/.test(upper)) {
      bump('type')
    } else if (/^CREATE\s+SEQUENCE/.test(upper)) {
      bump('sequence')
    } else if (/^CREATE\s+(SCHEMA|EXTENSION)/.test(upper)) {
      bump('extension')
    } else if (/^(INSERT\s+INTO|UPDATE|DELETE\s+FROM)/.test(upper)) {
      bump('data')
      table(/^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:ONLY\s+)?(\S+)/i)
    } else if (/^DO\b/.test(upper)) {
      bump('do')
    } else if (/^ANALYZE\b/.test(upper) || /^VACUUM\b/.test(upper)) {
      bump('maintenance')
    } else if (statement) {
      bump('other')
    }
  }

  const badges = [...counts.entries()].map(([key, count]) => ({
    kind: key,
    label: BADGE_LABELS[key]?.(count) ?? `${count} ${key}`,
  }))

  return { statementCount: statements.length, badges, tables: [...tables].sort() }
}

const orderNewestFirst = <T extends { id: string; folder: string; parents: string[] }>(
  nodes: T[],
) => {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const remainingChildren = new Map(nodes.map((node) => [node.id, 0]))
  for (const node of nodes)
    for (const parent of node.parents)
      remainingChildren.set(parent, (remainingChildren.get(parent) ?? 0) + 1)

  const ready = nodes.filter((node) => remainingChildren.get(node.id) === 0)
  const order: T[] = []
  while (ready.length > 0) {
    ready.sort((a, b) => a.folder.localeCompare(b.folder))
    const node = ready.pop()
    if (!node) break
    order.push(node)
    for (const parentId of node.parents) {
      const left = (remainingChildren.get(parentId) ?? 0) - 1
      remainingChildren.set(parentId, left)
      const parent = byId.get(parentId)
      if (left === 0 && parent) ready.push(parent)
    }
  }
  if (order.length !== nodes.length)
    throw new Error(`migration graph has a cycle: ordered ${order.length} of ${nodes.length} nodes`)
  return order
}

const layout = <T extends { id: string; parents: string[] }>(order: T[]) => {
  const lanes: (string | null)[] = []
  return order.map((node) => {
    const before = [...lanes]
    let lane = lanes.indexOf(node.id)
    if (lane === -1) {
      const free = lanes.indexOf(null)
      lane = free === -1 ? lanes.length : free
    }
    const incoming = before.flatMap((slot, index) => (slot === node.id ? [index] : []))
    lanes.forEach((slot, index) => {
      if (slot === node.id) lanes[index] = null
    })
    lanes[lane] = null

    const outgoing = node.parents.map((parentId, position) => {
      const existing = lanes.indexOf(parentId)
      if (existing !== -1) return existing
      const free = position === 0 && lanes[lane] === null ? lane : lanes.indexOf(null)
      const target = free === -1 ? lanes.length : free
      lanes[target] = parentId
      return target
    })

    return { node, lane, incoming, outgoing, before, after: [...lanes] }
  })
}

const run = (command: string, args: string[], cwd: string) => {
  try {
    return {
      code: 0,
      stdout: execFileSync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    }
  } catch (error) {
    const stdout =
      error && typeof error === 'object' && 'stdout' in error && typeof error.stdout === 'string'
        ? error.stdout
        : ''
    const code =
      error && typeof error === 'object' && 'status' in error ? Number(error.status ?? 1) : 1
    return { code, stdout }
  }
}

const resolveDrizzleKit = (from: string) => {
  let dir = from
  while (true) {
    const candidate = path.join(dir, 'node_modules', '.bin', 'drizzle-kit')
    if (fs.existsSync(candidate)) return [candidate, [] as string[]] as const
    const parent = path.dirname(dir)
    if (parent === dir) return ['npx', ['-y', 'drizzle-kit']] as const
    dir = parent
  }
}

export const createScanner = ({ migrationsDir }: { migrationsDir: string }) => {
  const root = path.resolve(migrationsDir)
  const cwd = path.dirname(root)
  const dirName = path.basename(root)
  const git = (args: string[]) => run('git', args, cwd).stdout

  const readRepoUrl = () => {
    const remote = git(['remote', 'get-url', 'origin']).trim()
    const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote)
    return match ? `https://github.com/${match[1]}` : ''
  }

  const readRepoPath = () => `${git(['rev-parse', '--show-prefix']).trim()}${dirName}`

  const readGitHistory = () => {
    const log = git([
      'log',
      '--diff-filter=A',
      '--format=%x00%H%x1f%an%x1f%aI%x1f%s',
      '--name-only',
      '--',
      dirName,
    ])
    const commits = new Map<
      string,
      { sha: string; author: string; date: string; subject: string; pr: string }
    >()
    for (const record of log.split('\u0000').slice(1)) {
      const [header = '', ...fileLines] = record.split('\n')
      const [sha, author, date, subject] = header.split('\u001f')
      if (!sha) continue
      const pr = /\(#(\d+)\)\s*$/.exec(subject ?? '')?.[1] ?? ''
      for (const line of fileLines) {
        const folder = new RegExp(`${dirName}/([^/]+)/`).exec(line.trim())?.[1]
        if (folder)
          commits.set(folder, {
            sha,
            author: author ?? '',
            date: date ?? '',
            subject: subject ?? '',
            pr,
          })
      }
    }
    return commits
  }

  const migrationFolders = () =>
    fs
      .readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'snapshot.json')),
      )
      .map((entry) => entry.name)
      .sort()

  const readMigrations = () =>
    migrationFolders().map((folder) => {
      const dir = path.join(root, folder)
      const sqlPath = path.join(dir, 'migration.sql')
      const { id, parents } = parseSnapshot(
        JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8')),
        folder,
      )
      const sql = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : ''
      const stamped = /^(\d{14})_(.*)$/.exec(folder)
      const stamp = stamped?.[1] ?? ''
      return {
        folder,
        id,
        parents,
        name: (stamped?.[2] ?? folder).replace(/_/g, ' '),
        createdAt: stamp
          ? `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`
          : '',
        phantom: false,
        ...summarize(sql),
      }
    })

  const withPhantomParents = (nodes: ReturnType<typeof readMigrations>) => {
    const known = new Set(nodes.map((node) => node.id))
    const missing = [
      ...new Set(nodes.flatMap((node) => node.parents).filter((id) => !known.has(id))),
    ]
    const phantoms = missing.map((id) => ({
      folder: `unknown_${id.slice(0, 8)}`,
      id,
      parents: [] as string[],
      name: 'unknown parent snapshot',
      createdAt: '',
      phantom: true,
      statementCount: 0,
      badges: [] as { kind: string; label: string }[],
      tables: [] as string[],
    }))
    return [...nodes, ...phantoms]
  }

  const buildGraph = (): Graph => {
    const migrations = withPhantomParents(readMigrations())
    const placed = layout(orderNewestFirst(migrations))
    const commits = readGitHistory()
    const folderById = new Map(placed.map((entry) => [entry.node.id, entry.node.folder]))

    const rows: MigrationRow[] = placed.map((entry) => ({
      ...entry.node,
      parentFolders: entry.node.parents.map((id) => folderById.get(id) ?? id),
      commit: commits.get(entry.node.folder) ?? null,
      lane: entry.lane,
      incoming: entry.incoming,
      outgoing: entry.outgoing,
      passThrough: entry.before.flatMap((slot, index) =>
        slot && slot !== entry.node.id && entry.after[index] === slot ? [index] : [],
      ),
      isMerge: entry.outgoing.length > 1,
      isHead: entry.incoming.length === 0 && !entry.node.phantom,
    }))

    return {
      repoUrl: readRepoUrl(),
      repoPath: readRepoPath(),
      laneCount: Math.max(
        1,
        ...placed.map((entry) => Math.max(entry.before.length, entry.after.length)),
      ),
      rows,
      heads: rows.filter((row) => row.isHead).map((row) => row.folder),
      unresolved: rows.filter((row) => row.phantom).map((row) => row.id),
    }
  }

  const readMigrationSql = (folder: string) => {
    if (!migrationFolders().includes(folder)) return null
    const sqlPath = path.join(root, folder, 'migration.sql')
    return fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8').trim() : ''
  }

  const runDrizzleCheck = (): CheckPayload => {
    const [command, prefix] = resolveDrizzleKit(cwd)
    const { code, stdout } = run(command, [...prefix, 'check', '--output', 'json'], cwd)
    const line = stdout
      .split('\n')
      .map((entry) => entry.trim())
      .reverse()
      .find((entry) => entry.startsWith('{'))
    if (!line) return { code, report: null, raw: stdout }
    try {
      const report = JSON.parse(line) as CheckReport
      return { code, report, raw: stdout }
    } catch {
      return { code, report: null, raw: stdout }
    }
  }

  return { migrationsDir: root, buildGraph, readMigrationSql, runDrizzleCheck }
}
