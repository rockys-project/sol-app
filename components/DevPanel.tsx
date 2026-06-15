import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StackNavigationProp } from '@react-navigation/stack';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { radius, spacing } from '../constants/spacing';
import {
  getOrCreateUser, getRecentHistory, updateUserPhase,
  clearAllData, devSetLastActive, devInsertTaskLog, getCardId, logTaskOutcome,
} from '../store/database';
import type { RootStackParamList, Task, TaskLog, User } from '../types';
import tasksData from '../data/tasks.json';

interface Props {
  visible:    boolean;
  onClose:    () => void;
  onRefresh:  () => void;
  navigation: StackNavigationProp<RootStackParamList, 'Today'>;
}

const ALL_TASKS = tasksData as Task[];
const T02 = ALL_TASKS.find(t => t.id === 'T02')!;
const T07 = ALL_TASKS.find(t => t.id === 'T07')!;

export default function DevPanel({ visible, onClose, onRefresh, navigation }: Props) {
  const [user,    setUser]    = useState<User | null>(null);
  const [history, setHistory] = useState<TaskLog[]>([]);
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    if (visible) loadState();
  }, [visible]);

  async function loadState() {
    try {
      const u = await getOrCreateUser();
      const h = await getRecentHistory(u.id, 7);
      setUser(u);
      setHistory(h);
    } catch {}
  }

  async function run(fn: () => Promise<void>, label: string) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(`✓ ${label}`);
      await loadState();
    } catch (e) {
      setMsg(`✗ ${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  async function setPhase(phase: 1 | 2 | 3) {
    await run(async () => {
      const u = await getOrCreateUser();
      await updateUserPhase(u.id, phase);
      onRefresh();
    }, `Phase → ${phase}`);
  }

  async function simulate7DaysCompleted() {
    await run(async () => {
      const u = await getOrCreateUser();
      for (let i = 6; i >= 0; i--) {
        await devInsertTaskLog(u.id, T02, 'completed', i);
      }
      onRefresh();
    }, '7 days completed');
  }

  async function simulate3DaysLow() {
    await run(async () => {
      const u = await getOrCreateUser();
      for (let i = 2; i >= 0; i--) {
        await devInsertTaskLog(u.id, T02, 'skipped', i);
      }
      onRefresh();
    }, '3 days low');
  }

  async function simulateDaysAway(days: number) {
    await run(async () => {
      const u = await getOrCreateUser();
      const past = new Date(Date.now() - days * 86400000).toISOString();
      await devSetLastActive(u.id, past);
      onRefresh();
    }, `${days} days away`);
  }

  async function completeToday() {
    await run(async () => {
      const u = await getOrCreateUser();
      const taskId = await getCardId(1);
      const task = ALL_TASKS.find(t => t.id === taskId) ?? T07;
      await logTaskOutcome(u.id, task.id, task, 'completed', 'any', 1);
      onClose();
      navigation.replace('GoodNight', { outcome: 'completed' });
    }, 'Complete today');
  }

  async function skipToday() {
    await run(async () => {
      const u = await getOrCreateUser();
      const taskId = await getCardId(1);
      const task = ALL_TASKS.find(t => t.id === taskId) ?? T07;
      await logTaskOutcome(u.id, task.id, task, 'skipped', 'any', 1);
      onClose();
      navigation.replace('GoodNight', { outcome: 'skipped' });
    }, 'Skip today');
  }

  async function fullReset() {
    await run(async () => {
      await clearAllData();
      await AsyncStorage.clear();
      onClose();
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    }, 'Full reset');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>STATE</Text>
          {user ? (
            <View style={styles.stateBlock}>
              <Text style={styles.stateText}>Phase: {user.current_phase}</Text>
              <Text style={styles.stateText}>Arc: {user.active_arc_id ?? 'none'}</Text>
              <Text style={styles.stateText}>Last 7 logs:</Text>
              {history.slice(0, 7).map((e, i) => (
                <Text key={i} style={styles.logLine}>
                  {e.logged_at.split('T')[0]}  {e.task_id}  {e.outcome}
                </Text>
              ))}
            </View>
          ) : (
            <ActivityIndicator color={colors.amber} />
          )}

          <Text style={styles.sectionLabel}>PHASE</Text>
          <View style={styles.row}>
            {([1, 2, 3] as const).map(p => (
              <TouchableOpacity key={p} style={styles.btn} onPress={() => setPhase(p)} disabled={busy}>
                <Text style={styles.btnText}>Phase {p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>SIMULATE</Text>
          <View style={styles.col}>
            <TouchableOpacity style={styles.btn} onPress={simulate7DaysCompleted} disabled={busy}>
              <Text style={styles.btnText}>7 days completed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={simulate3DaysLow} disabled={busy}>
              <Text style={styles.btnText}>3 days low completion</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => simulateDaysAway(14)} disabled={busy}>
              <Text style={styles.btnText}>14 days away</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => simulateDaysAway(30)} disabled={busy}>
              <Text style={styles.btnText}>30 days away</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>TASK</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={completeToday} disabled={busy}>
              <Text style={styles.btnText}>Complete today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={skipToday} disabled={busy}>
              <Text style={styles.btnText}>Skip today</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>RESET</Text>
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={fullReset} disabled={busy}>
            <Text style={[styles.btnText, styles.btnTextDanger]}>Full reset</Text>
          </TouchableOpacity>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          {busy ? <ActivityIndicator color={colors.amber} style={{ marginTop: spacing.gap }} /> : null}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.gap,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.gap,
  },
  sectionLabel: {
    ...fonts.tiny,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginTop: spacing.gapLarge,
    marginBottom: 6,
  },
  stateBlock: {
    gap: 4,
  },
  stateText: {
    ...fonts.body,
    color: colors.textSecondary,
  },
  logLine: {
    ...fonts.small,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.gap,
  },
  col: {
    gap: spacing.gap,
  },
  btn: {
    backgroundColor: colors.background,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnDanger: {
    borderColor: '#C0392B',
  },
  btnText: {
    ...fonts.small,
    color: colors.textPrimary,
  },
  btnTextDanger: {
    color: '#C0392B',
  },
  msg: {
    ...fonts.small,
    color: colors.textSecondary,
    marginTop: spacing.gap,
    textAlign: 'center',
  },
});
