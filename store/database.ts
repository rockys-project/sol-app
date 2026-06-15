import * as SQLite from 'expo-sqlite';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { User, Task, TaskLog, TaskOutcome, Phase, TaskCategory, RecoveryDomain, TimeOfDay } from '../types';

const db = SQLite.openDatabaseSync('sol.db');

export async function initDatabase(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      intake_summary TEXT DEFAULT '',
      current_phase INTEGER DEFAULT 1,
      preferred_hour INTEGER DEFAULT 9,
      created_at TEXT NOT NULL,
      last_active TEXT NOT NULL,
      active_arc_id TEXT,
      arc_position INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS task_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      task_title TEXT NOT NULL,
      task_difficulty INTEGER NOT NULL,
      task_category TEXT NOT NULL,
      task_domain TEXT NOT NULL,
      outcome TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      time_of_day TEXT NOT NULL,
      card_position INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Migration for existing installs that lack card_position
  try {
    await db.execAsync('ALTER TABLE task_log ADD COLUMN card_position INTEGER DEFAULT 1;');
  } catch {}
}

export async function getOrCreateUser(): Promise<User> {
  type UserRow = {
    id: string; intake_summary: string; current_phase: number;
    preferred_hour: number; created_at: string; last_active: string;
    active_arc_id: string | null; arc_position: number;
  };
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users LIMIT 1');
  if (row) return { ...row, current_phase: row.current_phase as Phase };

  const now = new Date().toISOString();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO users (id, intake_summary, current_phase, preferred_hour, created_at, last_active, active_arc_id, arc_position)
     VALUES (?, '', 1, 9, ?, ?, NULL, 0)`,
    id, now, now,
  );
  return { id, intake_summary: '', current_phase: 1, preferred_hour: 9, created_at: now, last_active: now, active_arc_id: null, arc_position: 0 };
}

// ── Card slot storage ─────────────────────────────────────────────────────────
// Card 1 is reset each new day. Cards 2 and 3 persist until completed.

export async function getTodayDate(): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?', 'today_date',
  );
  return row?.value ?? null;
}

export async function setTodayDate(date: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', 'today_date', date);
}

export async function getCardId(slot: 1 | 2 | 3): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?', `card_${slot}_task_id`,
  );
  return row?.value ?? null;
}

export async function setCardId(slot: 1 | 2 | 3, taskId: string): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
    `card_${slot}_task_id`, taskId,
  );
}

export async function clearCardId(slot: 2 | 3): Promise<void> {
  await db.runAsync('DELETE FROM app_state WHERE key = ?', `card_${slot}_task_id`);
}

/** Returns true if this task+position combo has ever been completed. */
export async function isCardCompleted(taskId: string, cardPosition: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM task_log WHERE task_id = ? AND card_position = ? AND outcome = ? LIMIT 1',
    taskId, cardPosition, 'completed',
  );
  return !!row;
}

/** Returns set of card_positions completed today. */
export async function getTodayCompletedPositions(userId: string): Promise<Set<number>> {
  const today = new Date().toISOString().split('T')[0];
  type Row = { card_position: number };
  const rows = await db.getAllAsync<Row>(
    `SELECT card_position FROM task_log
     WHERE user_id = ? AND logged_at >= ? AND outcome = 'completed'`,
    userId, today,
  );
  return new Set(rows.map(r => r.card_position));
}

// ── Legacy helpers kept for DevPanel ─────────────────────────────────────────

export async function getTodayTask(_userId: string): Promise<string | null> {
  return getCardId(1);
}

export async function setTodayTask(taskId: string): Promise<void> {
  return setCardId(1, taskId);
}

// ── Logging ───────────────────────────────────────────────────────────────────

export async function logTaskOutcome(
  userId: string,
  taskId: string,
  task: Task,
  outcome: TaskOutcome,
  timeOfDay: TimeOfDay,
  cardPosition: number = 1,
): Promise<void> {
  const now = new Date().toISOString();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO task_log (id, user_id, task_id, task_title, task_difficulty, task_category, task_domain, outcome, logged_at, time_of_day, card_position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, userId, taskId, task.title, task.difficulty, task.category, task.domain, outcome, now, timeOfDay, cardPosition,
  );
}

export async function getRecentHistory(userId: string, days: number): Promise<TaskLog[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  type LogRow = {
    id: string; user_id: string; task_id: string; task_title: string;
    task_difficulty: number; task_category: string; task_domain: string;
    outcome: string; logged_at: string; time_of_day: string; card_position: number;
  };
  const rows = await db.getAllAsync<LogRow>(
    'SELECT * FROM task_log WHERE user_id = ? AND logged_at >= ? ORDER BY logged_at DESC',
    userId, since,
  );
  return rows.map(r => ({
    ...r,
    task_category: r.task_category as TaskCategory,
    task_domain:   r.task_domain as RecoveryDomain,
    outcome:       r.outcome as TaskOutcome,
    time_of_day:   r.time_of_day as TimeOfDay,
  }));
}

export async function getUserPhase(userId: string): Promise<Phase> {
  const row = await db.getFirstAsync<{ current_phase: number }>(
    'SELECT current_phase FROM users WHERE id = ?', userId,
  );
  return (row?.current_phase ?? 1) as Phase;
}

export async function updateUserPhase(userId: string, phase: Phase): Promise<void> {
  await db.runAsync('UPDATE users SET current_phase = ? WHERE id = ?', phase, userId);
}

export async function updateUserIntakeSummary(userId: string, summary: string): Promise<void> {
  await db.runAsync('UPDATE users SET intake_summary = ? WHERE id = ?', summary, userId);
}

export async function updateUserArc(userId: string, arcId: string | null, position: number): Promise<void> {
  await db.runAsync(
    'UPDATE users SET active_arc_id = ?, arc_position = ? WHERE id = ?',
    arcId, position, userId,
  );
}

export async function updateLastActive(userId: string): Promise<void> {
  await db.runAsync('UPDATE users SET last_active = ? WHERE id = ?', new Date().toISOString(), userId);
}

export async function getDaysSinceLastActive(userId: string): Promise<number> {
  const row = await db.getFirstAsync<{ last_active: string }>(
    'SELECT last_active FROM users WHERE id = ?', userId,
  );
  if (!row) return 0;
  return Math.floor((Date.now() - new Date(row.last_active).getTime()) / 86400000);
}

export async function getLastMessageIndex(type: 'completed' | 'skipped'): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?', `last_message_index_${type}`,
  );
  return row ? parseInt(row.value, 10) : -1;
}

export async function setLastMessageIndex(type: 'completed' | 'skipped', index: number): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
    `last_message_index_${type}`, index.toString(),
  );
}

export async function clearAllData(): Promise<void> {
  await db.execAsync(`
    DELETE FROM task_log;
    DELETE FROM users;
    DELETE FROM app_state;
  `);
}

export async function devSetLastActive(userId: string, isoDate: string): Promise<void> {
  await db.runAsync('UPDATE users SET last_active = ? WHERE id = ?', isoDate, userId);
}

export async function devInsertTaskLog(
  userId: string,
  task: Task,
  outcome: TaskOutcome,
  daysBack: number,
  cardPosition: number = 1,
): Promise<void> {
  const logged_at = new Date(Date.now() - daysBack * 86400000).toISOString();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO task_log (id, user_id, task_id, task_title, task_difficulty, task_category, task_domain, outcome, logged_at, time_of_day, card_position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, userId, task.id, task.title, task.difficulty,
    task.category, task.domain, outcome, logged_at, 'any', cardPosition,
  );
}
