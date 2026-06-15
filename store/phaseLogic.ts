import { Task, TaskLog, TaskOutcome, Phase, TimeOfDay, RecoveryArc, RecoveryDomain, TaskCategory } from '../types';

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
  for (const entry of history) {
    const date = entry.logged_at.split('T')[0];
    const existing = map.get(date);
    if (existing) existing.push(entry);
    else map.set(date, [entry]);
  }
  return map;
}

export function shouldProgressToPhase2(history: TaskLog[]): boolean {
  const cutoff = daysAgo(7);
  const eligible = history.filter(e => e.task_difficulty <= 3 && e.logged_at >= cutoff);
  if (eligible.length < 7) return false;
  const completed = eligible.filter(e => e.outcome === 'completed').length;
  return completed / eligible.length >= 0.8;
}

export function shouldProgressToPhase3(history: TaskLog[]): boolean {
  const cutoff = daysAgo(14);
  const recent = history.filter(e => e.logged_at >= cutoff);
  if (recent.length < 14) return false;
  const completed = recent.filter(e => e.outcome === 'completed').length;
  if (completed / recent.length < 0.75) return false;
  const meaningfulCompleted = recent.filter(
    e => e.outcome === 'completed' && e.task_category === 'Meaningful'
  ).length;
  return meaningfulCompleted >= 2;
}

export function shouldRegress(history: TaskLog[]): boolean {
  if (history.length < 3) return false;
  const byDate = groupByDate(history);
  const last3Dates = Array.from(byDate.keys()).sort().reverse().slice(0, 3);
  if (last3Dates.length < 3) return false;
  return last3Dates.every(date => {
    const entries = byDate.get(date)!;
    const completed = entries.filter(e => e.outcome === 'completed').length;
    return completed / entries.length < 0.4;
  });
}

export function getFallbackTask(currentTask: Task, allTasks: Task[], currentPhase: Phase): Task {
  const familyFallbacks = allTasks.filter(
    t =>
      t.family_id === currentTask.family_id &&
      t.family_level < currentTask.family_level &&
      t.phase <= currentPhase
  );

  if (familyFallbacks.length > 0) {
    return familyFallbacks.sort((a, b) => b.family_level - a.family_level)[0];
  }

  const secondary = allTasks
    .filter(t => t.phase <= currentPhase && t.id !== currentTask.id)
    .sort((a, b) => a.difficulty - b.difficulty);

  return secondary[0];
}

export function getNextTaskId(
  history: TaskLog[],
  phase: Phase,
  tasks: Task[],
  timeOfDay: TimeOfDay,
  arcId: string | null,
  arcPosition: number,
  arcs: RecoveryArc[]
): string {
  // 1. Active arc task
  if (arcId) {
    const arc = arcs.find(a => a.id === arcId);
    if (arc && arcPosition < arc.task_sequence.length) {
      const arcTask = tasks.find(t => t.id === arc.task_sequence[arcPosition]);
      if (arcTask && arcTask.phase <= phase) return arcTask.id;
    }
  }

  // 2. Phase-appropriate pool
  const eligible = tasks.filter(t => t.phase <= phase);

  // Recent history data
  const recentIds = new Set(
    history.filter(e => e.logged_at >= daysAgo(7)).map(e => e.task_id)
  );

  const byDate = groupByDate(history);
  const last3Dates = Array.from(byDate.keys()).sort().reverse().slice(0, 3);

  // Domains/categories that appeared in all of the last 3 days — avoid these
  const blockedDomains = new Set<RecoveryDomain>();
  const blockedCategories = new Set<TaskCategory>();

  if (last3Dates.length === 3) {
    for (const domain of ALL_DOMAINS) {
      if (last3Dates.every(d => byDate.get(d)!.some(e => e.task_domain === domain))) {
        blockedDomains.add(domain);
      }
    }
    for (const cat of ALL_CATEGORIES) {
      if (last3Dates.every(d => byDate.get(d)!.some(e => e.task_category === cat))) {
        blockedCategories.add(cat);
      }
    }
  }

  // Progressive filtering — each step only applies if it leaves candidates
  let candidates = eligible;

  const notRecent = candidates.filter(t => !recentIds.has(t.id));
  if (notRecent.length > 0) candidates = notRecent;

  const diffDomain = candidates.filter(t => !blockedDomains.has(t.domain));
  if (diffDomain.length > 0) candidates = diffDomain;

  const diffCat = candidates.filter(t => !blockedCategories.has(t.category));
  if (diffCat.length > 0) candidates = diffCat;

  const matchTime = candidates.filter(t => t.time_of_day === timeOfDay || t.time_of_day === 'any');
  if (matchTime.length > 0) candidates = matchTime;

  if (candidates.length > 0) return candidates[0].id;

  // 7. Hard fallback — lowest difficulty task in phase, always returns
  return eligible.sort((a, b) => a.difficulty - b.difficulty)[0].id;
}
