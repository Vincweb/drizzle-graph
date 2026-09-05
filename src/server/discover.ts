import fs from 'fs'
import path from 'path'
import type { BrowsePayload, MigrationDirCandidate } from '../shared/types'

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo'])
const CONFIG_NAME = /^drizzle\.config\.(ts|mts|cts|js|mjs|cjs|json)$/
const OUT_KEY = /["'`]?\bout\b["'`]?\s*:\s*(["'`])([^"'`]+)\1/
const MAX_DEPTH = 4

/**
 * How a folder is written in a `?dir=` query: relative to where the search started when it sits
 * inside it, absolute otherwise. `path.resolve(root, …)` reads both back.
 */
export const canonicalDir = (root: string, dir: string) => {
  const relative = path.relative(path.resolve(root), dir)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : dir
}

const entriesOf = (dir: string) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/** A Drizzle Kit v1 migrations folder holds one directory per migration, each with a snapshot. */
export const countMigrations = (dir: string) =>
  entriesOf(dir).filter(
    (entry) => entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, 'snapshot.json')),
  ).length

/**
 * The `out` a Drizzle config declares, read as text — the file is user code that usually pulls in
 * `.env` and database credentials, so it is never imported or executed.
 */
const declaredOut = (file: string) => {
  try {
    const match = OUT_KEY.exec(fs.readFileSync(file, 'utf8'))
    return match?.[2] ? path.resolve(path.dirname(file), match[2]) : null
  } catch {
    return null
  }
}

/**
 * Whether a path can be served: it exists, it is a directory, and it holds at least one
 * migration. The same guard the folder-picking route needs, since that one takes a path from the
 * page and must not turn into "read any directory on this machine".
 */
export const isMigrationDir = (dir: string) => {
  try {
    return fs.statSync(dir).isDirectory() && countMigrations(dir) > 0
  } catch {
    return false
  }
}

/**
 * Migrations folders under `root`: the ones a Drizzle config points at, and the ones that simply
 * look like one. Only folders that exist and hold at least one migration are returned.
 */
export const discoverMigrationDirs = (root: string): MigrationDirCandidate[] => {
  const found = new Map<string, MigrationDirCandidate['source']>()

  const walk = (dir: string, depth: number) => {
    for (const entry of entriesOf(dir)) {
      if (entry.isFile() && CONFIG_NAME.test(entry.name)) {
        const out = declaredOut(path.join(dir, entry.name))
        if (out) found.set(out, 'drizzle.config')
        continue
      }
      if (!entry.isDirectory() || SKIP.has(entry.name)) continue
      const child = path.join(dir, entry.name)
      if (countMigrations(child) > 0 && !found.has(child)) found.set(child, 'disk')
      if (depth < MAX_DEPTH) walk(child, depth + 1)
    }
  }

  walk(path.resolve(root), 1)

  return [...found.entries()]
    .map(([dir, source]) => ({
      dir,
      label: canonicalDir(root, dir),
      source,
      migrations: countMigrations(dir),
    }))
    .filter((candidate) => candidate.migrations > 0)
    .sort((a, b) => b.migrations - a.migrations || a.label.localeCompare(b.label))
}

/** A home folder is not the target; a listing that long is a mistake, not a use case. */
const MAX_ENTRIES = 500

/**
 * One directory listing, for the path field to complete against. Directory names only, and never
 * their contents — and the responses carry no CORS header, so another page in the same browser can
 * fire this request but cannot read what comes back. Never add one.
 *
 * Returns null when the path names nothing, or something that is not a directory, so the caller
 * can answer 400.
 */
export const browseDirectories = (root: string, requested: string): BrowsePayload | null => {
  const dir = path.resolve(root, requested)
  try {
    if (!fs.statSync(dir).isDirectory()) return null
  } catch {
    return null
  }

  const names = entriesOf(dir)
    .filter(
      (entry) =>
        entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules',
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_ENTRIES)

  const parent = path.dirname(dir)
  return {
    path: dir,
    parent: parent === dir ? null : parent,
    entries: names.map((name) => ({
      name,
      dir: path.join(dir, name),
      label: canonicalDir(root, path.join(dir, name)),
      migrations: countMigrations(path.join(dir, name)),
    })),
  }
}
