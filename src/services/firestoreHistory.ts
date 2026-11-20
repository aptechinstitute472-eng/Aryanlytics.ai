import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AuditRigor,
  FollowUpMessage,
  OutputLanguage,
  SavedSession,
} from '../types/analysis';

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

export async function ensureUserProfile(
  user: User,
  prefs: { preferredLanguage: OutputLanguage; preferredRigor: AuditRigor }
): Promise<{ preferredLanguage: OutputLanguage; preferredRigor: AuditRigor }> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    const displayName = (user.displayName ?? '').slice(0, 100);
    const email = (user.email ?? '').slice(0, 254);
    const photoURL = (user.photoURL ?? '').slice(0, 500);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        preferredLanguage: prefs.preferredLanguage,
        preferredRigor: prefs.preferredRigor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return prefs;
    } else {
      const existingData = snap.data();
      const savedLang = existingData?.preferredLanguage;
      const savedRigor = existingData?.preferredRigor;
      const resolvedLanguage: OutputLanguage =
        savedLang === 'english' || savedLang === 'roman_urdu' || savedLang === 'bilingual'
          ? savedLang
          : prefs.preferredLanguage;
      const resolvedRigor: AuditRigor =
        savedRigor === 'standard' || savedRigor === 'strict' || savedRigor === 'academic'
          ? savedRigor
          : prefs.preferredRigor;

      await updateDoc(userRef, {
        displayName,
        email,
        photoURL,
        updatedAt: serverTimestamp(),
      });
      return {
        preferredLanguage: resolvedLanguage,
        preferredRigor: resolvedRigor,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserPreferences(
  uid: string,
  prefs: { preferredLanguage: OutputLanguage; preferredRigor: AuditRigor }
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      preferredLanguage: prefs.preferredLanguage,
      preferredRigor: prefs.preferredRigor,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function saveAnalysisToFirestore(
  uid: string,
  session: SavedSession
): Promise<void> {
  const analysisId = sanitizeId(session.analysis.id);
  const docPath = `users/${uid}/analyses/${analysisId}`;

  const a = session.analysis;
  const payload = {
    id: analysisId,
    ownerId: uid,
    title: (a.title || 'Untitled Check').slice(0, 200),
    detectedType: (a.detectedType || 'Analysis').slice(0, 120),
    modeUsed: a.modeUsed,
    languageUsed: a.languageUsed,
    rigorUsed: a.rigorUsed ?? 'standard',
    verdict: a.verdict,
    verdictHeadline: (a.verdictHeadline || '').slice(0, 500),
    executiveSummary: (a.executiveSummary || '').slice(0, 4000),
    intentAnalysis: (a.intentAnalysis || '').slice(0, 4000),
    variablesAndSymbols: (a.variablesAndSymbols ?? []).slice(0, 30),
    equationSteps: (a.equationSteps ?? []).slice(0, 25),
    issues: (a.issues ?? []).slice(0, 30),
    goodPatterns: (a.goodPatterns ?? []).slice(0, 10),
    badPatterns: (a.badPatterns ?? []).slice(0, 10),
    patternDifferentiationSummary: (a.patternDifferentiationSummary || '').slice(0, 3000),
    isCorrectAsIs: Boolean(a.isCorrectAsIs),
    resolvedOutput: (a.resolvedOutput || '').slice(0, 60000),
    resolvedOutputFormat: a.resolvedOutputFormat || 'text',
    changesLog: (a.changesLog ?? []).slice(0, 40),
    verificationSteps: (a.verificationSteps ?? [])
      .slice(0, 15)
      .map((s) => String(s).slice(0, 1000)),
    originalInput: (a.originalInput || '').slice(0, 50000),
    followUps: (session.followUps ?? []).slice(0, 50),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'analyses', analysisId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateAnalysisFollowUpsInFirestore(
  uid: string,
  analysisId: string,
  followUps: FollowUpMessage[]
): Promise<void> {
  const safeId = sanitizeId(analysisId);
  const docPath = `users/${uid}/analyses/${safeId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'analyses', safeId), {
      followUps: followUps.slice(-50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteAnalysisFromFirestore(
  uid: string,
  analysisId: string
): Promise<void> {
  const safeId = sanitizeId(analysisId);
  const docPath = `users/${uid}/analyses/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'analyses', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeUserAnalyses(
  uid: string,
  onSessions: (sessions: SavedSession[]) => void,
  onError: (err: Error) => void
): () => void {
  const collectionPath = `users/${uid}/analyses`;
  const q = query(
    collection(db, 'users', uid, 'analyses'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedSession[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtTs = data.createdAt as Timestamp | undefined;
        const createdAtIso =
          createdAtTs && typeof createdAtTs.toDate === 'function'
            ? createdAtTs.toDate().toISOString()
            : new Date().toISOString();

        return {
          analysis: {
            id: String(data.id ?? docSnap.id),
            createdAt: createdAtIso,
            title: String(data.title ?? 'Saved Check'),
            detectedType: String(data.detectedType ?? 'Analysis'),
            modeUsed: data.modeUsed ?? 'auto',
            languageUsed: data.languageUsed ?? 'english',
            rigorUsed: data.rigorUsed ?? 'standard',
            verdict: data.verdict ?? 'needs_refinement',
            verdictHeadline: String(data.verdictHeadline ?? ''),
            executiveSummary: String(data.executiveSummary ?? ''),
            intentAnalysis: String(data.intentAnalysis ?? ''),
            variablesAndSymbols: Array.isArray(data.variablesAndSymbols)
              ? data.variablesAndSymbols
              : [],
            equationSteps: Array.isArray(data.equationSteps) ? data.equationSteps : [],
            issues: Array.isArray(data.issues) ? data.issues : [],
            goodPatterns: Array.isArray(data.goodPatterns) ? data.goodPatterns : [],
            badPatterns: Array.isArray(data.badPatterns) ? data.badPatterns : [],
            patternDifferentiationSummary: String(data.patternDifferentiationSummary ?? ''),
            isCorrectAsIs: Boolean(data.isCorrectAsIs),
            resolvedOutput: String(data.resolvedOutput ?? ''),
            resolvedOutputFormat: data.resolvedOutputFormat ?? 'text',
            changesLog: Array.isArray(data.changesLog) ? data.changesLog : [],
            verificationSteps: Array.isArray(data.verificationSteps)
              ? data.verificationSteps
              : [],
            originalInput: String(data.originalInput ?? ''),
          },
          followUps: Array.isArray(data.followUps) ? data.followUps : [],
        };
      });
      onSessions(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
