import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { countMigrations, discoverMigrationDirs, isMigrationDir } from '../src/server/discover'

const fixtures = fileURLToPath(new URL('fixtures', import.meta.url))
const root = `${fixtures}/discover`

test('a folder a drizzle config declares as out is found, and says where it came from', () => {
  const declared = discoverMigrationDirs(root).find(
    (candidate) => candidate.label === 'packages/db/migrations',
  )
  assert.ok(declared, 'the out folder of packages/db/drizzle.config.ts')
  assert.equal(declared.source, 'drizzle.config')
  assert.equal(declared.migrations, 1)
})

test('a folder that merely looks like a migrations folder is found too', () => {
  const onDisk = discoverMigrationDirs(root).find(
    (candidate) => candidate.label === 'legacy/drizzle',
  )
  assert.equal(onDisk?.source, 'disk')
})

test('node_modules is never searched', () => {
  const candidates = discoverMigrationDirs(root)
  assert.deepEqual(
    candidates.filter((candidate) => candidate.label.includes('node_modules')),
    [],
  )
})

test('a folder holding no migration of its own counts none', () => {
  assert.equal(countMigrations(root), 0)
  assert.equal(countMigrations(`${root}/packages/db/migrations`), 1)
})

test('only a folder that holds migrations can be served', () => {
  assert.equal(isMigrationDir(`${fixtures}/single-head`), true)
  assert.equal(isMigrationDir(fixtures), false, 'a folder of folders is not one')
  assert.equal(isMigrationDir(`${fixtures}/nope`), false, 'and neither is a missing one')
  assert.equal(
    isMigrationDir(`${fixtures}/single-head/20260101000000_init/migration.sql`),
    false,
    'nor a file',
  )
})
