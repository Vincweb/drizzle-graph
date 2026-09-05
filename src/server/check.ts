import path from 'path'
import { createScanner } from './scan'

export const checkMigrationHeads = ({ migrationsDir }: { migrationsDir: string }) => {
  const scanner = createScanner({ migrationsDir })
  const { heads, unresolved } = scanner.buildGraph()
  const relative = path.relative(process.cwd(), scanner.migrationsDir) || '.'

  for (const id of unresolved)
    console.warn(`⚠ snapshot ${id} is listed in prevIds but no migration folder declares it`)

  if (heads.length > 1) {
    console.error(`✗ ${relative} has ${heads.length} open heads:`)
    for (const folder of heads) console.error(`    ${folder}`)
    console.error('')
    console.error('  Merging this would leave the target branch forked, and the next branch to')
    console.error('  absorb these heads would fork it again. Collapse them first:')
    console.error('')
    console.error(
      '    drizzle-kit generate --custom --name merge_migration_heads --ignore-conflicts',
    )
    console.error('')
    console.error('  That writes an empty migration whose prevIds are every current head. It only')
    console.error(
      '  fits when drizzle-kit check reports the same statement on both branches; if it',
    )
    console.error('  reports different statements on the same object, the merge needs real SQL.')
    return 1
  }

  console.log(`✓ ${relative} has a single head: ${heads[0] ?? 'none'}`)
  return 0
}
