import type { QuestionBank } from '../../types';
import { N4_BANK } from './n4';
import { N5_BANK } from './n5';

/** 內建題庫（隨 App 一起打包，離線可用）。 */
export const BUILTIN_BANK: QuestionBank = {
  questions: [...N5_BANK.questions, ...N4_BANK.questions],
  passages: [...N5_BANK.passages, ...N4_BANK.passages],
};
