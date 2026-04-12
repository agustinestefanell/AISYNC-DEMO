interface DividerRailProps {
  collapsed?: boolean;
  onToggle?: () => void;
  title?: string;
}

export function DividerRail({ collapsed = false, onToggle, title }: DividerRailProps = {}) {
  const railLabel = collapsed ? 'Expand' : 'Collapse';
  const railContent = (
    <div className="grid justify-items-center gap-1.5 text-center">
      <span className="text-[10px] font-semibold leading-none text-current">{collapsed ? '>' : '<'}</span>
      <span className="[writing-mode:vertical-rl] rotate-180 text-[9px] font-semibold uppercase tracking-[0.12em] text-current">
        {railLabel}
      </span>
      <span className="[writing-mode:vertical-rl] rotate-180 text-[8px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        SM
      </span>
    </div>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="ui-divider-rail flex w-4 shrink-0 items-start justify-center pt-4 text-[10px] text-neutral-500 transition-colors hover:text-neutral-800"
      >
        {railContent}
      </button>
    );
  }

  return <div className="ui-divider-rail flex w-4 shrink-0 items-start justify-center pt-4 text-[10px]">{railContent}</div>;
}
