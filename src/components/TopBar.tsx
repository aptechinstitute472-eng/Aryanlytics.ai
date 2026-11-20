import React from 'react';

export type ActiveSectionTab = 'workbench' | 'diagnosis' | 'patterns' | 'resolution';

interface TopBarProps {
  activeSection: ActiveSectionTab;
  hasResult: boolean;
  onSelectSection: (section: ActiveSectionTab) => void;
  onNewCheck: () => void;
}

const NAV_ITEMS: { id: ActiveSectionTab; label: string; requiresResult?: boolean }[] = [
  { id: 'workbench', label: 'Studio' },
  { id: 'diagnosis', label: 'Diagnosis', requiresResult: true },
  { id: 'patterns', label: 'Patterns', requiresResult: true },
  { id: 'resolution', label: 'Resolution', requiresResult: true },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  hasResult,
  onSelectSection,
  onNewCheck,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-8 h-14 bg-white/90 dark:bg-[#0c1219]/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90">
      {/* Zone 1: Single-line brand wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectSection('workbench');
        }}
        className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-600 rounded"
      >
        <span className="text-teal-700 dark:text-teal-400">#ArYan</span>LyticS.Ai/
      </a>

      {/* Zone 2: Concise single-line text nav links */}
      <nav className="hidden md:flex items-center gap-6" aria-label="Workspace sections">
        {NAV_ITEMS.map((item) => {
          const disabled = item.requiresResult && !hasResult;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectSection(item.id)}
              className={`py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors border-b-2 focus-visible:outline-2 focus-visible:outline-teal-600 ${
                disabled
                  ? 'border-transparent text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  : isActive
                  ? 'border-teal-600 dark:border-teal-400 text-slate-900 dark:text-slate-50'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onNewCheck}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-600 active:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 cursor-pointer"
        >
          New Check
        </button>
      </div>
    </header>
  );
};
