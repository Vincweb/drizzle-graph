// Runs the API server from source and the Vite dev server side by side.
// Arguments go to the API server, so `pnpm dev --dir test/fixtures/two-heads` works.
import { spawn } from 'child_process'

const args = process.argv.slice(2)

/** Vite proxies /api to the API server, so it has to follow a --port passed through here. */
const portFlag = args.findIndex((arg) => arg === '--port' || arg === '-p')
const port = portFlag === -1 ? undefined : args[portFlag + 1]

const children = [
  // `watch`, so the API restarts when a server file changes: without it the page hot-reloads
  // around a server that still answers 404 for the route just added.
  spawn('pnpm', ['exec', 'tsx', 'watch', 'src/cli.ts', ...args], {
    stdio: 'inherit',
    // The API server points browsers at Vite rather than serving the last build.
    env: { ...process.env, DRIZZLE_GRAPH_DEV: '1', DRIZZLE_GRAPH_WEB: 'http://localhost:4601' },
  }),
  spawn('pnpm', ['exec', 'vite'], {
    stdio: 'inherit',
    env: port
      ? { ...process.env, DRIZZLE_GRAPH_API: `http://127.0.0.1:${port}` }
      : { ...process.env },
  }),
]

let stopping = false
const stop = (code: number) => {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}

for (const child of children) {
  child.on('exit', (code) => stop(code ?? 0))
  child.on('error', (error) => {
    console.error(error)
    stop(1)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
