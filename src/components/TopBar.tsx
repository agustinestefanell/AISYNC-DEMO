import { useApp } from '../context';
import { CROSS_VERIFICATION_TEAM_ID, getTeamTheme } from '../data/teams';
import { getTopRibbonSectionLabel, getTopRibbonSectionNote } from '../pageLabels';

export function TopBar() {
  const { state } = useApp();
  const ribbonColor =
    state.currentPage === 'G'
      ? getTeamTheme(CROSS_VERIFICATION_TEAM_ID).ribbon
      : state.currentPage === 'F' && state.secondaryWorkspace
        ? state.secondaryWorkspace.color
        : '#111111';
  const sectionLabel = getTopRibbonSectionLabel(
    state.currentPage,
    state.secondaryWorkspace?.label,
  );
  const sectionNote = getTopRibbonSectionNote(state.currentPage);

  return (
    <header
      className="ui-topbar shrink-0 px-3 text-white sm:px-4"
      style={{ backgroundColor: ribbonColor }}
    >
      <div className="ui-topbar-inner mx-auto grid min-h-12 max-w-[1600px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:min-h-14 sm:grid-cols-[minmax(180px,1fr)_minmax(0,1.15fr)_minmax(240px,1fr)] sm:gap-4 sm:py-0">
        <div className="ui-topbar-brand flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="ui-topbar-badge flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-semibold tracking-[0.14em]">
            AI
          </div>
          <div className="min-w-0">
            <div className="ui-topbar-wordmark truncate text-sm font-semibold tracking-[0.16em]">
              AISync
            </div>
          </div>
        </div>

        <div className="ui-topbar-section min-w-0 px-1 text-center">
          <div className="flex flex-col items-center justify-center">
            <span className="inline-block max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-white/92 sm:text-sm">
              {sectionLabel}
            </span>
            {sectionNote ? (
              <span className="inline-block max-w-full truncate text-[9px] font-medium tracking-[0.06em] text-white/62 sm:text-[10px]">
                {sectionNote}
              </span>
            ) : null}
          </div>
        </div>

        <div className="ui-topbar-meta flex min-w-0 flex-col items-end gap-0.5 text-right text-[10px] text-white/78 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:text-xs">
          <div className="min-w-0">
            <span className="mr-1 text-white/58">Project:</span>
            <span className="inline-block max-w-[132px] truncate align-bottom font-medium text-white sm:max-w-[180px]">
              {state.projectName}
            </span>
          </div>
          <div className="min-w-0">
            <span className="mr-1 text-white/58">User:</span>
            <span className="inline-block max-w-[124px] truncate align-bottom font-medium text-white sm:max-w-[170px]">
              {state.userName}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
