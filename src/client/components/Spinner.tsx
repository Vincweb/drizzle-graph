import { cx } from '../cx'

/** A small turning ring, for a button that is waiting on something. */
export const Spinner = ({ className }: { className?: string }) => (
  <span
    role="status"
    aria-label="Working"
    className={cx(
      'inline-block size-3.5 animate-spin rounded-full border-2 border-line border-t-accent',
      className,
    )}
  />
)
