import { useApp } from '../context';

export function TopBar() {
  const { state } = useApp();
  const ribbonColor =
    state.currentPage === 'F' && state.secondaryWorkspace
      ? state.secondaryWorkspace.color
      : '#111111';
  const centerLabel =
    state.currentPage === 'F' && state.secondaryWorkspace
      ? `Secondary Workspace | ${state.secondaryWorkspace.label}`
      : state.projectName;

  return (
    <header
      className="ui-topbar shrink-0 px-3 text-white sm:px-4"
      style={{ backgroundColor: ribbonColor }}
    >
      <div className="ui-topbar-inner mx-auto grid min-h-12 max-w-[1600px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(160px,auto)] sm:gap-4 sm:py-0">
        <div className="ui-topbar-brand flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="ui-topbar-badge flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-semibold tracking-[0.14em]">
            AI
          </div>
          <div className="min-w-0">
            <div className="ui-topbar-wordmark truncate text-sm font-semibold tracking-[0.16em]">
              AISync
            </div>
            <div className="ui-topbar-mobile-user truncate text-[10px] text-white/60 sm:hidden">
              User: {state.userName}
            </div>
          </div>
        </div>

        <div className="ui-topbar-project col-span-2 min-w-0 text-[11px] text-white/84 sm:col-span-1 sm:text-center sm:text-sm">
          <span className="mr-1">
            {state.currentPage === 'F' && state.secondaryWorkspace ? 'Workspace:' : 'Project:'}
          </span>
          <span className="inline-block max-w-full truncate align-bottom font-medium text-white">
            {centerLabel}
          </span>
        </div>

        <div className="ui-topbar-desktop-user hidden min-w-0 text-right text-sm text-white/84 sm:block">
          <span className="mr-1">User:</span>
          <span className="inline-block max-w-[240px] truncate align-bottom font-medium text-white">
            {state.userName}
          </span>
        </div>
      </div>
    </header>
  );
}
