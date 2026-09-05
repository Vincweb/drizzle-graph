import type { ReactNode } from 'react'
type Props = {
  title: string
  onClose: () => void
  children: ReactNode
}

export const SidePanel = ({ title, onClose, children }: Props) => (
  <aside
    className={
      // Over the list on a phone, beside it from md up.
      'fixed inset-0 z-20 flex min-h-0 flex-col bg-panel ' +
      'md:static md:z-auto md:w-[min(640px,54vw)] md:flex-none md:border-l md:border-line'
    }
  >
    <header className="flex flex-none items-center gap-3 border-b border-line px-[18px] py-3.5">
      <h2 className="m-0 text-sm font-semibold break-all">{title}</h2>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="ml-auto cursor-pointer border-0 bg-transparent text-xl text-muted hover:text-text"
      >
        ×
      </button>
    </header>
    <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-6">{children}</div>
  </aside>
)
