import React from 'react';
import katex from 'katex';
import { CopyButton } from './CopyButton';

interface LatexBlockProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export const LatexBlock: React.FC<LatexBlockProps> = ({
  latex,
  displayMode = true,
  className = '',
}) => {
  const cleaned = latex.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim();
  let html = '';
  try {
    html = katex.renderToString(cleaned, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    html = '';
  }

  if (!html) {
    return <code className={`font-mono text-xs ${className}`}>{latex}</code>;
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders prose containing fenced code blocks, $$display$$, or $inline$ LaTeX math segments via KaTeX.
 * Uses block-styled spans/code elements so it remains valid inside <p> containers.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split by fenced ```code``` blocks, $$...$$ display math, and $...$ inline math
  const tokens = text.split(/(```[\s\S]*?```|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (token.startsWith('```') && token.endsWith('```') && token.length >= 6) {
          const raw = token.slice(3, -3);
          const firstNewline = raw.indexOf('\n');
          const langTag = firstNewline > 0 ? raw.slice(0, firstNewline).trim() : '';
          const codeBody = (firstNewline >= 0 ? raw.slice(firstNewline + 1) : raw).replace(/^\n+|\n+$/g, '');
          return (
            <span
              key={idx}
              className="block my-2.5 bg-slate-50 dark:bg-[#090e14] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
            >
              <span className="px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-[#111923] flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {langTag || 'Code'}
                </span>
                <CopyButton text={codeBody} label="Copy" ariaLabel="Copy code block to clipboard" />
              </span>
              <code className="block p-3 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {codeBody}
              </code>
            </span>
          );
        }

        if (token.startsWith('$$') && token.endsWith('$$') && token.length > 4) {
          const inner = token.slice(2, -2).trim();
          return (
            <span
              key={idx}
              className="block my-2.5 bg-slate-50 dark:bg-[#090e14] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
            >
              <span className="px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-[#111923] flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  LaTeX Equation
                </span>
                <CopyButton text={inner} label="Copy LaTeX" ariaLabel="Copy LaTeX equation to clipboard" />
              </span>
              <span className="block px-4 py-3 text-slate-900 dark:text-slate-50 overflow-x-auto">
                <LatexBlock latex={inner} displayMode={true} />
              </span>
            </span>
          );
        }

        if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
          const inner = token.slice(1, -1).trim();
          return (
            <LatexBlock
              key={idx}
              latex={inner}
              displayMode={false}
              className="inline-block align-middle mx-0.5"
            />
          );
        }

        return <React.Fragment key={idx}>{token}</React.Fragment>;
      })}
    </span>
  );
};
