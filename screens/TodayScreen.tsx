import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { StackScreenProps } from '@react-navigation/stack';
import DevPanel from '../components/DevPanel';
import SolHeader from '../components/SolHeader';
import HoldGesture from '../components/HoldGesture';
import VoiceEditModal from '../components/VoiceEditModal';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { spacing } from '../constants/spacing';
import {
  getOrCreateUser, getTodayDate, setTodayDate,
  getCardId, setCardId, clearCardId,
  isCardCompleted, getTodayCompletedPositions,
  getRecentHistory, updateUserPhase, updateLastActive,
  getDaysSinceLastActive, logTaskOutcome,
} from '../store/database';
import { shouldProgressToPhase2, shouldProgressToPhase3, shouldRegress } from '../store/phaseLogic';
import { getCardTaskId } from '../store/cardLogic';
import { getReturnTask } from '../store/recoveryArc';
import { speakTask, stopSpeaking } from '../store/ai';
import type { RootStackParamList, Task, User, Phase, TimeOfDay, RecoveryArc } from '../types';
import tasksData from '../data/tasks.json';
import arcsData from '../data/arcs.json';

type Props = StackScreenProps<RootStackParamList, 'Today'>;

const ALL_TASKS = tasksData as Task[];
const ALL_ARCS  = arcsData  as RecoveryArc[];

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'any';
}

function greeting(t: TimeOfDay): string {
  if (t === 'morning')   return 'Good morning.';
  if (t === 'afternoon') return 'Good afternoon.';
  return 'Good evening.';
}

export default function TodayScreen({ navigation }: Props) {
  const [activeCards,   setActiveCards]   = useState<{ task: Task; slot: 1 | 2 | 3 }[]>([]);
  const [user,          setUser]          = useState<User | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [showPanel,     setShowPanel]     = useState(false);
  const [showVoiceEdit, setShowVoiceEdit] = useState(false);
  const timeOfDay = getTimeOfDay();

  const activeCardsRef = useRef(activeCards);
  activeCardsRef.current = activeCards;

  useEffect(() => {
    load();
    return () => stopSpeaking();
  }, []);

  async function load() {
    try {
      const u    = await getOrCreateUser();
      const days = await getDaysSinceLastActive(u.id);
      await updateLastActive(u.id);

      const history14 = await getRecentHistory(u.id, 14);
      let phase = u.current_phase as Phase;

      if (phase === 1 && shouldProgressToPhase2(history14)) {
        phase = 2; await updateUserPhase(u.id, 2);
      } else if (phase === 2 && shouldProgressToPhase3(history14)) {
        phase = 3; await updateUserPhase(u.id, 3);
      } else if (phase > 1 && shouldRegress(history14)) {
        phase = (phase - 1) as Phase; await updateUserPhase(u.id, phase);
      }

      const updated = { ...u, current_phase: phase };
      setUser(updated);

      const history7 = await getRecentHistory(u.id, 7);
      const todayStr = new Date().toISOString().split('T')[0];
      const storedDate = await getTodayDate();

      // ── Card 1 (refreshes daily) ──────────────────────────────────────────
      let card1Id: string;
      if (days >= 3) {
        const returnTask = getReturnTask(days, ALL_TASKS);
        card1Id = returnTask.id;
        await setCardId(1, card1Id);
        await setTodayDate(todayStr);
      } else if (storedDate !== todayStr) {
        card1Id = getCardTaskId(
          1, history7, ALL_TASKS, timeOfDay,
          updated.active_arc_id, updated.arc_position, ALL_ARCS,
        );
        await setCardId(1, card1Id);
        await setTodayDate(todayStr);
      } else {
        card1Id = (await getCardId(1)) ?? getCardTaskId(
          1, history7, ALL_TASKS, timeOfDay,
          updated.active_arc_id, updated.arc_position, ALL_ARCS,
        );
      }

      // ── Cards 2 and 3 (persistent until completed) ────────────────────────
      async function resolveCard(slot: 2 | 3): Promise<string | null> {
        if (phase < slot) return null;
        const existing = await getCardId(slot);
        if (existing) {
          if (await isCardCompleted(existing, slot)) {
            await clearCardId(slot);
            const newId = getCardTaskId(
              slot as 1 | 2 | 3, history7, ALL_TASKS, timeOfDay,
              updated.active_arc_id, updated.arc_position, ALL_ARCS,
            );
            await setCardId(slot, newId);
            return newId;
          }
          return existing;
        }
        const newId = getCardTaskId(
          slot as 1 | 2 | 3, history7, ALL_TASKS, timeOfDay,
          updated.active_arc_id, updated.arc_position, ALL_ARCS,
        );
        await setCardId(slot, newId);
        return newId;
      }

      const card2Id = await resolveCard(2);
      const card3Id = await resolveCard(3);

      const completedSlots = await getTodayCompletedPositions(u.id);
      const cards: { task: Task; slot: 1 | 2 | 3 }[] = [];
      const slots: [string | null, 1 | 2 | 3][] = [
        [card1Id, 1], [card2Id, 2], [card3Id, 3],
      ];
      for (const [id, slot] of slots) {
        if (!id || completedSlots.has(slot)) continue;
        const task = ALL_TASKS.find(t => t.id === id) ?? ALL_TASKS[0];
        cards.push({ task, slot });
      }

      if (cards.length === 0) {
        navigation.replace('GoodNight', { outcome: 'completed' });
        return;
      }

      setActiveCards(cards);
    } catch {
      const fallback = ALL_TASKS.find(t => t.id === 'T02') ?? ALL_TASKS[0];
      setActiveCards([{ task: fallback, slot: 1 }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    const current = activeCardsRef.current;
    if (!current.length || !user) return;
    stopSpeaking();

    const { task, slot } = current[0];
    try { await logTaskOutcome(user.id, task.id, task, 'completed', timeOfDay, slot); } catch {}

    const remaining = current.slice(1);
    if (remaining.length === 0) {
      navigation.replace('GoodNight', {
        outcome: 'completed',
        task,
        phase: user.current_phase,
      });
    } else {
      setActiveCards(remaining);
    }
  }

  // Mic tap → open voice edit modal
  function handleMicTap() {
    setShowVoiceEdit(true);
  }

  // Mic long-press → read task aloud
  function handleMicLongPress() {
    const current = activeCardsRef.current[0];
    if (current) speakTask(current.task);
  }

  // Voice edit accepted — swap the active card's task
  async function handleTaskSwap(newTask: Task) {
    const current = activeCardsRef.current;
    if (!current.length) return;
    const { slot } = current[0];
    try { await setCardId(slot, newTask.id); } catch {}
    setActiveCards([{ task: newTask, slot }, ...current.slice(1)]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <SolHeader />
        <View style={styles.centre}>
          <ActivityIndicator color={colors.amber} />
        </View>
      </SafeAreaView>
    );
  }

  const currentTask = activeCards[0]?.task ?? null;
  const nextTask    = activeCards[1]?.task ?? null;
  const phase       = user?.current_phase ?? 1;

  if (!currentTask) return null;

  return (
    <SafeAreaView style={styles.container}>
      <SolHeader onSecretTap={__DEV__ ? () => setShowPanel(true) : undefined} />

      {__DEV__ && (
        <DevPanel
          visible={showPanel}
          onClose={() => setShowPanel(false)}
          onRefresh={load}
          navigation={navigation}
        />
      )}

      <VoiceEditModal
        visible={showVoiceEdit}
        currentTask={currentTask}
        phase={phase}
        onAccept={handleTaskSwap}
        onClose={() => setShowVoiceEdit(false)}
      />

      <View style={styles.body}>
        <Text style={styles.greeting}>{greeting(timeOfDay)}</Text>
        <HoldGesture
          task={currentTask}
          onComplete={handleComplete}
          nextTask={nextTask}
        />
      </View>

      {/* Mic row — tap to edit via AI, long-press to hear task aloud */}
      <Pressable
        style={styles.micRow}
        onPress={handleMicTap}
        onLongPress={handleMicLongPress}
        delayLongPress={500}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z"
            fill="none" stroke={colors.textTertiary} strokeWidth={1.5}
          />
          <Path
            d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
            fill="none" stroke={colors.textTertiary} strokeWidth={1.5} strokeLinecap="round"
          />
        </Svg>
        <Text style={styles.micLabel}>edit via voice</Text>
      </Pressable>
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
    paddingTop: spacing.gap,
    gap: spacing.gap,
  },
  greeting: {
    ...fonts.heading,
    color: colors.textPrimary,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.gap,
  },
  micLabel: {
    ...fonts.tiny,
    color: colors.textTertiary,
  },
});
