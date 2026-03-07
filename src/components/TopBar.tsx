import { useApp } from '../context';

export function TopBar() {
  const { state } = useApp();

  return (
    <header className="ui-topbar h-12 shrink-0 px-4 text-white">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-[auto_minmax(0,1fr)_minmax(160px,auto)] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="ui-topbar-badge flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-semibold tracking-[0.14em]">
            AI
          </div>
          <span className="truncate text-sm font-semibold tracking-[0.16em]">AISync</span>
        </div>

        <div className="min-w-0 text-center text-sm text-white/84">
          <span className="mr-1">Project:</span>
          <span className="inline-block max-w-full truncate align-bottom font-medium text-white">
            {state.projectName}
          </span>
        </div>

        <div className="min-w-0 text-right text-sm text-white/84">
          <span className="mr-1">User:</span>
          <span className="inline-block max-w-[240px] truncate align-bottom font-medium text-white">
            {state.userName}
          </span>
        </div>
      </div>
    </header>
  );
}
