import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StackScreenProps } from '@react-navigation/stack';
import SolHeader from '../components/SolHeader';
import CrisisModal from '../components/CrisisModal';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { radius, spacing } from '../constants/spacing';
import { initDatabase, getOrCreateUser, setTodayTask, updateUserIntakeSummary } from '../store/database';
import { getIntakeRecommendation, detectCrisisAI } from '../store/ai';
import type { RootStackParamList } from '../types';
import type { Task } from '../types';
import tasksData from '../data/tasks.json';

const ALL_TASKS = tasksData as Task[];

type Props = StackScreenProps<RootStackParamList, 'Onboarding'>;

type Q1Answer = 'Heavy' | 'Okay-ish' | 'Really hard';
type Q2Answer = 'Leaving the house' | 'Being around people' | 'Basic things like eating and sleeping';

const Q1_OPTIONS: Q1Answer[] = ['Heavy', 'Okay-ish', 'Really hard'];
const Q2_OPTIONS: Q2Answer[] = [
  'Leaving the house',
  'Being around people',
  'Basic things like eating and sleeping',
];

// Keyword fallback — used if AI is unavailable
const CRISIS_KEYWORDS = [
  'harm', 'hurt myself', 'end it', 'ending it', 'not want to be here',
  'no point', 'hopeless', "can't go on", 'want to die', 'suicidal',
  'kill myself', 'disappear forever', 'nobody would care', 'no reason to live',
  'better off without me',
];

export function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

// Enhanced async version — uses Claude with keyword fallback
export async function detectCrisisAsync(text: string): Promise<boolean> {
  const keywordHit = detectCrisis(text);
  if (keywordHit) return true;            // keywords are instant; don't wait for AI
  try {
    return await detectCrisisAI(text);
  } catch {
    return false;
  }
}

// Rule-based fallback when AI is unavailable
function getRuleBasedTaskId(q1: Q1Answer, q2: Q2Answer): string {
  if (q1 === 'Really hard') return 'T02';
  if (q1 === 'Okay-ish')    return 'T08';
  if (q2 === 'Leaving the house')   return 'T07';
  if (q2 === 'Being around people') return 'T05';
  return 'T06';
}

export default function OnboardingScreen({ navigation }: Props) {
  const [q1,          setQ1]          = useState<Q1Answer | null>(null);
  const [q2,          setQ2]          = useState<Q2Answer | null>(null);
  const [starting,    setStarting]    = useState(false);
  const [aiStatus,    setAiStatus]    = useState('');
  const [showCrisis,  setShowCrisis]  = useState(false);

  const bothAnswered = q1 !== null && q2 !== null;

  async function handleStart() {
    if (!q1 || !q2 || starting) return;
    setStarting(true);

    try {
      await initDatabase();
      const user = await getOrCreateUser();

      // ── AI intake ────────────────────────────────────────────────────────
      setAiStatus('Finding your first task…');
      let taskId    = getRuleBasedTaskId(q1, q2);  // start with rule-based fallback
      let intakeSummary = '';

      try {
        const aiResult = await getIntakeRecommendation(q1, q2, ALL_TASKS);
        if (aiResult) {
          taskId        = aiResult.taskId;
          intakeSummary = aiResult.intakeSummary;
        }
      } catch {
        // AI unavailable — rule-based taskId already set
      }

      // Save intake summary if AI produced one
      if (intakeSummary) {
        try { await updateUserIntakeSummary(user.id, intakeSummary); } catch {}
      }

      await setTodayTask(taskId);
      await AsyncStorage.multiSet([
        ['first_task_id',       taskId],
        ['user_id',             user.id],
        ['onboarding_complete', 'true'],
      ]);

      navigation.replace('Today');
    } catch {
      setStarting(false);
      setAiStatus('');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <CrisisModal visible={showCrisis} />
      <SolHeader />

      <View style={styles.body}>
        <View style={styles.block}>
          <Text style={styles.question}>How are things feeling right now?</Text>
          <View style={styles.pillRow}>
            {Q1_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.pill, q1 === opt && styles.pillActive]}
                onPress={() => setQ1(opt)}
                activeOpacity={0.7}
                disabled={starting}
              >
                <Text style={[styles.pillText, q1 === opt && styles.pillTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.question}>What feels most impossible right now?</Text>
          <View style={styles.pillRow}>
            {Q2_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.pill, q2 === opt && styles.pillActive]}
                onPress={() => setQ2(opt)}
                activeOpacity={0.7}
                disabled={starting}
              >
                <Text style={[styles.pillText, q2 === opt && styles.pillTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {bothAnswered && !starting && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startText}>Start</Text>
        </TouchableOpacity>
      )}

      {starting && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.amber} />
          <Text style={styles.loadingText}>{aiStatus}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.gapLarge,
    gap: spacing.gapLarge * 2,
    justifyContent: 'center',
  },
  block: {
    gap: spacing.gap,
  },
  question: {
    ...fonts.heading,
    color: colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.gap,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  pillActive: {
    backgroundColor: colors.amberDark,
    borderColor: colors.amberDark,
  },
  pillText: {
    ...fonts.body,
    color: colors.amberDark,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  startButton: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.gapLarge,
    backgroundColor: colors.amberDark,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startText: {
    ...fonts.taskTitle,
    color: '#FFFFFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.gap,
    paddingBottom: spacing.gapLarge * 2,
  },
  loadingText: {
    ...fonts.small,
    color: colors.textSecondary,
  },
});
