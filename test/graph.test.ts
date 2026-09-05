import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createScanner } from '../src/server/scan'

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

const graphOf = (name: string) => createScanner({ migrationsDir: fixture(name) }).buildGraph()

test('a linear history has one head and no unresolved parent', () => {
  const graph = graphOf('single-head')
  assert.deepEqual(graph.heads, ['20260103000000_index_posts_user'])
  assert.deepEqual(graph.unresolved, [])
  assert.equal(graph.rows.length, 3)
  assert.equal(graph.laneCount, 1)
})

test('rows are ordered newest first, children before parents', () => {
  const graph = graphOf('single-head')
  assert.deepEqual(
    graph.rows.map((row) => row.folder),
    ['20260103000000_index_posts_user', '20260102000000_add_posts_title', '20260101000000_init'],
  )
})

test('two migrations sharing a parent leave two open heads on separate lanes', () => {
  const graph = graphOf('two-heads')
  assert.deepEqual(graph.heads.sort(), [
    '20260102000000_add_posts_title',
    '20260102120000_add_users_name',
  ])
  assert.equal(graph.laneCount, 2)

  const sibling = graph.rows.find((row) => row.folder === '20260102000000_add_posts_title')
  assert.ok(sibling)
  assert.equal(sibling.lane, 1, 'the second head gets its own lane')
  assert.deepEqual(sibling.outgoing, [0], 'and crosses back into the lane holding the fork point')

  const init = graph.rows.find((row) => row.folder === '20260101000000_init')
  assert.deepEqual(init?.incoming, [0], 'the fork point is reached on the lane both children share')
})

test('a prevId no folder declares becomes a phantom row, not a dropped edge', () => {
  const graph = graphOf('unresolved-parent')
  assert.deepEqual(graph.unresolved, ['ffffffff-ffff-4fff-8fff-ffffffffffff'])

  const phantom = graph.rows.find((row) => row.phantom)
  assert.ok(phantom)
  assert.equal(phantom.name, 'unknown parent snapshot')

  const orphan = graph.rows.find((row) => row.folder === '20260102000000_orphan')
  assert.deepEqual(orphan?.parentFolders, [phantom.folder])
})

test('the SQL summary counts statements and names the objects touched', () => {
  const graph = graphOf('single-head')

  const init = graph.rows.find((row) => row.folder === '20260101000000_init')
  assert.equal(init?.statementCount, 2)
  assert.deepEqual(init?.tables, ['posts', 'users'])
  assert.deepEqual(
    init?.badges.map((badge) => badge.label),
    ['+2 tables'],
  )

  const altered = graph.rows.find((row) => row.folder === '20260102000000_add_posts_title')
  assert.deepEqual(
    altered?.badges.map((badge) => badge.label),
    ['+1 col'],
  )
})

test('a semicolon inside a dollar-quoted block does not split a statement', () => {
  const graph = graphOf('single-head')
  const indexed = graph.rows.find((row) => row.folder === '20260103000000_index_posts_user')
  assert.equal(indexed?.statementCount, 2)
  assert.deepEqual(
    indexed?.badges.map((badge) => badge.label),
    ['+1 index', '1 DO block'],
  )
})

test('readMigrationSql refuses a folder outside the migrations directory', () => {
  const scanner = createScanner({ migrationsDir: fixture('single-head') })
  assert.equal(scanner.readMigrationSql('../two-heads/20260101000000_init'), null)
  assert.equal(scanner.readMigrationSql('nope'), null)
  assert.match(scanner.readMigrationSql('20260101000000_init') ?? '', /CREATE TABLE "users"/)
})
