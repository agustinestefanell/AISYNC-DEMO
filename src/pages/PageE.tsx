import { useEffect, useMemo, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import { DividerRail } from '../components/DividerRail';
import type { PromptItem, PromptVisibility } from '../types';

const PRIVATE_PROMPTS_KEY = 'aisync_private_prompts_v1';
const COLLECTIONS = [
  'Start Here',
  'Thinking Modes',
  'Decision & Tradeoffs',
  'Research & Synthesis',
  'Writing & Deliverables',
  'Product & Startup',
  'Engineering & Build',
  'Meetings & Communication',
  'Personal Productivity',
  'AISync Workflows',
] as const;
const CODE_INDEX = ['ADR', 'EO', 'PR', 'RISK', 'SOP', 'BRIEF', 'PITCH', 'SPEC'] as const;

const COLLECTION_META: Record<
  (typeof COLLECTIONS)[number],
  { prefix: (typeof CODE_INDEX)[number]; segment: string }
> = {
  'Start Here': { prefix: 'BRIEF', segment: 'START' },
  'Thinking Modes': { prefix: 'ADR', segment: 'THK' },
  'Decision & Tradeoffs': { prefix: 'RISK', segment: 'DEC' },
  'Research & Synthesis': { prefix: 'ADR', segment: 'RES' },
  'Writing & Deliverables': { prefix: 'PR', segment: 'WRITE' },
  'Product & Startup': { prefix: 'PITCH', segment: 'PRD' },
  'Engineering & Build': { prefix: 'SPEC', segment: 'ENG' },
  'Meetings & Communication': { prefix: 'SOP', segment: 'COM' },
  'Personal Productivity': { prefix: 'ADR', segment: 'FLOW' },
  'AISync Workflows': { prefix: 'EO', segment: 'OPS' },
};

type SortMode = 'used' | 'az' | 'recent';
type VisibilityFilter = 'all' | PromptVisibility;

function buildPublicPrompts(): PromptItem[] {
  return [
    {
      id: 'public_eo_ops_001',
      visibility: 'public',
      collection: 'AISync Workflows',
      code: 'EO-OPS-001',
      title: 'Executive Order Patch',
      description: 'Frame a patch request with constraints, acceptance criteria, and validation steps.',
      tags: ['ops', 'patch', 'validation'],
      promptText:
        'Write a concise executive order for this patch. Preserve architecture, list constraints first, then required implementation steps and validation.',
      usageCount: 28,
      updatedAt: '2026-03-06T10:20:00.000Z',
    },
    {
      id: 'public_brief_start_001',
      visibility: 'public',
      collection: 'Start Here',
      code: 'BRIEF-START-001',
      title: 'Fast Project Brief',
      description: 'Turn scattered context into a one-minute operational brief.',
      tags: ['brief', 'summary', 'handoff'],
      promptText:
        'Summarize the active context into a short project brief with goal, status, blockers, and next action. Keep it readable for a non-technical stakeholder.',
      usageCount: 19,
      updatedAt: '2026-03-04T09:15:00.000Z',
    },
    {
      id: 'public_adr_thk_004',
      visibility: 'public',
      collection: 'Thinking Modes',
      code: 'ADR-THK-004',
      title: 'Active Draft Reasoning',
      description: 'Expose working assumptions and convert them into a cleaner next-step recommendation.',
      tags: ['reasoning', 'assumptions', 'clarity'],
      promptText:
        'List the current assumptions, identify which ones are risky, and rewrite the response as a cleaner next-step recommendation with no filler.',
      usageCount: 14,
      updatedAt: '2026-03-03T14:45:00.000Z',
    },
    {
      id: 'public_risk_dec_002',
      visibility: 'public',
      collection: 'Decision & Tradeoffs',
      code: 'RISK-DEC-002',
      title: 'Decision Tradeoff Lens',
      description: 'Compare two or three options with explicit cost, speed, and risk tradeoffs.',
      tags: ['tradeoff', 'decision', 'risk'],
      promptText:
        'Compare the available options. For each one, explain speed, implementation cost, downside risk, and recommended choice in plain English.',
      usageCount: 16,
      updatedAt: '2026-03-05T11:00:00.000Z',
    },
    {
      id: 'public_adr_res_003',
      visibility: 'public',
      collection: 'Research & Synthesis',
      code: 'ADR-RES-003',
      title: 'Synthesis Without Noise',
      description: 'Condense notes into the minimum set of insights that still preserves meaning.',
      tags: ['research', 'synthesis', 'notes'],
      promptText:
        'Compress the research notes into the smallest useful set of insights, grouped by theme, and end with two evidence-backed recommendations.',
      usageCount: 11,
      updatedAt: '2026-03-06T08:45:00.000Z',
    },
    {
      id: 'public_pr_write_001',
      visibility: 'public',
      collection: 'Writing & Deliverables',
      code: 'PR-WRITE-001',
      title: 'Phase Report Draft',
      description: 'Convert raw execution notes into a phase report with clear sections.',
      tags: ['report', 'deliverable', 'writing'],
      promptText:
        'Turn the raw notes into a phase report with overview, completed work, blockers, evidence, and next milestone. Keep the tone clean and professional.',
      usageCount: 13,
      updatedAt: '2026-03-02T16:15:00.000Z',
    },
    {
      id: 'public_pitch_prd_002',
      visibility: 'public',
      collection: 'Product & Startup',
      code: 'PITCH-PRD-002',
      title: 'Investor Narrative',
      description: 'Explain the product through problem, wedge, proof, and upside.',
      tags: ['startup', 'pitch', 'investor'],
      promptText:
        'Rewrite the current product notes into a short investor narrative covering problem, solution, proof of execution, and why now.',
      usageCount: 9,
      updatedAt: '2026-03-01T12:30:00.000Z',
    },
    {
      id: 'public_spec_eng_005',
      visibility: 'public',
      collection: 'Engineering & Build',
      code: 'SPEC-ENG-005',
      title: 'Build Spec Snapshot',
      description: 'Generate a lightweight implementation spec with scope and validation.',
      tags: ['engineering', 'spec', 'build'],
      promptText:
        'Draft a lightweight implementation spec with scope, constraints, impacted files, testing plan, and rollout notes.',
      usageCount: 24,
      updatedAt: '2026-03-06T18:05:00.000Z',
    },
    {
      id: 'public_sop_com_002',
      visibility: 'public',
      collection: 'Meetings & Communication',
      code: 'SOP-COM-002',
      title: 'Meeting Compression',
      description: 'Turn a meeting transcript into decisions, owners, and follow-ups.',
      tags: ['meeting', 'communication', 'owners'],
      promptText:
        'Extract the decisions, open questions, owners, and next follow-ups from this meeting transcript. Keep the output compact and skimmable.',
      usageCount: 8,
      updatedAt: '2026-03-05T09:20:00.000Z',
    },
    {
      id: 'public_adr_flow_001',
      visibility: 'public',
      collection: 'Personal Productivity',
      code: 'ADR-FLOW-001',
      title: 'Priority Compression',
      description: 'Reduce a noisy backlog into today, next, and later.',
      tags: ['productivity', 'priority', 'focus'],
      promptText:
        'Reorganize this backlog into Today, Next, and Later. Remove noise, surface dependencies, and explain the sequence in one short note.',
      usageCount: 7,
      updatedAt: '2026-02-28T17:00:00.000Z',
    },
  ];
}

function loadPrivatePrompts() {
  if (typeof window === 'undefined') {
    return [] as PromptItem[];
  }

  try {
    const saved = window.localStorage.getItem(PRIVATE_PROMPTS_KEY);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved) as PromptItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getCollectionMeta(collection: string) {
  if (collection in COLLECTION_META) {
    return COLLECTION_META[collection as (typeof COLLECTIONS)[number]];
  }

  return COLLECTION_META['AISync Workflows'];
}

function generatePrivateCode(collection: string, prompts: PromptItem[]) {
  const meta = getCollectionMeta(collection);
  const matching = prompts.filter(
    (prompt) => prompt.visibility === 'private' && prompt.code.startsWith(`${meta.prefix}-${meta.segment}`),
  );
  const next = matching.length + 1;
  return `${meta.prefix}-${meta.segment}-${String(next).padStart(3, '0')}`;
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function PageE() {
  const { state, dispatch } = useApp();
  const [showManagerMobile, setShowManagerMobile] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [publicPrompts, setPublicPrompts] = useState<PromptItem[]>(buildPublicPrompts);
  const [privatePrompts, setPrivatePrompts] = useState<PromptItem[]>(loadPrivatePrompts);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('used');
  const [selectedCollection, setSelectedCollection] = useState('All Collections');
  const [selectedCode, setSelectedCode] = useState('All Codes');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newCollection, setNewCollection] = useState<(typeof COLLECTIONS)[number]>('AISync Workflows');
  const [toast, setToast] = useState('');

  useEffect(() => {
    window.localStorage.setItem(PRIVATE_PROMPTS_KEY, JSON.stringify(privatePrompts));
  }, [privatePrompts]);

  const allPrompts = useMemo(
    () => [...publicPrompts, ...privatePrompts],
    [privatePrompts, publicPrompts],
  );

  const collectionCounts = useMemo(
    () =>
      Object.fromEntries(
        COLLECTIONS.map((collection) => [
          collection,
          allPrompts.filter((prompt) => prompt.collection === collection).length,
        ]),
      ),
    [allPrompts],
  );

  const codeCounts = useMemo(
    () =>
      Object.fromEntries(
        CODE_INDEX.map((code) => [
          code,
          allPrompts.filter((prompt) => prompt.code.startsWith(`${code}-`)).length,
        ]),
      ),
    [allPrompts],
  );

  const filteredPrompts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = allPrompts.filter((prompt) => {
      if (visibilityFilter !== 'all' && prompt.visibility !== visibilityFilter) {
        return false;
      }

      if (selectedCollection !== 'All Collections' && prompt.collection !== selectedCollection) {
        return false;
      }

      if (selectedCode !== 'All Codes' && !prompt.code.startsWith(`${selectedCode}-`)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        prompt.title,
        prompt.description,
        prompt.collection,
        prompt.code,
        ...prompt.tags,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });

    return filtered.sort((left, right) => {
      if (sortMode === 'az') {
        return left.title.localeCompare(right.title);
      }

      if (sortMode === 'recent') {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }

      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [allPrompts, search, selectedCode, selectedCollection, sortMode, visibilityFilter]);

  const nextCodeLabel = useMemo(
    () => generatePrivateCode(newCollection, privatePrompts),
    [newCollection, privatePrompts],
  );

  const touchPrompt = (id: string, visibility: PromptVisibility) => {
    const now = new Date().toISOString();

    if (visibility === 'public') {
      setPublicPrompts((current) =>
        current.map((prompt) =>
          prompt.id === id
            ? { ...prompt, usageCount: prompt.usageCount + 1, updatedAt: now }
            : prompt,
        ),
      );
      return;
    }

    setPrivatePrompts((current) =>
      current.map((prompt) =>
        prompt.id === id
          ? { ...prompt, usageCount: prompt.usageCount + 1, updatedAt: now }
          : prompt,
      ),
    );
  };

  const handleUsePrompt = (prompt: PromptItem) => {
    const nextValue = state.drafts.manager
      ? `${state.drafts.manager}\n\n${prompt.promptText}`
      : prompt.promptText;

    dispatch({ type: 'SET_DRAFT', agent: 'manager', value: nextValue });
    touchPrompt(prompt.id, prompt.visibility);
    setToast('Inserted into Manager');
  };

  const handleCopyPrompt = async (prompt: PromptItem) => {
    const copied = await copyToClipboard(prompt.promptText);
    setToast(copied ? 'Copied to clipboard' : 'Clipboard copy failed');
  };

  const handleSaveAsPrivate = (prompt: PromptItem) => {
    const now = new Date().toISOString();
    const privatePrompt: PromptItem = {
      ...prompt,
      id: `private_prompt_${Date.now()}`,
      visibility: 'private',
      code: generatePrivateCode(prompt.collection, privatePrompts),
      usageCount: 0,
      updatedAt: now,
    };

    setPrivatePrompts((current) => [privatePrompt, ...current]);
    setToast('Saved as Private');
  };

  const resetPrivatePromptForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewPromptText('');
    setNewTags('');
    setNewCollection('AISync Workflows');
  };

  const handleCreatePrivatePrompt = () => {
    if (!newTitle.trim() || !newDescription.trim() || !newPromptText.trim()) {
      setToast('Title, description, and prompt text are required.');
      return;
    }

    const now = new Date().toISOString();
    const prompt: PromptItem = {
      id: `private_prompt_${Date.now()}`,
      visibility: 'private',
      collection: newCollection,
      code: generatePrivateCode(newCollection, privatePrompts),
      title: newTitle.trim(),
      description: newDescription.trim(),
      tags: newTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      promptText: newPromptText.trim(),
      usageCount: 0,
      updatedAt: now,
    };

    setPrivatePrompts((current) => [prompt, ...current]);
    setShowAddModal(false);
    resetPrivatePromptForm();
    setToast('Private prompt added');
  };

  const filterSidebar = (
    <aside
      data-prompts-sidebar
      className="ui-surface scrollbar-thin w-full overflow-y-auto px-4 py-4 sm:w-[220px] sm:shrink-0 md:w-[240px] lg:w-[278px]"
    >
      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-700">
          Collections
        </div>

        <div className="grid gap-1">
          <button
            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
              selectedCollection === 'All Collections'
                ? 'bg-[rgba(0,122,255,0.08)] text-[var(--color-accent-strong)]'
                : 'text-neutral-700 hover:bg-neutral-50'
            }`}
            onClick={() => setSelectedCollection('All Collections')}
          >
            <span>All Collections</span>
            <span className="text-neutral-400">{allPrompts.length}</span>
          </button>

          {COLLECTIONS.map((collection) => (
            <button
              key={collection}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                selectedCollection === collection
                  ? 'bg-[rgba(0,122,255,0.08)] text-[var(--color-accent-strong)]'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
              onClick={() => setSelectedCollection(collection)}
            >
              <span>{collection}</span>
              <span className="text-neutral-400">{collectionCounts[collection]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-700">
          Alphabet / Codes
        </div>

        <div className="grid gap-1">
          <button
            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
              selectedCode === 'All Codes'
                ? 'bg-[rgba(0,122,255,0.08)] text-[var(--color-accent-strong)]'
                : 'text-neutral-700 hover:bg-neutral-50'
            }`}
            onClick={() => setSelectedCode('All Codes')}
          >
            <span>All Codes</span>
            <span className="text-neutral-400">{allPrompts.length}</span>
          </button>

          {CODE_INDEX.map((code) => (
            <button
              key={code}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                selectedCode === code
                  ? 'bg-[rgba(0,122,255,0.08)] text-[var(--color-accent-strong)]'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
              onClick={() => setSelectedCode(code)}
            >
              <span>{code}</span>
              <span className="text-neutral-400">{codeCounts[code]}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );

  const promptsContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
      <div className="px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        <div className="ui-surface px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h1 className="ui-title">PROMPTS LIBRARY</h1>
              <p className="mt-1 text-sm text-neutral-600">
                Public and private prompt indexing for AISync workflows, startup execution, and reusable delivery patterns.
              </p>
            </div>

            <button
              className="ui-button ui-button-primary w-full text-white sm:w-auto"
              onClick={() => setShowAddModal(true)}
            >
              + Add Private Prompt
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="ui-surface mb-3 px-4 py-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
            <label className="grid gap-1">
              <span className="ui-label">Search</span>
              <input
                className="ui-input"
                placeholder="Search by title, tags, code, or collection"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="grid gap-1">
              <span className="ui-label">Visibility</span>
              <div className="flex flex-wrap gap-2">
                {(['all', 'public', 'private'] as VisibilityFilter[]).map((value) => (
                  <button
                    key={value}
                    className={`ui-button ${
                      visibilityFilter === value ? 'ui-button-primary text-white' : 'text-neutral-700'
                    }`}
                    onClick={() => setVisibilityFilter(value)}
                  >
                    {value === 'all'
                      ? 'All'
                      : value === 'public'
                        ? 'Public'
                        : 'Private'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_auto] xl:grid-cols-[auto]">
              <label className="grid gap-1">
                <span className="ui-label">Sort</span>
                <select
                  className="ui-input"
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                >
                  <option value="used">Most used</option>
                  <option value="az">A-Z</option>
                  <option value="recent">Recently added</option>
                </select>
              </label>

              <div className="grid gap-1 sm:self-end xl:hidden">
                <span className="ui-label sm:invisible">Filters</span>
                <button
                  data-prompts-filter-button
                  className="app-short-landscape-inline-flex ui-button text-neutral-700 sm:hidden"
                  onClick={() => setShowMobileFilters(true)}
                >
                  Filter / Index
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 gap-3">
          <div className="app-short-landscape-hide hidden sm:block">{filterSidebar}</div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="ui-surface mb-3 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="text-sm font-medium text-neutral-800">
                {filteredPrompts.length} prompt{filteredPrompts.length === 1 ? '' : 's'} visible
              </div>
              <div className="text-xs text-neutral-500">
                Manager draft length: {state.drafts.manager.length} chars
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              {filteredPrompts.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {filteredPrompts.map((prompt) => (
                    <div key={prompt.id} className="ui-surface px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`ui-pill ${
                                prompt.visibility === 'public'
                                  ? 'border-[rgba(0,122,255,0.15)] bg-[rgba(0,122,255,0.06)] text-[var(--color-accent-strong)]'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {prompt.visibility === 'public' ? 'Public' : 'Private'}
                            </span>
                            <span className="ui-pill text-neutral-700">{prompt.code}</span>
                            <span className="text-[11px] text-neutral-500">{prompt.collection}</span>
                          </div>

                          <h3 className="mt-3 text-base font-semibold tracking-[-0.01em] text-neutral-900">
                            {prompt.title}
                          </h3>
                          <p className="mt-1 text-sm text-neutral-600">{prompt.description}</p>
                        </div>

                        <div className="shrink-0 text-right text-[11px] text-neutral-500">
                          <div>Used {prompt.usageCount}x</div>
                          <div>{formatDate(prompt.updatedAt)}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {prompt.tags.map((tag) => (
                          <span key={`${prompt.id}_${tag}`} className="ui-pill text-neutral-600">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="ui-surface-subtle mt-4 px-3 py-3 text-xs leading-5 text-neutral-700">
                        {prompt.promptText}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="ui-button ui-button-primary text-white"
                          onClick={() => handleUsePrompt(prompt)}
                        >
                          Use
                        </button>
                        <button
                          className="ui-button text-neutral-700"
                          onClick={() => void handleCopyPrompt(prompt)}
                        >
                          Copy
                        </button>
                        {prompt.visibility === 'public' && (
                          <button
                            className="ui-button text-neutral-700"
                            onClick={() => handleSaveAsPrivate(prompt)}
                          >
                            Save as Private
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ui-surface flex h-full min-h-[220px] items-center justify-center px-6 text-center text-sm text-neutral-500">
                  No prompts match the current filters.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface app-short-landscape-flex flex items-center justify-between gap-3 px-3 py-2 sm:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Manager Panel
          </div>
          <button
            className="ui-button min-h-9 px-3 text-xs text-neutral-700"
            onClick={() => setShowManagerMobile((value) => !value)}
          >
            {showManagerMobile ? 'Hide Manager' : 'Show Manager'}
          </button>
        </div>

        {showManagerMobile && (
          <div className="app-frame app-short-landscape-flex flex h-[46dvh] min-h-0 overflow-hidden sm:hidden">
            <AgentPanel agent="manager" />
          </div>
        )}

        <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
          {promptsContent}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
          <AgentPanel agent="manager" className="w-[280px] shrink-0 md:w-[320px] lg:w-[432px]" />
          <DividerRail />
          {promptsContent}
        </div>
      </div>

      {showMobileFilters && (
        <div
          className="app-short-landscape-block fixed inset-0 z-[160] bg-black/45 p-4 sm:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowMobileFilters(false);
            }
          }}
        >
          <div className="ui-modal-surface mx-auto flex h-full max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-200/80 px-4 py-3">
              <h3 className="text-base font-semibold text-neutral-900">Filter / Index</h3>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                onClick={() => setShowMobileFilters(false)}
              >
                x
              </button>
            </div>
            <div className="scrollbar-thin overflow-y-auto p-4">{filterSidebar}</div>
          </div>
        </div>
      )}

      {showAddModal && (
        <Modal
          title="Add Private Prompt"
          onClose={() => {
            setShowAddModal(false);
            resetPrivatePromptForm();
          }}
          width="max-w-2xl"
        >
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="ui-label">Title</span>
              <input
                className="ui-input"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                autoFocus
              />
            </label>

            <label className="grid gap-1">
              <span className="ui-label">Description</span>
              <input
                className="ui-input"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
              />
            </label>

            <label className="grid gap-1">
              <span className="ui-label">Prompt text</span>
              <textarea
                className="ui-input min-h-[120px] py-3"
                value={newPromptText}
                onChange={(event) => setNewPromptText(event.target.value)}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="ui-label">Tags</span>
                <input
                  className="ui-input"
                  value={newTags}
                  onChange={(event) => setNewTags(event.target.value)}
                  placeholder="ops, startup, handoff"
                />
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Collection</span>
                <select
                  className="ui-input"
                  value={newCollection}
                  onChange={(event) =>
                    setNewCollection(event.target.value as (typeof COLLECTIONS)[number])
                  }
                >
                  {COLLECTIONS.map((collection) => (
                    <option key={collection} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ui-surface-subtle px-3 py-3 text-xs text-neutral-600">
              <div className="font-medium text-neutral-800">Code label</div>
              <div className="mt-1">{nextCodeLabel}</div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="ui-button text-neutral-700"
                onClick={() => {
                  setShowAddModal(false);
                  resetPrivatePromptForm();
                }}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button-primary text-white"
                onClick={handleCreatePrivatePrompt}
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
