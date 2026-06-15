import { Task } from '../types';

export function getReturnTask(daysSinceLastActive: number, tasks: Task[]): Task {
  if (daysSinceLastActive >= 14) {
    const t02 = tasks.find(t => t.id === 'T02');
    if (t02) return t02;
  }

  if (daysSinceLastActive >= 7) {
    const candidates = tasks.filter(t => t.phase === 1 && t.difficulty === 1);
    if (candidates.length > 0) return candidates[0];
  }

  if (daysSinceLastActive >= 3) {
    const candidates = tasks.filter(t => t.phase === 1 && t.difficulty <= 2);
    if (candidates.length > 0) return candidates[0];
  }

  return tasks.filter(t => t.phase === 1).sort((a, b) => a.difficulty - b.difficulty)[0];
}

export function getReturnMessage(daysSinceLastActive: number): string {
  if (daysSinceLastActive >= 30) return 'Take one deeper breath.';
  if (daysSinceLastActive >= 14) return 'Let us start gently.';
  if (daysSinceLastActive >= 7) return 'Good to start again.';
  return 'Something small is ready.';
}
