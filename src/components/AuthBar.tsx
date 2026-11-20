import React from 'react';
import { User } from 'firebase/auth';
import { Mail, LogOut, Cloud } from 'lucide-react';

interface AuthBarProps {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AuthBar: React.FC<AuthBarProps> = ({
  user,
  authReady,
  isSigningIn,
  onSignIn,
  onSignOut,
}) => {
  if (!authReady) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        Checking Gmail session...
      </span>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="hidden xl:inline text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          100% Free · No subscription charges
        </span>
        <button
          type="button"
          disabled={isSigningIn}
          onClick={onSignIn}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-600 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>{isSigningIn ? 'Connecting Gmail...' : 'Sign in with Gmail'}</span>
        </button>
      </div>
    );
  }

  const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-2 min-w-0">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Signed in Gmail user'}
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0"
          />
        ) : (
          <span className="w-6 h-6 rounded-full bg-teal-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
            {initial}
          </span>
        )}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 min-w-0">
          <span className="font-medium truncate max-w-[150px]">
            {user.displayName || user.email}
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium whitespace-nowrap">
            <Cloud className="w-3 h-3" />
            <span>Gmail Synced · Free</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-[#111923] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Sign out</span>
      </button>
    </div>
  );
};
