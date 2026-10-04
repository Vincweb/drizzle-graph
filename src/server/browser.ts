import { spawn } from 'child_process'

/**
 * The origin a browser can reach the server on. A wildcard bind is an address to listen on, not
 * one to visit — Windows refuses `0.0.0.0` outright — and an IPv6 literal needs its brackets.
 */
export const pageOrigin = (host: string, port: number) => {
  if (host === '' || host === '0.0.0.0' || host === '::') return `http://localhost:${port}`
  return host.includes(':') ? `http://[${host}]:${port}` : `http://${host}:${port}`
}

/**
 * Hands a URL to the system's default browser. Best effort: the URL is printed already, so an
 * opener that is missing — `xdg-open` on a bare Linux box — is not worth a word.
 */
export const openInBrowser = (url: string) => {
  const [command, args]: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? // `start` is a cmd builtin; its first quoted argument is a window title, hence the "".
          ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]]
        : ['xdg-open', [url]]
  const child = spawn(command, args, {
    stdio: 'ignore',
    detached: true,
    // Node would quote the "" itself, and cmd does not read quotes the way it writes them.
    windowsVerbatimArguments: true,
  })
  child.on('error', () => {})
  child.unref()
}
