import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  ScanSearch,
  Eraser,
  AlertCircle,
  SlidersHorizontal,
  ArrowUpRight,
  Sigma,
  History,
  FileCode2,
  Sun,
  Moon,
  Mail,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { AuthBar } from './components/AuthBar';
import { TopBar, ActiveSectionTab } from './components/TopBar';
import { SidebarHistory } from './components/SidebarHistory';
import { AnalysisView } from './components/AnalysisView';
import {
  ensureUserProfile,
  updateUserPreferences,
  saveAnalysisToFirestore,
  updateAnalysisFollowUpsInFirestore,
  deleteAnalysisFromFirestore,
  subscribeUserAnalyses,
} from './services/firestoreHistory';
import {
  AnalysisMode,
  AnalysisResult,
  AuditRigor,
  FollowUpMessage,
  OutputLanguage,
  SavedSession,
} from './types/analysis';
import { PRESET_CASES, PresetCase } from './data/presets';
import { runStructuralPrecheck } from './utils/precheck';

function loadLocalSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem('resolved_by_aryan_sessions_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const STORAGE_KEY_SESSIONS = 'resolved_by_aryan_sessions_v1';
const STORAGE_KEY_THEME = 'resolved_by_aryan_theme_v2';

const DARK_WALLPAPER_URL = '/src/assets/images/math_chalkboard_wallpaper_1795179153886.jpg';
const LIGHT_WALLPAPER_URL = '/src/assets/images/math_parchment_wallpaper_1795179154302.jpg';

const MODES: { id: AnalysisMode; label: string }[] = [
  { id: 'auto', label: 'Auto-Detect' },
  { id: 'math', label: 'Math & Equations' },
  { id: 'data', label: 'Data & Types' },
  { id: 'prompt', label: 'Prompt & Task' },
  { id: 'sql', label: 'SQL & Query' },
  { id: 'code', label: 'Code & Logic' },
];

const LANGUAGES: { id: OutputLanguage; label: string }[] = [
  { id: 'english', label: 'English' },
  { id: 'roman_urdu', label: 'Roman Urdu' },
  { id: 'bilingual', label: 'Bilingual' },
];

const RIGOR_OPTIONS: { id: AuditRigor; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'strict', label: 'Strict Prod' },
  { id: 'academic', label: 'Academic Proof' },
];

const MATH_SYMBOLS: { symbol: string; label: string }[] = [
  { symbol: '∑', label: 'Summation' },
  { symbol: '∏', label: 'Product' },
  { symbol: '∫', label: 'Integral' },
  { symbol: '√', label: 'Square root' },
  { symbol: 'Δ', label: 'Delta / Change' },
  { symbol: 'π', label: 'Pi' },
  { symbol: 'θ', label: 'Theta' },
  { symbol: 'α', label: 'Alpha' },
  { symbol: 'β', label: 'Beta' },
  { symbol: 'λ', label: 'Lambda' },
  { symbol: 'σ', label: 'Sigma' },
  { symbol: 'μ', label: 'Mu / Mean' },
  { symbol: '∀', label: 'For all' },
  { symbol: '∃', label: 'There exists' },
  { symbol: '∈', label: 'Element of' },
  { symbol: '⇒', label: 'Implies' },
  { symbol: '≠', label: 'Not equal' },
  { symbol: '≤', label: 'Less or equal' },
  { symbol: '≥', label: 'Greater or equal' },
  { symbol: '≈', label: 'Approximately' },
  { symbol: '±', label: 'Plus minus' },
  { symbol: '∞', label: 'Infinity' },
  { symbol: 'ℝ', label: 'Real numbers' },
  { symbol: 'ℤ', label: 'Integers' },
];

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'light') return false;
      return true;
    } catch {
      return true;
    }
  });

  const [wallpaperFailed, setWallpaperFailed] = useState<boolean>(false);

  const [sessions, setSessions] = useState<SavedSession[]>(() => loadLocalSessions());

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const initial = loadLocalSessions();
    return initial.length > 0 ? initial[0].analysis.id : null;
  });

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [profileReadyUid, setProfileReadyUid] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [inputText, setInputText] = useState<string>('');
  const [contextNote, setContextNote] = useState<string>('');
  const [showContextField, setShowContextField] = useState<boolean>(false);
  const [showSymbolBar, setShowSymbolBar] = useState<boolean>(true);
  const [mode, setMode] = useState<AnalysisMode>('auto');
  const [rigor, setRigor] = useState<AuditRigor>('standard');
  const [language, setLanguage] = useState<OutputLanguage>('bilingual');
  const [activeSection, setActiveSection] = useState<ActiveSectionTab>('workbench');

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'history' | 'presets'>('history');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsAnchorRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<User | null>(null);
  const initialCloudLoadRef = useRef<boolean>(false);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    setWallpaperFailed(false);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage quota errors
    }
  }, [darkMode]);

  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!nextUser) {
        const wasSignedIn = userRef.current !== null;
        userRef.current = null;
        setUser(null);
        setProfileReadyUid(null);
        setAuthReady(true);
        if (wasSignedIn) {
          const local = loadLocalSessions();
          setSessions(local);
          setActiveSessionId(local.length > 0 ? local[0].analysis.id : null);
        }
        return;
      }

      userRef.current = nextUser;
      setUser(nextUser);
      setAuthReady(true);
      initialCloudLoadRef.current = true;

      try {
        const prefs = await ensureUserProfile(nextUser, {
          preferredLanguage: language,
          preferredRigor: rigor,
        });
        if (cancelled || userRef.current?.uid !== nextUser.uid) return;

        setLanguage(prefs.preferredLanguage);
        setRigor(prefs.preferredRigor);
        setProfileReadyUid(nextUser.uid);

        unsubFirestore = subscribeUserAnalyses(
          nextUser.uid,
          (cloudSessions) => {
            setSessions(cloudSessions);
            if (initialCloudLoadRef.current) {
              initialCloudLoadRef.current = false;
              setActiveSessionId(cloudSessions.length > 0 ? cloudSessions[0].analysis.id : null);
            } else {
              setActiveSessionId((prev) => {
                if (prev === null) return null;
                if (cloudSessions.some((s) => s.analysis.id === prev)) return prev;
                return cloudSessions.length > 0 ? cloudSessions[0].analysis.id : null;
              });
            }
          },
          (err) => {
            setFatalError(err);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubFirestore) {
        unsubFirestore();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authReady || user) return;
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions.slice(0, 30)));
    } catch {
      // Ignore storage quota errors
    }
  }, [sessions, authReady, user]);

  const activeSession = sessions.find((s) => s.analysis.id === activeSessionId) ?? null;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setErrorMsg(err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMsg(null);
    try {
      await signOut(auth);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to sign out.');
    }
  };

  const handleChangeLanguage = (nextLang: OutputLanguage) => {
    setLanguage(nextLang);
    if (user && profileReadyUid === user.uid) {
      void updateUserPreferences(user.uid, {
        preferredLanguage: nextLang,
        preferredRigor: rigor,
      }).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  };

  const handleChangeRigor = (nextRigor: AuditRigor) => {
    setRigor(nextRigor);
    if (user && profileReadyUid === user.uid) {
      void updateUserPreferences(user.uid, {
        preferredLanguage: language,
        preferredRigor: nextRigor,
      }).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  };

  const insertSymbolAtCursor = (sym: string) => {
    const el = textareaRef.current;
    if (!el) {
      setInputText((prev) => prev + sym);
      return;
    }
    const start = el.selectionStart ?? inputText.length;
    const end = el.selectionEnd ?? inputText.length;
    const updated = inputText.slice(0, start) + sym + inputText.slice(end);
    setInputText(updated);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + sym.length, start + sym.length);
    });
  };

  const runAnalysis = async (overrideInput?: string, overrideMode?: AnalysisMode) => {
    const textToAnalyze = (overrideInput ?? inputText).trim();
    const effectiveMode = overrideMode ?? mode;

    if (textToAnalyze.length < 2) {
      setErrorMsg('Please paste a math equation, dataset, task prompt, SQL query, or code snippet to analyze.');
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: textToAnalyze,
          mode: effectiveMode,
          language,
          rigor,
          contextNote,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `Analysis failed with status ${res.status}`);
      }

      const newSession: SavedSession = {
        analysis: payload as AnalysisResult,
        followUps: [],
      };

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.analysis.id);
      setActiveSection('workbench');

      if (userRef.current) {
        const activeUid = userRef.current.uid;
        if (profileReadyUid !== activeUid) {
          await ensureUserProfile(userRef.current, {
            preferredLanguage: language,
            preferredRigor: rigor,
          });
          setProfileReadyUid(activeUid);
        }
        await saveAnalysisToFirestore(activeUid, newSession);
      }

      setTimeout(() => {
        resultsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete analysis.';
      if (msg.startsWith('{"error":')) {
        setFatalError(err instanceof Error ? err : new Error(msg));
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectSession = (id: string) => {
    const found = sessions.find((s) => s.analysis.id === id);
    if (!found) return;
    setActiveSessionId(id);
    setInputText(found.analysis.originalInput);
    setMode(found.analysis.modeUsed);
    setLanguage(found.analysis.languageUsed);
    setActiveSection('workbench');
    setErrorMsg(null);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.analysis.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(next.length > 0 ? next[0].analysis.id : null);
      }
      return next;
    });
    if (userRef.current) {
      void deleteAnalysisFromFirestore(userRef.current.uid, id).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  };

  const handleNewCheck = () => {
    setActiveSessionId(null);
    setInputText('');
    setContextNote('');
    setErrorMsg(null);
    setActiveSection('workbench');
  };

  const handleLoadPreset = (preset: PresetCase) => {
    setInputText(preset.input);
    setMode(preset.mode);
    setErrorMsg(null);
    setActiveSection('workbench');
    void runAnalysis(preset.input, preset.mode);
  };

  const handleReverifyResolved = (resolvedText: string) => {
    setInputText(resolvedText);
    void runAnalysis(resolvedText, mode);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setInputText(text.slice(0, 40000));
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'json' || ext === 'csv') setMode('data');
      else if (ext === 'sql') setMode('sql');
      else if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'py') setMode('code');
      else if (ext === 'md' || ext === 'txt') setMode('prompt');
      setErrorMsg(null);
    } catch {
      setErrorMsg('Could not read the selected file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSendFollowUp = async (question: string) => {
    if (!activeSession) return;
    const userMessage: FollowUpMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };

    const sessionId = activeSession.analysis.id;
    const updatedWithUser = [...activeSession.followUps, userMessage];
    setSessions((prev) =>
      prev.map((s) =>
        s.analysis.id === sessionId ? { ...s, followUps: updatedWithUser } : s
      )
    );

    setIsFollowUpLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalInput: activeSession.analysis.originalInput,
          analysisSummary: `${activeSession.analysis.verdictHeadline}\n${activeSession.analysis.executiveSummary}\n${activeSession.analysis.patternDifferentiationSummary}`,
          resolvedOutput: activeSession.analysis.resolvedOutput,
          question,
          history: activeSession.followUps,
          language,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Follow-up request failed.');
      }

      const assistantMessage: FollowUpMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: payload.answer,
        createdAt: new Date().toISOString(),
      };

      const finalFollowUps = [...updatedWithUser, assistantMessage];
      setSessions((prev) =>
        prev.map((s) =>
          s.analysis.id === sessionId ? { ...s, followUps: finalFollowUps } : s
        )
      );

      if (userRef.current) {
        await updateAnalysisFollowUpsInFirestore(userRef.current.uid, sessionId, finalFollowUps);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Follow-up request failed.';
      if (msg.startsWith('{"error":')) {
        setFatalError(err instanceof Error ? err : new Error(msg));
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const handleSelectSection = (section: ActiveSectionTab) => {
    setActiveSection(section);
    if (section !== 'workbench') {
      const targetId = `section-${section}`;
      setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const lineCount = inputText ? inputText.split('\n').length : 0;
  const charCount = inputText.length;
  const precheck = runStructuralPrecheck(inputText);
  const activeWallpaper = darkMode ? DARK_WALLPAPER_URL : LIGHT_WALLPAPER_URL;

  return (
    <div id="top" className="relative min-h-screen text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Full-Viewport Background Wallpaper Layer with Measured Readability Scrim */}
      <div className="fixed inset-0 -z-10 pointer-events-none studio-backdrop-fallback overflow-hidden">
        {!wallpaperFailed && (
          <img
            src={activeWallpaper}
            alt={darkMode ? 'Dark mathematical chalkboard studio wallpaper' : 'Architectural mathematical drafting paper wallpaper'}
            referrerPolicy="no-referrer"
            onError={() => setWallpaperFailed(true)}
            className="w-full h-full object-cover object-center opacity-100"
          />
        )}
        <div
          className={`absolute inset-0 transition-colors duration-300 ${
            darkMode
              ? 'bg-gradient-to-b from-[#090e14]/75 via-[#090e14]/82 to-[#090e14]/92'
              : 'bg-gradient-to-b from-[#f4f6f9]/78 via-[#f4f6f9]/85 to-[#f4f6f9]/92'
          }`}
        />
      </div>

      <TopBar
        activeSection={activeSection}
        hasResult={Boolean(activeSession)}
        onSelectSection={handleSelectSection}
        onNewCheck={handleNewCheck}
      />

      <SidebarHistory
        sessions={sessions}
        activeSessionId={activeSessionId}
        open={drawerOpen}
        initialTab={drawerTab}
        isSignedIn={Boolean(user)}
        onSignIn={() => void handleSignIn()}
        onClose={() => setDrawerOpen(false)}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onLoadPreset={handleLoadPreset}
      />

      {/* Workspace Utility Strip below TopBar */}
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-[#0c1219]/75 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('history');
                setDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111923] border border-slate-200 dark:border-slate-800 hover:border-teal-600/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>History</span>
              <span className="tabular-nums text-slate-400">({sessions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawerTab('presets');
                setDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111923] border border-slate-200 dark:border-slate-800 hover:border-teal-600/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Sample Cases</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Explanation:
              </span>
              <div className="flex items-center p-0.5 bg-white dark:bg-[#111923] border border-slate-200 dark:border-slate-800 rounded-lg">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => handleChangeLanguage(lang.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      language === lang.id
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light drafting paper theme' : 'Switch to dark chalkboard theme'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111923] border border-slate-200 dark:border-slate-800 hover:border-teal-600/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
              <span>{darkMode ? 'Drafting Light' : 'Chalkboard Dark'}</span>
            </button>

            <AuthBar
              user={user}
              authReady={authReady}
              isSigningIn={isSigningIn}
              onSignIn={() => void handleSignIn()}
              onSignOut={() => void handleSignOut()}
            />
          </div>
        </div>
      </div>

      {/* Main 2-Column Split Studio */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sticky Column: Problem & Equation Composer */}
          <section
            aria-label="Problem and Equation Composer"
            className="lg:col-span-5 lg:sticky lg:top-20 space-y-4"
          >
            <div className="space-y-1.5">
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 [text-wrap:balance]">
                Equations, data types &amp; pattern proof studio
              </h1>
              <p className="font-math-serif text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Submit any math problem, formula, variable dataset, SQL query, or task prompt to differentiate sound vs. flawed patterns and derive the resolved fix.
              </p>
            </div>

            <div className="bg-white/95 dark:bg-[#0e151e]/95 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              {/* Mode Selector */}
              <div className="px-3.5 py-2.5 bg-slate-50/90 dark:bg-[#131c27] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      mode === m.id
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Action Strip */}
              <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowSymbolBar((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      showSymbolBar
                        ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Sigma className="w-3.5 h-3.5" />
                    <span>Symbols</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.csv,.sql,.md,.ts,.tsx,.js,.py"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowContextField((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      showContextField || contextNote
                        ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Constraints</span>
                  </button>
                </div>

                {inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Mathematical Symbols Quick-Insert Strip */}
              {showSymbolBar && (
                <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0b1017] flex items-center gap-1 overflow-x-auto">
                  {MATH_SYMBOLS.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      title={item.label}
                      aria-label={`Insert ${item.label} (${item.symbol})`}
                      onClick={() => insertSymbolAtCursor(item.symbol)}
                      className="w-7 h-7 shrink-0 flex items-center justify-center font-math-serif text-sm text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:text-teal-700 dark:hover:text-teal-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded transition-colors cursor-pointer"
                    >
                      {item.symbol}
                    </button>
                  ))}
                </div>
              )}

              {/* Optional Domain Constraints Input */}
              {showContextField && (
                <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-[#0b1017]">
                  <input
                    type="text"
                    value={contextNote}
                    onChange={(e) => setContextNote(e.target.value)}
                    placeholder="Domain or type constraints (e.g., x ∈ ℝ⁺, Decimal(10,2), PostgreSQL 16)..."
                    className="w-full text-xs sm:text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              )}

              {/* Editor */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void runAnalysis();
                  }
                }}
                rows={12}
                placeholder="Paste a math equation or proof, dataset with variable types (JSON/CSV), SQL query, or task prompt..."
                aria-label="Math problem, task, or data input"
                className="w-full p-4 text-xs sm:text-sm font-mono bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none resize-y leading-relaxed"
              />

              {/* Rigor & Constraints Strip */}
              <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0b1017] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Evaluation Rigor:
                </span>
                <div className="flex items-center gap-1">
                  {RIGOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChangeRigor(opt.id)}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                        rigor === opt.id
                          ? 'bg-teal-700 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-slate-50/90 dark:bg-[#131c27] border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>{lineCount} lines</span>
                  <span aria-hidden="true">·</span>
                  <span>{charCount} chars</span>
                  {precheck && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          precheck.kind === 'warning'
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                            : precheck.kind === 'ok'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {precheck.message}
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isAnalyzing || inputText.trim().length < 2}
                  onClick={() => void runAnalysis()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ScanSearch className="w-4 h-4" />
                  <span>{isAnalyzing ? 'Solving & Differentiating...' : 'Analyze & Resolve'}</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-4 bg-red-50/95 dark:bg-[#231216]/95 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-800 dark:text-red-300"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </section>

          {/* Right Solution & Proof Canvas */}
          <section ref={resultsAnchorRef} className="lg:col-span-7 space-y-6">
            {/* Empty / Showcase State featuring the Mathematical Studio Wallpaper */}
            {!activeSession && !isAnalyzing && (
              <div className="space-y-6">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[240px] flex items-end bg-slate-900">
                  {!wallpaperFailed && (
                    <img
                      src={activeWallpaper}
                      alt={darkMode ? 'Mathematical chalkboard geometry artwork' : 'Drafting geometry artwork'}
                      referrerPolicy="no-referrer"
                      onError={() => setWallpaperFailed(true)}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  )}
                  <div
                    className={`absolute inset-0 ${
                      darkMode
                        ? 'bg-gradient-to-t from-[#090e14]/95 via-[#090e14]/55 to-[#090e14]/20'
                        : 'bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-transparent'
                    }`}
                  />
                  <div className="relative z-10 p-6 sm:p-7 max-w-2xl space-y-2.5">
                    <p className="text-xs font-medium text-teal-300">
                      4-Stage Inspection Pipeline · Symbol &amp; Pattern Proof · 100% Free
                    </p>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-white [text-wrap:balance]">
                      Differentiate sound patterns from traps, validate correctness, and resolve errors
                    </h2>
                    <p className="font-math-serif text-sm text-slate-200 leading-relaxed">
                      Every submission produces a Symbol &amp; Data Type Ledger, Step-by-Step KaTeX Equations, a Good vs. Bad Pattern Comparison, and a Verified Fix.
                    </p>
                    {authReady && !user && (
                      <div className="pt-1 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={isSigningIn}
                          onClick={() => void handleSignIn()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{isSigningIn ? 'Connecting Gmail...' : 'Sign in with Gmail'}</span>
                        </button>
                        <span className="text-xs text-slate-300">
                          Free access for all users · No subscription charges
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sample Problems Grid */}
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Quick Start — Sample Equations &amp; Data Problems
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Click any card to run
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PRESET_CASES.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleLoadPreset(preset)}
                        className="group text-left p-4 bg-white/95 dark:bg-[#0e151e]/95 border border-slate-200 dark:border-slate-800 hover:border-teal-600/70 dark:hover:border-teal-500/70 rounded-xl transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                            {preset.category}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                        </div>
                        <p className="mt-1.5 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {preset.title}
                        </p>
                        <p className="mt-1 font-math-serif text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {preset.summary}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loading Skeleton */}
            {isAnalyzing && (
              <div className="space-y-6 animate-pulse" aria-busy="true">
                <div className="p-6 bg-white/95 dark:bg-[#0e151e]/95 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-7 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-4 w-full bg-slate-100 dark:bg-slate-900 rounded" />
                  <div className="h-4 w-5/6 bg-slate-100 dark:bg-slate-900 rounded" />
                </div>

                <div className="h-44 bg-white/95 dark:bg-[#0e151e]/95 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-24 bg-slate-100 dark:bg-slate-900 rounded" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <div className="h-64 bg-white/95 dark:bg-[#0e151e]/95 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-20 bg-slate-100 dark:bg-slate-900 rounded" />
                  </div>
                  <div className="h-64 bg-white/95 dark:bg-[#0e151e]/95 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-20 bg-slate-100 dark:bg-slate-900 rounded" />
                  </div>
                </div>
              </div>
            )}

            {/* Active Analysis Sheet */}
            {!isAnalyzing && activeSession && (
              <AnalysisView
                analysis={activeSession.analysis}
                followUps={activeSession.followUps}
                activeSection={activeSection}
                darkMode={darkMode}
                isFollowUpLoading={isFollowUpLoading}
                isReanalyzing={isAnalyzing}
                onReverifyResolved={handleReverifyResolved}
                onSendFollowUp={handleSendFollowUp}
              />
            )}
          </section>
        </div>
      </main>

      {/* Author & Contact Footer */}
      <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0c1219]/85 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
            <span className="font-display font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="text-teal-700 dark:text-teal-400">#ArYan</span>LyticS.Ai/
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">·</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              100% Free · No Subscription Charges
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">·</span>
            <span className="text-slate-500 dark:text-slate-400">Author:</span>
            <span className="font-display font-extrabold tracking-tight text-slate-900 dark:text-white">
              #ArYan JaN BaLoch
            </span>
          </div>

          <a
            href="mailto:balocharyanjan@gmail.com"
            className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>balocharyanjan@gmail.com</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
