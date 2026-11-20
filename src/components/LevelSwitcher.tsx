import { LEVELS, UPCOMING_LEVELS } from '../types';
import { usePrefs } from '../contexts/PrefsContext';
import clsx from 'clsx';

export function LevelSwitcher({ showUpcoming = false }: { showUpcoming?: boolean }) {
  const { level, setLevel } = usePrefs();
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="JLPT 等級">
      {LEVELS.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={level === l}
          onClick={() => setLevel(l)}
          className={clsx('rounded-full border px-5 py-1.5 font-serif text-base transition', level === l ? 'border-shu bg-shu text-white' : 'border-line bg-card text-ink-soft hover:border-shu/50')}
        >
          {l}
        </button>
      ))}
      {showUpcoming &&
        UPCOMING_LEVELS.map((l) => (
          <span key={l} className="rounded-full border border-dashed border-line px-4 py-1.5 font-serif text-base text-ink-faint" title="即將推出">
            {l}
          </span>
        ))}
    </div>
  );
}
