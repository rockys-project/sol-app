/**
 * Sol — AI integration layer
 * All Claude API calls live here. Every function degrades gracefully —
 * if the API is unavailable, the app continues with rule-based fallbacks.
 */
import * as Speech from 'expo-speech';
import type { Task, TaskOutcome, Phase, TimeOfDay } from '../types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-3-5-haiku-20241022';

function apiKey(): string {
  return (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim();
}

// ── Core request helper ───────────────────────────────────────────────────────

async function claude(
  system: string,
  userMessage: string,
  maxTokens = 200,
): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is not set');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: maxTokens,
      system,
      messages:   [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.content?.[0]?.text ?? '') as string;
}

// Strips markdown code fences and extracts the first JSON object
function parseJSON<T>(raw: string, fallback: T): T {
  try {
    const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
    const match    = stripped.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ── 1. AI Onboarding intake ───────────────────────────────────────────────────
// Called after the user answers the two pill questions.
// Returns the most appropriate starting task and a warm intake summary.

export async function getIntakeRecommendation(
  feeling: string,
  hardest: string,
  tasks: Task[],
): Promise<{ taskId: string; intakeSummary: string } | null> {
  try {
    const taskList = tasks
      .filter(t => t.phase === 1)
      .map(t => `${t.id}: "${t.title}" (difficulty ${t.difficulty}/10, domain: ${t.domain})`)
      .join('\n');

    const raw = await claude(
      `You are the intake system for Sol, a gentle daily recovery app for people rebuilding their lives after depression, burnout, grief, or feeling completely stuck. You pick the right first task and write a brief, honest intake note.`,
      `A new user answered two questions:
• How things feel right now: "${feeling}"
• What feels most impossible: "${hardest}"

Phase 1 tasks available:
${taskList}

Rules:
- If they said "Really hard" → prefer difficulty 1–2
- If they said "Okay-ish" → difficulty 3–5 is fine
- Match the domain to what they said is hardest (house = light_environment or body_movement, people = social_connection, eating/sleeping = food_water)
- Write the intake summary in second person, one sentence, under 15 words
- Acknowledge their difficulty honestly — no toxic positivity, no exclamation marks

Respond with JSON only:
{ "taskId": "T02", "intakeSummary": "Things feel very heavy right now, and that makes complete sense." }`,
      150,
    );

    const result = parseJSON<{ taskId: string; intakeSummary: string }>(raw, {
      taskId: '', intakeSummary: '',
    });

    if (!tasks.find(t => t.id === result.taskId) || !result.intakeSummary) return null;
    return result;
  } catch {
    return null;
  }
}

// ── 2. Voice / text task edit ─────────────────────────────────────────────────
// The user taps the mic and says (or types) what they want.
// Claude finds the best matching task from the library.

export async function getVoiceTaskEdit(
  currentTask: Task,
  request: string,
  allTasks: Task[],
  phase: Phase,
): Promise<{ taskId: string; reason: string } | null> {
  try {
    const eligible = allTasks
      .filter(t => t.phase <= phase && t.id !== currentTask.id)
      .map(
        t =>
          `${t.id}: "${t.title}" — ${t.description.slice(0, 70)} ` +
          `(phase ${t.phase}, difficulty ${t.difficulty}/10, domain: ${t.domain})`,
      )
      .join('\n');

    const raw = await claude(
      `You are the task selector for Sol, a recovery app. You match user requests to the best available task. Be empathetic — the user may be struggling to explain what they need.`,
      `Current task: "${currentTask.title}" (domain: ${currentTask.domain}, difficulty: ${currentTask.difficulty}/10)
User request: "${request}"

Available tasks (phase ≤ ${phase}):
${eligible}

Matching rules:
- "easier", "too hard", "can't do this" → lower difficulty than current (${currentTask.difficulty})
- "outside", "air", "walk" → light_environment or body_movement domain
- "eat", "food", "drink" → food_water domain
- "tidy", "clean", "room" → space_order or hygiene_appearance domain
- "text", "message", "people" → social_connection domain
- "different", "something else" → different domain to current
- Otherwise match the closest semantic meaning in the title/description

Write the reason in second person, one sentence, warm and practical.

Respond with JSON only:
{ "taskId": "T07", "reason": "This gets you outside with almost no effort." }`,
      120,
    );

    const result = parseJSON<{ taskId: string; reason: string }>(raw, {
      taskId: '', reason: '',
    });

    if (!allTasks.find(t => t.id === result.taskId) || !result.reason) return null;
    return result;
  } catch {
    return null;
  }
}

// ── 3. Personalised completion message ───────────────────────────────────────
// Replaces the static message pool on GoodNightScreen.
// Returns null if the API is unavailable (caller uses static pool instead).

export async function getAICompletionMessage(
  task: Task,
  outcome: TaskOutcome,
  phase: Phase,
  timeOfDay: TimeOfDay,
): Promise<string | null> {
  try {
    const raw = await claude(
      `You write the closing message for Sol, a daily recovery app. One sentence. Warm. Understated. Never cheerful or congratulatory. Never uses the word "proud". Just true and human — like something a quiet friend would say.`,
      `The user just ${outcome === 'completed' ? 'completed' : 'did not complete'} their task.

Task: "${task.title}"
Category: ${task.category}
Domain: ${task.domain.replace(/_/g, ' ')}
User phase: ${phase} (1 = just starting, 2 = building rhythm, 3 = sustained recovery)
Time of day: ${timeOfDay}
Outcome: ${outcome}

Write ONE closing sentence.
${
  outcome === 'completed'
    ? 'Make them feel seen, not praised. Acknowledge what the task probably took.'
    : 'Today was hard. Do not shame. Acknowledge it is okay to not finish — they showed up anyway.'
}
Under 18 words. End with a full stop. Return the sentence only — no quotes, no labels.`,
      80,
    );

    const clean = raw.trim().replace(/^["']|["']$/g, '');
    return clean.length > 8 ? clean : null;
  } catch {
    return null;
  }
}

// ── 4. AI crisis detection ────────────────────────────────────────────────────
// More nuanced than keyword matching — understands context and indirect distress signals.
// Falls back to false on error (caller has keyword fallback).

export async function detectCrisisAI(text: string): Promise<boolean> {
  try {
    if (!apiKey()) return false; // skip if no key — keyword detection handles it
    const raw = await claude(
      `You are a safety classifier for Sol, a recovery app used by people in emotional difficulty. Detect if text indicates acute distress, crisis, or thoughts of self-harm or suicide. Be sensitive — a false negative is worse than a false positive. Consider indirect signals: hopelessness, finality, saying goodbye, being a burden.`,
      `Classify this text: "${text}"

Respond with JSON only — no explanation:
{ "crisis": true }   or   { "crisis": false }`,
      20,
    );
    const result = parseJSON<{ crisis: boolean }>(raw, { crisis: false });
    return result.crisis;
  } catch {
    return false;
  }
}

// ── 5. Text-to-speech ─────────────────────────────────────────────────────────
// Reads the current task aloud using the device's speech engine.

export function speakTask(task: Task): void {
  Speech.stop();
  Speech.speak(`${task.title}. ${task.description}`, {
    language: 'en-GB',
    pitch: 1.0,
    rate: 0.82,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
