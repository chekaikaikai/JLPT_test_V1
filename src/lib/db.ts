import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ActiveRun, BookmarkRecord, Passage, Question, QuizSession, WrongRecord } from '../types';

export type OutboxKind = 'session' | 'bookmark_put' | 'bookmark_del' | 'wrong_put' | 'wrong_del';
export interface OutboxItem {
  seq?: number;
  scope: string;
  kind: OutboxKind;
  payload: unknown;
  createdAt: number;
}

interface Schema extends DBSchema {
  questions: { key: string; value: Question };
  passages: { key: string; value: Passage };
  sessions: { key: [string, string]; value: QuizSession & { scope: string }; indexes: { scope: string } };
  bookmarks: { key: [string, string]; value: BookmarkRecord & { scope: string }; indexes: { scope: string } };
  wrongs: { key: [string, string]; value: WrongRecord & { scope: string }; indexes: { scope: string } };
  outbox: { key: number; value: OutboxItem; indexes: { scope: string } };
  active: { key: string; value: { key: string; run: ActiveRun } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<Schema>('jlpt-study', 1, {
      upgrade(db) {
        db.createObjectStore('questions', { keyPath: 'id' });
        db.createObjectStore('passages', { keyPath: 'id' });
        db.createObjectStore('sessions', { keyPath: ['scope', 'id'] }).createIndex('scope', 'scope');
        db.createObjectStore('bookmarks', { keyPath: ['scope', 'questionId'] }).createIndex('scope', 'scope');
        db.createObjectStore('wrongs', { keyPath: ['scope', 'questionId'] }).createIndex('scope', 'scope');
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true }).createIndex('scope', 'scope');
        db.createObjectStore('active', { keyPath: 'key' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}
