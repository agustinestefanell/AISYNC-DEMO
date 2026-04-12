interface MessageSelectionToggleProps {
  selected: boolean;
  onClick: () => void;
}

export function MessageSelectionToggle({ selected, onClick }: MessageSelectionToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`ui-message-select ${selected ? 'ui-message-select-selected' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span className={`ui-message-select-tick ${selected ? 'opacity-100' : 'opacity-0'}`}>✓</span>
      <span className="sr-only">{selected ? 'Deselect message' : 'Select message'}</span>
    </button>
  );
}
