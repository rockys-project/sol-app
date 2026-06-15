import type { Task, TaskLog, TimeOfDay, RecoveryArc, RecoveryDomain, TaskCategory } from '../types';

const ALL_DOMAINS: RecoveryDomain[] = [
  'light_environment', 'body_movement', 'food_water', 'hygiene_appearance',
  'space_order', 'social_connection', 'work_responsibility', 'future_identity',
];
const ALL_CATEGORIES: TaskCategory[] = ['Pleasant', 'Mastery', 'Meaningful'];

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function groupByDate(history: TaskLog[]): Map<string, TaskLog[]> {
  const map = new Map<string, TaskLog[]>();
  for (const e of history) {
    const date = e.logged_at.split('T')[0];
    const arr = map.get(date);
    if (arr) arr.push(e);
    else map.set(date, [e]);
  }
  return map;
}

/**
 * Selects the best task for a given card slot (1, 2, or 3).
 * Card slot N corresponds to phase N tasks exclusively.
 * Arc tasks only apply to slot 1.
 */
export function getCardTaskId(
  cardSlot: 1 | 2 | 3,
  history: TaskLog[],
  tasks: Task[],
  timeOfDay: TimeOfDay,
  arcId: string | null,
  arcPosition: number,
  arcs: RecoveryArc[],
): string {
  // Each slot draws only from its matching phase
  const pool = tasks.filter(t => t.phase === cardSlot);

  // Arc applies to card 1 only
  if (cardSlot === 1 && arcId) {
    const arc = arcs.find(a => a.id === arcId);
    if (arc && arcPosition < arc.task_sequence.length) {
      const arcTask = pool.find(t => t.id === arc.task_sequence[arcPosition]);
      if (arcTask) return arcTask.id;
    }
  }

  const recentIds = new Set(
    history.filter(e => e.logged_at >= daysAgo(7)).map(e => e.task_id),
  );

  const byDate = groupByDate(history);
  const last3Dates = Array.from(byDate.keys()).sort().reverse().slice(0, 3);

  const blockedDomains = new Set<RecoveryDomain>();
  const blockedCategories = new Set<TaskCategory>();
  if (last3Dates.length === 3) {
    for (const d of ALL_DOMAINS) {
      if (last3Dates.every(date => byDate.get(date)!.some(e => e.task_domain === d)))
        blockedDomains.add(d);
    }
    for (const c of ALL_CATEGORIES) {
      if (last3Dates.every(date => byDate.get(date)!.some(e => e.task_category === c)))
        blockedCategories.add(c);
    }
  }

  let candidates = pool;
  const notRecent = candidates.filter(t => !recentIds.has(t.id));
  if (notRecent.length > 0) candidates = notRecent;

  const diffDomain = candidates.filter(t => !blockedDomains.has(t.domain));
  if (diffDomain.length > 0) candidates = diffDomain;

  const diffCat = candidates.filter(t => !blockedCategories.has(t.category));
  if (diffCat.length > 0) candidates = diffCat;

  const matchTime = candidates.filter(t => t.time_of_day === timeOfDay || t.time_of_day === 'any');
  if (matchTime.length > 0) candidates = matchTime;

  if (candidates.length > 0) return candidates[0].id;
  return pool.sort((a, b) => a.difficulty - b.difficulty)[0].id;
}
