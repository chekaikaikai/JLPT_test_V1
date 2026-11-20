import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBank } from '../../contexts/BankContext';
import { useUserData } from '../../contexts/UserDataContext';
import { putRun } from '../../services/repository';
import { createPracticeRun } from '../../services/runs';
import { buildPractice } from '../../services/selection';
import type { PracticeConfig } from '../../types';

export function usePracticeStart() {
  const { index } = useBank();
  const { scope, wrongIds, bookmarkIds } = useUserData();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (config: PracticeConfig) => {
      const { questions } = buildPractice(index, config, wrongIds, bookmarkIds);
      if (questions.length === 0) {
        setError('符合條件的題目不足，請調整篩選條件。');
        return false;
      }
      await putRun(scope, createPracticeRun(config, questions));
      navigate('/practice/run');
      return true;
    },
    [index, scope, wrongIds, bookmarkIds, navigate],
  );
  return { start, error, setError };
}
