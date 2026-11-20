import React, { useState, useMemo } from 'react';
import { Search, Trash2, X, FileCode2, History, Mail } from 'lucide-react';
import { SavedSession, VerdictStatus } from '../types/analysis';
import { PRESET_CASES, PresetCase } from '../data/presets';

interface SidebarHistoryProps {
  sessions: SavedSession[];
  activeSessionId: string | null;
  open: boolean;
  initialTab: 'history' | 'presets';
  isSignedIn?: boolean;
  onSignIn?: () => void;
  onClose: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onLoadPreset: (preset: PresetCase) => void;
}

const VERDICT_LABEL: Record<VerdictStatus, string> = {
  valid: 'Valid',
  needs_refinement: 'Refine',
  flawed: 'Flawed',
};

const VERDICT_TEXT_COLOR: Record<VerdictStatus, string> = {
  valid: 'text-emerald-700 dark:text-emerald-400',
  needs_refinement: 'text-amber-700 dark:text-amber-400',
  flawed: 'text-red-700 dark:text-red-400',
};

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  sessions,
  activeSessionId,
  open,
  initialTab,
  isSignedIn = false,
  onSignIn,
  onClose,
  onSelectSession,
  onDeleteSession,
  onLoadPreset,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'history' | 'presets'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'all' | VerdictStatus>('all');

  React.useEffect(() => {
    if (open) {
      setSidebarTab(initialTab);
    }
  }, [open, initialTab]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      const matchesVerdict = verdictFilter === 'all' || s.analysis.verdict === verdictFilter;
      const matchesQuery =
        !q ||
        s.analysis.title.toLowerCase().includes(q) ||
        s.analysis.detectedType.toLowerCase().includes(q) ||
        s.analysis.originalInput.toLowerCase().includes(q);
      return matchesVerdict && matchesQuery;
    });
  }, [sessions, searchQuery, verdictFilter]);

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="Checks History and Sample Cases"
        className="relative z-10 flex flex-col h-full w-[310px] max-w-[85vw] bg-white dark:bg-[#0d141d] border-r border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <span className="font-display text-sm font-semibold">Saved Workspace</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Switcher */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            <button
              type="button"
              onClick={() => setSidebarTab('history')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sidebarTab === 'history'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              <span className="tabular-nums text-slate-400 dark:text-slate-500">({sessions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('presets')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sidebarTab === 'presets'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Samples</span>
            </button>
          </div>
        </div>

        {sidebarTab === 'history' ? (
          <>
            {!isSignedIn && onSignIn && (
              <div className="px-3 py-2.5 bg-teal-50/70 dark:bg-teal-950/30 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  Sign in with Gmail to save &amp; sync checks across devices. <span className="font-semibold text-teal-700 dark:text-teal-400">100% Free — no subscription charges.</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignIn();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-600 rounded-md transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Sign in with Gmail</span>
                </button>
              </div>
            )}

            <div className="px-3 pt-3 pb-2 space-y-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter checks..."
                  aria-label="Filter saved checks"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                {(['all', 'flawed', 'needs_refinement', 'valid'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setVerdictFilter(status)}
                    className={`py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                      verdictFilter === status
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {status === 'all' ? 'All' : VERDICT_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {filteredSessions.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {sessions.length === 0 ? 'No saved checks yet' : 'No matching checks'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {sessions.length === 0
                      ? 'Analyze an equation, dataset, or prompt to build your inspection log.'
                      : 'Clear your filter to view all checks.'}
                  </p>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const { analysis } = session;
                  const isSelected = analysis.id === activeSessionId;
                  return (
                    <div
                      key={analysis.id}
                      onClick={() => {
                        onSelectSession(analysis.id);
                        onClose();
                      }}
                      className={`group flex items-start justify-between gap-2 px-4 py-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/70 dark:bg-teal-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isSelected
                              ? 'text-teal-800 dark:text-teal-300'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {analysis.title}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          <span className={`font-medium ${VERDICT_TEXT_COLOR[analysis.verdict]}`}>
                            {VERDICT_LABEL[analysis.verdict]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{analysis.detectedType}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums shrink-0">{formatTimestamp(analysis.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${analysis.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(analysis.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {PRESET_CASES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onLoadPreset(preset);
                  onClose();
                }}
                className="w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
              >
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {preset.title}
                </p>
                <p className="mt-0.5 text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                  {preset.category}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {preset.summary}
                </p>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
};
