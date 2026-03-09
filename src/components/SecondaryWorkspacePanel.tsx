import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../context';
import { getProviderDisplayName } from '../data/teams';
import type { AgentRole, AIProvider, FileType } from '../types';
import { ContextUploadModal, type ContextUploadItem } from './ContextUploadModal';
import { Modal } from './Modal';
import { SaveBackupModal } from './SaveBackupModal';
import { Toast } from './Toast';

export interface TeamMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  senderLabel: string;
  variant?: 'standard' | 'forwarded';
}

function createMessageId() {
  return `team_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNowTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildForwardedContent(messages: TeamMessage[], sourceLabel: string) {
  const body = messages
    .map((message) => `${message.senderLabel}: ${message.content.trim()}`)
    .join('\n\n');

  return `FORWARDED FROM ${sourceLabel}\n\n${body}`;
}

function buildSaveContent(messages: TeamMessage[]) {
  return messages.map((message) => `${message.senderLabel}: ${message.content}`).join('\n\n');
}

export function SecondaryWorkspacePanel({
  teamLabel,
  workerId,
  workerLabel,
  provider,
  saveAgent,
  theme,
  messages,
  selectedIds,
  draft,
  seedMessages,
  forwardOptions,
  onSetDraft,
  onToggleSelect,
  onClearSelection,
  onAddUserMessage,
  onAddAgentReply,
  onForwardSelection,
  onResetToSeed,
  onClearChat,
  style,
}: {
  teamLabel: string;
  workerId: string;
  workerLabel: string;
  provider: AIProvider;
  saveAgent: AgentRole;
  theme: {
    ribbon: string;
    soft: string;
    border: string;
    accent: string;
  };
  messages: TeamMessage[];
  selectedIds: string[];
  draft: string;
  seedMessages: TeamMessage[];
  forwardOptions: Array<{ id: string; label: string }>;
  onSetDraft: (value: string) => void;
  onToggleSelect: (messageId: string) => void;
  onClearSelection: () => void;
  onAddUserMessage: (message: TeamMessage) => void;
  onAddAgentReply: (message: TeamMessage) => void;
  onForwardSelection: (targetWorkerId: string, message: TeamMessage) => void;
  onResetToSeed: (messages: TeamMessage[]) => void;
  onClearChat: () => void;
  style?: CSSProperties;
}) {
  const { state, saveFile } = useApp();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showSaveSelection, setShowSaveSelection] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [contextItems, setContextItems] = useState<ContextUploadItem[]>([]);
  const [toast, setToast] = useState('');
  const [forwardTarget, setForwardTarget] = useState(forwardOptions[0]?.id ?? '');
  const [fileTitle, setFileTitle] = useState('');
  const [fileType, setFileType] = useState<FileType>('Conversation');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));

  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedIds.includes(message.id)),
    [messages, selectedIds],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (forwardOptions.length > 0 && !forwardOptions.some((option) => option.id === forwardTarget)) {
      setForwardTarget(forwardOptions[0].id);
    }
  }, [forwardOptions, forwardTarget]);

  useEffect(() => {
    if (showSaveModal) {
      setProjectId((current) => current || state.projects[0]?.id || '');
      setEventDate(new Date().toISOString().slice(0, 10));
      setFileTitle(
        `${teamLabel.replace(/[^a-zA-Z0-9]+/g, '_')}_${workerLabel}_${new Date().toISOString().slice(0, 10)}`,
      );
    }
  }, [showSaveModal, state.projects, teamLabel, workerLabel]);

  useEffect(() => {
    if (showSaveModal && selectedMessages.length === 0) {
      setShowSaveModal(false);
    }
  }, [selectedMessages.length, showSaveModal]);

  const sendMessage = () => {
    if (!draft.trim()) {
      return;
    }

    onAddUserMessage({
      id: createMessageId(),
      role: 'user',
      content: draft.trim(),
      timestamp: getNowTime(),
      senderLabel: 'User',
    });
    onSetDraft('');

    window.setTimeout(() => {
      onAddAgentReply({
        id: createMessageId(),
        role: 'agent',
        content: `${workerLabel} received the new brief and is progressing the ${teamLabel} queue with the current constraints in mind.`,
        timestamp: getNowTime(),
        senderLabel: getProviderDisplayName(provider),
      });
    }, 700);
  };

  const handleForward = () => {
    if (selectedMessages.length === 0) {
      setToast('Select messages to forward first.');
      return;
    }

    if (!forwardTarget) {
      setToast('Choose another worker first.');
      return;
    }

    onForwardSelection(forwardTarget, {
      id: createMessageId(),
      role: 'system',
      content: buildForwardedContent(selectedMessages, workerLabel.toUpperCase()),
      timestamp: getNowTime(),
      senderLabel: 'System',
      variant: 'forwarded',
    });
    onClearSelection();
    setToast(`Forwarded ${selectedMessages.length} message(s).`);
  };

  const openSaveBackup = () => {
    setShowSaveSelection(true);

    if (selectedMessages.length === 0) {
      setToast('Manual backup requires selecting messages first.');
      return;
    }

    setShowSaveModal(true);
  };

  const handleSave = () => {
    if (selectedMessages.length === 0) {
      setToast('Select the messages you want to back up first.');
      return;
    }

    saveFile({
      agent: saveAgent,
      sourceLabel: `${teamLabel} | ${workerLabel}`,
      content: buildSaveContent(selectedMessages),
      title: fileTitle.trim() || `${teamLabel}_${workerLabel}_${new Date().toISOString().slice(0, 10)}`,
      type: fileType,
      projectId,
      date: eventDate,
    });
    onClearSelection();
    setShowSaveSelection(false);
    setShowSaveModal(false);
    setToast('Saved to Documentation Mode.');
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-neutral-200 bg-white last:border-r-0"
      style={style}
    >
      <div
        className="px-3 py-2"
        style={{ backgroundColor: theme.soft, color: theme.accent }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-left text-[11px] font-semibold tracking-[0.12em]">
            <div className="truncate uppercase tracking-[0.16em] text-[10px] opacity-70">
              {teamLabel}
            </div>
            <div className="truncate text-[11px] font-semibold text-neutral-900">
              {workerLabel} | {getProviderDisplayName(provider)}
            </div>
          </div>

          <span
            className="ui-pill border-transparent text-white"
            style={{ backgroundColor: theme.ribbon }}
          >
            {workerId}
          </span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3"
        style={{ minHeight: 0 }}
      >
        <div className="flex flex-col gap-3">
          {messages.map((message) => {
            const isSelected = selectedIds.includes(message.id);
            const isUser = message.role === 'user';
            const isForwarded = message.variant === 'forwarded';

            return (
              <div key={message.id} className={`group flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <button
                    className={`mt-1 h-4 w-4 rounded border transition-colors ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-neutral-300 bg-white hover:border-neutral-500'
                    }`}
                    onClick={() => onToggleSelect(message.id)}
                  >
                    <span className="sr-only">Select message</span>
                  </button>
                )}

                <button
                  className={`max-w-[88%] text-left ${isUser ? 'order-1' : ''}`}
                  onClick={() => onToggleSelect(message.id)}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                    <span>{message.senderLabel}</span>
                    <span>{message.timestamp}</span>
                  </div>
                  <div
                    className={`px-3 py-2 text-xs leading-5 transition-shadow ${
                      isForwarded
                        ? 'ui-message-bubble ui-message-bubble-forwarded'
                        : isUser
                          ? 'ui-message-bubble ui-message-bubble-user'
                          : 'ui-message-bubble'
                    } ${isSelected ? 'ring-2 ring-[rgba(0,122,255,0.18)]' : ''}`}
                  >
                    {isForwarded ? (
                      <>
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          {message.content.split('\n')[0]}
                        </div>
                        <div className="whitespace-pre-wrap">
                          {message.content.split('\n').slice(2).join('\n')}
                        </div>
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                </button>

                {isUser && (
                  <button
                    className={`mt-1 h-4 w-4 rounded border transition-colors ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-neutral-300 bg-white hover:border-neutral-500'
                    }`}
                    onClick={() => onToggleSelect(message.id)}
                  >
                    <span className="sr-only">Select message</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-1">
        <div className="ui-chat-composer">
          <input
            className="ui-chat-composer-input"
            placeholder={`Message ${getProviderDisplayName(provider)}...`}
            value={draft}
            onChange={(event) => onSetDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            className="ui-button ui-button-primary ui-chat-send text-xs text-white"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-1">
        <div className="ui-forward-row">
          <span className="ui-meta shrink-0 text-[11px]">Select messages to forward</span>

          <div className="ui-forward-select-wrap">
            <select
              className="ui-forward-select"
              value={forwardTarget}
              onChange={(event) => setForwardTarget(event.target.value)}
            >
              {forwardOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="ui-forward-select-caret">v</span>
          </div>

          <button
            className="ui-button px-3 text-xs text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleForward}
            title="Forward selected messages"
            disabled={selectedMessages.length === 0 || forwardOptions.length === 0}
          >
            Send
          </button>
        </div>

        {(showSaveSelection || selectedMessages.length > 0 || contextItems.length > 0) && (
          <div className="mt-2 grid gap-2">
            {showSaveSelection && (
              <div className="ui-surface-subtle flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-neutral-700">
                <div>
                  Manual backup selection required. Choose the exact messages to save before
                  confirming the backup.
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ui-pill border-transparent bg-white text-neutral-700">
                    {selectedMessages.length} selected
                  </span>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setShowSaveModal(true)}
                    disabled={selectedMessages.length === 0}
                  >
                    Save Selected
                  </button>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700"
                    onClick={() => {
                      onClearSelection();
                      setShowSaveSelection(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {contextItems.length > 0 && (
              <div className="ui-surface-subtle px-3 py-2 text-[11px] text-neutral-700">
                <div className="font-medium text-neutral-800">
                  Context ready: {contextItems.length} item{contextItems.length === 1 ? '' : 's'}
                </div>
                <div className="mt-1 truncate text-neutral-500">
                  {contextItems.slice(0, 2).map((item) => item.label).join(' | ')}
                  {contextItems.length > 2 ? ` | +${contextItems.length - 2} more` : ''}
                </div>
              </div>
            )}

            {selectedMessages.length > 0 && !showSaveSelection && (
              <button
                className="mt-1 text-[11px] text-neutral-500 underline-offset-2 hover:underline"
                onClick={onClearSelection}
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="grid grid-cols-3 gap-2">
          <button
            className="ui-button px-3 text-xs text-neutral-700"
            onClick={() => setShowRefreshConfirm(true)}
          >
            Refresh Session
          </button>
          <button
            className={`ui-button px-3 text-xs ${
              showSaveSelection ? 'ui-button-primary text-white' : 'text-neutral-700'
            }`}
            onClick={openSaveBackup}
          >
            Save / Backup
          </button>
          <button
            className="ui-button px-3 text-xs text-neutral-700"
            onClick={() => setShowContextModal(true)}
          >
            Upload Context
          </button>
        </div>
      </div>

      {showRefreshConfirm && (
        <Modal title="Refresh session" onClose={() => setShowRefreshConfirm(false)}>
          <p className="mb-4 text-sm text-neutral-600">
            Reset this session to seed content or clear the chat entirely.
          </p>
          <div className="flex justify-end gap-2">
            <button className="ui-button text-neutral-700" onClick={() => setShowRefreshConfirm(false)}>
              Cancel
            </button>
            <button
              className="ui-button text-neutral-700"
              onClick={() => {
                onResetToSeed(seedMessages);
                setShowRefreshConfirm(false);
                setShowSaveSelection(false);
                setToast('Seed session restored.');
              }}
            >
              Reset to seed
            </button>
            <button
              className="ui-button ui-button-primary text-white"
              onClick={() => {
                onClearChat();
                setShowRefreshConfirm(false);
                setShowSaveSelection(false);
                setToast('Session cleared.');
              }}
            >
              Clear all
            </button>
          </div>
        </Modal>
      )}

      <SaveBackupModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        selectedMessages={selectedMessages}
        fileTitle={fileTitle}
        onFileTitleChange={setFileTitle}
        fileType={fileType}
        onFileTypeChange={(value) => setFileType(value as FileType)}
        projectId={projectId}
        onProjectIdChange={setProjectId}
        eventDate={eventDate}
        onEventDateChange={setEventDate}
        projects={state.projects}
        onSave={handleSave}
      />

      <ContextUploadModal
        open={showContextModal}
        onClose={() => setShowContextModal(false)}
        onSelect={(items) => {
          setContextItems(items);
          setToast(`Context loaded from ${items.length} selected item(s).`);
        }}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
