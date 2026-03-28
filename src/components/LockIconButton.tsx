export function LockIconButton({
  locked,
  onClick,
}: {
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`ui-button ui-lock-icon-button ${
        locked ? 'ui-lock-icon-button-locked' : 'ui-lock-icon-button-unlocked'
      }`}
      onClick={onClick}
      title={locked ? 'Unlock document' : 'Lock document'}
      aria-label={locked ? 'Unlock document' : 'Lock document'}
    >
      <span className="text-[11px] font-semibold tracking-[0.02em]">
        {locked ? 'Lock' : 'Unlock'}
      </span>
    </button>
  );
}
