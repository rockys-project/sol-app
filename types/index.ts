export type TaskCategory = 'Pleasant' | 'Mastery' | 'Meaningful';

export type TaskOutcome = 'completed' | 'skipped';

export type Phase = 1 | 2 | 3;

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any';

export type RecoveryDomain =
  | 'light_environment'
  | 'body_movement'
  | 'food_water'
  | 'hygiene_appearance'
  | 'space_order'
  | 'social_connection'
  | 'work_responsibility'
  | 'future_identity';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  difficulty: number;
  phase: Phase;
  time_of_day: TimeOfDay;
  neuroscience: string;
  domain: RecoveryDomain;
  family_id: string;
  family_level: number;
}

export interface TaskLog {
  id: string;
  user_id: string;
  task_id: string;
  task_title: string;
  task_difficulty: number;
  task_category: TaskCategory;
  task_domain: RecoveryDomain;
  outcome: TaskOutcome;
  logged_at: string;
  time_of_day: TimeOfDay;
  card_position: number;
}

export interface User {
  id: string;
  intake_summary: string;
  current_phase: Phase;
  preferred_hour: number;
  created_at: string;
  last_active: string;
  active_arc_id: string | null;
  arc_position: number;
}

export interface RecoveryArc {
  id: string;
  name: string;
  domain: RecoveryDomain;
  task_sequence: string[];
}

export type RootStackParamList = {
  Onboarding: undefined;
  Today: undefined;
  GoodNight: { outcome: TaskOutcome; task?: Task; phase?: Phase };
};
