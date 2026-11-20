import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBank } from '../contexts/BankContext';
import { useUserData } from '../contexts/UserDataContext';
import { clearRun, getRun, putRun } from '../services/repository';
import { buildSession } from '../services/runs';
import type { ActiveRun, SessionMode } from '../types';

/** 讀取／更新進行中的測驗。每次更新都會寫入 IndexedDB，重新整理後可以還原。 */
export function useActiveRun(mode: SessionMode) {
  const { scope } = useUserData();
  const [run, setRun] = useState<ActiveRun | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getRun(scope, mode).then((r) => alive && setRun(r ?? null));
    return () => {
      alive = false;
    };
  }, [scope, mode]);

  const update = useCallback(
    (fn: (r: ActiveRun) => ActiveRun) => {
      setRun((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        void putRun(scope, next);
        return next;
      });
    },
    [scope],
  );
  const clear = useCallback(async () => {
    await clearRun(scope, mode);
    setRun(null);
  }, [scope, mode]);

  return { run, update, clear };
}

/** 結束測驗：產生成績、寫入紀錄、更新錯題、清除暫存。同一個 session 只會寫入一次。 */
export function useFinalize() {
  const { index } = useBank();
  const { saveSession, recordWrong, scope } = useUserData();
  const navigate = useNavigate();
  const lock = useRef(false);

  return useCallback(
    async (run: ActiveRun): Promise<void> => {
      if (lock.current) return;
      lock.current = true;
      try {
        const session = buildSession(run, index);
        if (!session) {
          await clearRun(scope, run.mode);
          navigate(run.mode === 'exam' ? '/exam' : '/practice', { replace: true });
          return;
        }
        const isNew = await saveSession(session);
        if (isNew && run.mode === 'exam') {
          for (const a of session.answers) {
            if (!a.isCorrect) {
              const q = index.byId.get(a.questionId);
              if (q) await recordWrong(q, a.selectedIndex);
            }
          }
        }
        await clearRun(scope, run.mode);
        navigate(`/result/${session.id}`, { replace: true });
      } finally {
        lock.current = false;
      }
    },
    [index, saveSession, recordWrong, scope, navigate],
  );
}
