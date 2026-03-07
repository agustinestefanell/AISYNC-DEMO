import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../context';
import type { AgentRole, FileType, Message } from '../types';
import { Modal } from './Modal';
import { Toast } from './Toast';

const MODEL_LABELS: Record<AgentRole, string> = {
  manager: 'Gemini',
  worker1: 'Claude',
  worker2: 'GPT-5',
};

const PANEL_NAMES: Record<AgentRole, string> = {
  manager: 'PROJECT MANAGER',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
};

const FORWARD_DEFAULTS: Record<AgentRole, AgentRole> = {
  manager: 'worker1',
  worker1: 'worker2',
  worker2: 'manager',
};

const STUB_REPLIES: Record<AgentRole, string[]> = {
  manager: [
    'Coordination noted. I will structure the next step and assign it to the right worker.',
    'I have enough context. Converting this into a clean execution brief now.',
    'Received. I will keep the workflow simple and route only the required context.',
  ],
  worker1: [
    'Task accepted. I am producing the technical output with the current constraints in mind.',
    'Understood. I am validating the request and turning it into an execution-ready answer.',
    'Confirmed. I will return a concise technical response without expanding scope.',
  ],
  worker2: [
    'Received. I am translating the input into a clear, user-facing summary.',
    'Confirmed. I will synthesize the request and return a clean draft.',
    'Working on it. I will keep the answer structured and easy to reuse.',
  ],
};

function createMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNowTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAgentLabel(agent: AgentRole) {
  if (agent === 'manager') return 'Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

function buildSaveContent(messages: Message[], selectedIds: string[]) {
  if (selectedIds.length > 0) {
    return messages
      .filter((message) => selectedIds.includes(message.id))
      .map((message) => `${message.senderLabel}: ${message.content}`)
      .join('\n\n');
  }

  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'agent' || message.role === 'system');

  if (latestAssistant) {
    return `${latestAssistant.senderLabel}: ${latestAssistant.content}`;
  }

  return messages
    .map((message) => `${message.senderLabel}: ${message.content}`)
    .join('\n\n');
}

export interface AgentPanelProps {
  agent: AgentRole;
  showSaveAction?: boolean;
  showRefreshAction?: boolean;
  editableRole?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function AgentPanel({
  agent,
  showSaveAction = false,
  showRefreshAction = true,
  editableRole = false,
  className,
  style,
}: AgentPanelProps) {
  const { state, dispatch, saveFile } = useApp();
  const messages = state.messages[agent];
  const selectedIds = state.selectedMessages[agent];
  const draft = state.drafts[agent];
  const viewportRef = useRef<HTMLDivElement>(null);
  const isManager = agent === 'manager';

  const [showTargets, setShowTargets] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toast, setToast] = useState('');
  const [roleInput, setRoleInput] = useState(
    agent === 'manager' ? '' : state.workerRoles[agent],
  );
  const [editingRole, setEditingRole] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<AgentRole>(FORWARD_DEFAULTS[agent]);
  const [fileTitle, setFileTitle] = useState('');
  const [fileType, setFileType] = useState<FileType>('Conversation');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));

  const targetOptions = useMemo(
    () =>
      (['manager', 'worker1', 'worker2'] as AgentRole[]).filter(
        (option) => option !== agent,
      ),
    [agent],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (showSaveModal) {
      setProjectId((current) => current || state.projects[0]?.id || '');
      setEventDate(new Date().toISOString().slice(0, 10));
      setFileTitle(`Session_${agent}_${new Date().toISOString().slice(0, 10)}`);
    }
  }, [agent, showSaveModal, state.projects]);

  useEffect(() => {
    if (editableRole) {
      setRoleInput(agent === 'manager' ? '' : state.workerRoles[agent]);
    }
  }, [agent, editableRole, state.workerRoles]);

  const headerLabel = useMemo(() => {
    if (agent === 'manager') {
      return `${PANEL_NAMES.manager} | ${MODEL_LABELS.manager}`;
    }

    const roleValue = state.workerRoles[agent] || '';
    return `${PANEL_NAMES[agent]} - ${roleValue} | ${MODEL_LABELS[agent]} | (Click to set this role)`;
  }, [agent, state.workerRoles]);

  const sendMessage = () => {
    if (!draft.trim()) {
      return;
    }

    dispatch({
      type: 'ADD_MESSAGE',
      agent,
      message: {
        id: createMessageId(),
        role: 'user',
        content: draft.trim(),
        timestamp: getNowTime(),
        agent,
        senderLabel: 'User',
      },
    });
    dispatch({ type: 'SET_DRAFT', agent, value: '' });

    window.setTimeout(() => {
      const replyBank = STUB_REPLIES[agent];
      const reply = replyBank[Math.floor(Math.random() * replyBank.length)];
      dispatch({
        type: 'ADD_MESSAGE',
        agent,
        message: {
          id: createMessageId(),
          role: 'agent',
          content: reply,
          timestamp: getNowTime(),
          agent,
          senderLabel: MODEL_LABELS[agent],
        },
      });
    }, 850);
  };

  const handleForward = () => {
    if (selectedIds.length === 0) {
      setToast('Select messages to forward first.');
      return;
    }

    const orderedMessages = messages.filter((message) => selectedIds.includes(message.id));
    const packet = orderedMessages
      .map((message) => `${message.senderLabel}: ${message.content}`)
      .join('\n\n');
    const sourceLabel = getAgentLabel(agent).toUpperCase();
    const forwardedContent = `FORWARDED FROM ${sourceLabel}\n\n${packet}`;

    dispatch({
      type: 'ADD_MESSAGE',
      agent: forwardTarget,
      message: {
        id: createMessageId(),
        role: 'system',
        content: forwardedContent,
        timestamp: getNowTime(),
        agent: forwardTarget,
        senderLabel: 'System',
        variant: 'forwarded',
      },
    });
    dispatch({
      type: 'SET_DRAFT',
      agent: forwardTarget,
      value: state.drafts[forwardTarget]
        ? `${state.drafts[forwardTarget]}\n\n${forwardedContent}`
        : forwardedContent,
    });
    dispatch({ type: 'CLEAR_SELECTION', agent });
    setShowTargets(false);
    setToast(`Forwarded ${orderedMessages.length} message(s) to ${getAgentLabel(forwardTarget)}.`);
  };

  const handleSave = () => {
    const content = buildSaveContent(messages, selectedIds);
    saveFile({
      agent,
      content,
      title: fileTitle.trim() || `Session_${agent}_${new Date().toISOString().slice(0, 10)}`,
      type: fileType,
      projectId,
      date: eventDate,
    });
    dispatch({ type: 'CLEAR_SELECTION', agent });
    setShowSaveModal(false);
    setToast('Saved to Documentation Mode.');
  };

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-r last:border-r-0 ${
        isManager
          ? 'ui-manager-panel'
          : 'border-r-neutral-200 bg-white'
      } ${className ?? ''}`}
      style={style}
    >
      <div
        className={`px-3 py-2 ${
          isManager
            ? 'ui-manager-header'
            : 'ui-worker-header'
        }`}
      >
        {editableRole && editingRole ? (
          <input
            className="ui-input h-8 min-h-8 px-2 text-xs"
            value={roleInput}
            onChange={(event) => setRoleInput(event.target.value)}
            onBlur={() => {
              dispatch({
                type: 'SET_WORKER_ROLE',
                worker: agent as 'worker1' | 'worker2',
                role: roleInput.trim(),
              });
              setEditingRole(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                dispatch({
                  type: 'SET_WORKER_ROLE',
                  worker: agent as 'worker1' | 'worker2',
                  role: roleInput.trim(),
                });
                setEditingRole(false);
              }
            }}
            autoFocus
          />
        ) : (
          <button
            className={`w-full text-left text-[11px] font-semibold tracking-[0.12em] ${
              editableRole ? 'cursor-pointer' : 'cursor-default'
            }`}
            onClick={() => {
              if (editableRole) {
                setEditingRole(true);
              }
            }}
          >
            {headerLabel}
          </button>
        )}
      </div>

      <div
        ref={viewportRef}
        className={`scrollbar-thin flex-1 overflow-y-auto px-3 py-3 ${
          isManager ? 'ui-manager-viewport' : 'ui-worker-viewport'
        }`}
        style={{ minHeight: 0 }}
      >
        <div className="flex flex-col gap-3">
          {messages.map((message) => {
            const isSelected = selectedIds.includes(message.id);
            const isUser = message.role === 'user';
            const isForwarded = message.variant === 'forwarded';

            return (
              <div
                key={message.id}
                className={`group flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <button
                    className={`mt-1 h-4 w-4 rounded border transition-colors ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-neutral-300 bg-white hover:border-neutral-500'
                    }`}
                    onClick={() =>
                      dispatch({
                        type: 'TOGGLE_SELECT_MESSAGE',
                        agent,
                        messageId: message.id,
                      })
                    }
                  >
                    <span className="sr-only">Select message</span>
                  </button>
                )}

                <button
                  className={`max-w-[88%] text-left ${isUser ? 'order-1' : ''}`}
                  onClick={() =>
                    dispatch({
                      type: 'TOGGLE_SELECT_MESSAGE',
                      agent,
                      messageId: message.id,
                    })
                  }
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
                          : isManager
                            ? 'ui-message-bubble border-[rgba(164,145,102,0.14)]'
                            : 'ui-message-bubble'
                    } ${isSelected ? 'ring-2 ring-[rgba(0,122,255,0.18)]' : ''}`}
                  >
                    {isForwarded ? (
                      <>
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          {message.content.split('\n')[0]}
                        </div>
                        <div className="whitespace-pre-wrap">{message.content.split('\n').slice(2).join('\n')}</div>
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
                    onClick={() =>
                      dispatch({
                        type: 'TOGGLE_SELECT_MESSAGE',
                        agent,
                        messageId: message.id,
                      })
                    }
                  >
                    <span className="sr-only">Select message</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`shrink-0 px-3 py-2 ${isManager ? 'ui-manager-section' : 'ui-worker-section'}`}>
        <div className="flex items-center gap-2">
          <input
            className="ui-input flex-1 text-xs"
            placeholder={`Message ${MODEL_LABELS[agent]}...`}
            value={draft}
            onChange={(event) =>
              dispatch({ type: 'SET_DRAFT', agent, value: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            className="ui-button text-xs text-neutral-700"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </div>

      <div className={`shrink-0 px-3 py-2 ${isManager ? 'ui-manager-section' : 'ui-worker-section-soft'}`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <button
              className="ui-button flex w-full justify-between px-3 text-xs text-neutral-700"
              onClick={() => setShowTargets((value) => !value)}
            >
              <span>
                Forward to {getAgentLabel(forwardTarget).toUpperCase()} (choose agent)
              </span>
              <span className="text-neutral-400">v</span>
            </button>
            {showTargets && (
              <div className="ui-surface fade-in absolute bottom-full left-0 z-20 mb-1 w-full">
                {targetOptions.map((option) => (
                  <button
                    key={option}
                    className="block w-full px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-neutral-50"
                    onClick={() => {
                      setForwardTarget(option);
                      setShowTargets(false);
                    }}
                  >
                    {getAgentLabel(option)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="ui-button px-2 text-xs text-neutral-500"
            onClick={() => setToast(`${selectedIds.length} message(s) selected.`)}
            title="Selected count"
          >
            View
          </button>
          <button
            className="ui-button px-2 text-xs text-neutral-700"
            onClick={handleForward}
            title="Forward selected messages"
          >
            Send to
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="ui-meta text-[11px]">
            {selectedIds.length > 0
              ? `${selectedIds.length} message(s) selected`
              : 'Select messages to forward'}
          </span>
          <div className="flex items-center gap-3">
            {showSaveAction && (
              <button
                className="text-[11px] font-medium text-neutral-700 underline-offset-2 hover:underline"
                onClick={() => setShowSaveModal(true)}
              >
                Save as file
              </button>
            )}
            {selectedIds.length > 0 && (
              <button
                className="text-[11px] text-neutral-500 underline-offset-2 hover:underline"
                onClick={() => dispatch({ type: 'CLEAR_SELECTION', agent })}
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
      </div>

      {showRefreshAction && (
        <div className={`shrink-0 px-3 py-2 ${isManager ? 'ui-manager-section' : 'ui-worker-section'}`}>
          <button
            className="text-[11px] font-semibold tracking-[0.12em] text-neutral-600 transition-colors hover:text-black"
            onClick={() => setShowRefreshConfirm(true)}
          >
            REFRESH THIS SESSION
          </button>
        </div>
      )}

      {showRefreshConfirm && (
        <Modal title="Refresh session" onClose={() => setShowRefreshConfirm(false)}>
          <p className="mb-4 text-sm text-neutral-600">
            Reset this session to seed content or clear the chat entirely.
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="ui-button text-neutral-700"
              onClick={() => setShowRefreshConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="ui-button text-neutral-700"
              onClick={() => {
                dispatch({ type: 'RESET_CHAT', agent });
                setShowRefreshConfirm(false);
                setToast('Seed session restored.');
              }}
            >
              Reset to seed
            </button>
            <button
              className="ui-button ui-button-primary text-white"
              onClick={() => {
                dispatch({ type: 'CLEAR_CHAT', agent });
                setShowRefreshConfirm(false);
                setToast('Session cleared.');
              }}
            >
              Clear all
            </button>
          </div>
        </Modal>
      )}

      {showSaveModal && (
        <Modal title="Save as file" onClose={() => setShowSaveModal(false)}>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="ui-label">File name</span>
              <input
                className="ui-input text-xs"
                value={fileTitle}
                onChange={(event) => setFileTitle(event.target.value)}
              />
            </label>

            <label className="grid gap-1">
              <span className="ui-label">Type</span>
              <select
                className="ui-input text-xs"
                value={fileType}
                onChange={(event) => setFileType(event.target.value as FileType)}
              >
                <option value="Conversation">Conversation</option>
                <option value="Document">Document</option>
                <option value="Report">Report</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="ui-label">Project</span>
              <select
                className="ui-input text-xs"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {state.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="ui-label">Calendar date</span>
              <input
                className="ui-input text-xs"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                className="ui-button text-neutral-700"
                onClick={() => setShowSaveModal(false)}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button-primary text-white"
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
