import { canonicalDir } from './discover'
import { createScanner } from './scan'

export const checkMigrationHeads = ({ migrationsDir }: { migrationsDir: string }) => {
  const scanner = createScanner({ migrationsDir })
  const { heads, unresolved } = scanner.buildGraph()
  // Relative when the folder is under the working directory, absolute when it is not: a trail of
  // `../../..` in a CI log helps nobody.
  const shown = canonicalDir(process.cwd(), scanner.migrationsDir)

  for (const id of unresolved)
    console.warn(`⚠ snapshot ${id} is listed in prevIds but no migration folder declares it`)

  if (heads.length > 1) {
    console.error(`✗ ${shown} has ${heads.length} open heads:`)
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

  console.log(`✓ ${shown} has a single head: ${heads[0] ?? 'none'}`)
  return 0
}
