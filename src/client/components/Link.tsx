import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { navigate } from '../router'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> & {
  to: string
  children: ReactNode
}

/**
 * A link the page follows itself. It stays a real `<a href>` so the browser keeps what it is good
 * at: the target shows in the status bar, and ⌘-click or middle-click opens the folder in another
 * tab — which works because the server hands the page to `/graph` as well as to `/`.
 */
export const Link = ({ to, children, ...rest }: Props) => (
  <a
    {...rest}
    href={to}
    onClick={(event) => {
      // Leave the browser to it when the click asked for a new tab or window.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return
      event.preventDefault()
      navigate(to)
    }}
  >
    {children}
  </a>
)
