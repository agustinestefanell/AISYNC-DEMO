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
      title={locked ? 'Unlock panel controls' : 'Lock panel controls'}
      aria-label={locked ? 'Unlock panel controls' : 'Lock panel controls'}
    >
      <span className="text-[11px] font-semibold tracking-[0.01em]">
        {locked ? 'Unlock Panel' : 'Lock Panel'}
      </span>
    </button>
  );
}
