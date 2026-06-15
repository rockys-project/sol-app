import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { radius, spacing } from '../constants/spacing';
import { getVoiceTaskEdit, speakTask, stopSpeaking } from '../store/ai';
import type { Phase, Task } from '../types';
import tasksData from '../data/tasks.json';

const ALL_TASKS = tasksData as Task[];

interface Props {
  visible:     boolean;
  currentTask: Task;
  phase:       Phase;
  onAccept:    (task: Task) => void;
  onClose:     () => void;
}

type State = 'input' | 'thinking' | 'result' | 'error';

export default function VoiceEditModal({ visible, currentTask, phase, onAccept, onClose }: Props) {
  const [request,   setRequest]   = useState('');
  const [state,     setState]     = useState<State>('input');
  const [suggested, setSuggested] = useState<Task | null>(null);
  const [reason,    setReason]    = useState('');
  const [errMsg,    setErrMsg]    = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setRequest('');
      setState('input');
      setSuggested(null);
      setReason('');
      setErrMsg('');
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      stopSpeaking();
    }
  }, [visible]);

  async function handleSubmit() {
    if (!request.trim()) return;
    Keyboard.dismiss();
    setState('thinking');

    const result = await getVoiceTaskEdit(currentTask, request.trim(), ALL_TASKS, phase);
    if (!result) {
      setErrMsg("Couldn't find a match — try describing what you need differently.");
      setState('error');
      return;
    }

    const task = ALL_TASKS.find(t => t.id === result.taskId);
    if (!task) {
      setErrMsg('Something went wrong. Try again.');
      setState('error');
      return;
    }

    setSuggested(task);
    setReason(result.reason);
    setState('result');
    speakTask(task);
  }

  function handleAccept() {
    if (!suggested) return;
    stopSpeaking();
    onAccept(suggested);
    onClose();
  }

  function handleTryAgain() {
    setState('input');
    setSuggested(null);
    setReason('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Current task chip */}
          <Text style={styles.label}>NOW</Text>
          <View style={styles.currentChip}>
            <Text style={styles.currentChipText} numberOfLines={1}>{currentTask.title}</Text>
          </View>

          {state === 'input' && (
            <>
              <Text style={styles.label}>WHAT WOULD YOU LIKE INSTEAD?</Text>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={request}
                onChangeText={setRequest}
                placeholder="easier · outside · something to eat · just different"
                placeholderTextColor={colors.textTertiary}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
                autoCorrect
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.submitBtn, !request.trim() && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!request.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.submitBtnText}>Find it</Text>
              </TouchableOpacity>
            </>
          )}

          {state === 'thinking' && (
            <View style={styles.centreBlock}>
              <ActivityIndicator color={colors.amber} size="large" />
              <Text style={styles.thinkingText}>Finding the right task…</Text>
            </View>
          )}

          {state === 'result' && suggested && (
            <>
              <Text style={styles.label}>SUGGESTED</Text>
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>{suggested.title}</Text>
                <Text style={styles.resultDesc}>{suggested.description}</Text>
                <Text style={styles.resultReason}>{reason}</Text>
              </View>
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
                  <Text style={styles.acceptBtnText}>Take it</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.retryBtn} onPress={handleTryAgain} activeOpacity={0.7}>
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {state === 'error' && (
            <View style={styles.centreBlock}>
              <Text style={styles.errText}>{errMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleTryAgain} activeOpacity={0.7}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 24 }} />
        </View>
      </KeyboardAvoidingView>
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
    borderTopLeftRadius:  radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.gap,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.gapLarge,
  },
  label: {
    ...fonts.tiny,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  currentChip: {
    backgroundColor: colors.amberLight,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.amberBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.gapLarge,
  },
  currentChipText: {
    ...fonts.body,
    color: colors.amberDark,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...fonts.body,
    color: colors.textPrimary,
    marginBottom: spacing.gap,
  },
  submitBtn: {
    backgroundColor: colors.amberDark,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    ...fonts.taskTitle,
    color: '#FFFFFF',
  },
  centreBlock: {
    alignItems: 'center',
    paddingVertical: spacing.gapLarge,
    gap: spacing.gap,
  },
  thinkingText: {
    ...fonts.small,
    color: colors.textSecondary,
  },
  resultCard: {
    backgroundColor: colors.amberLight,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.amberBorder,
    padding: spacing.cardPadding,
    gap: 8,
    marginBottom: spacing.gap,
  },
  resultTitle: {
    ...fonts.taskTitle,
    color: colors.amberDark,
  },
  resultDesc: {
    ...fonts.taskDesc,
    color: colors.taskText,
  },
  resultReason: {
    ...fonts.small,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.gap,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.amberDark,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptBtnText: {
    ...fonts.taskTitle,
    color: '#FFFFFF',
  },
  retryBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryBtnText: {
    ...fonts.taskTitle,
    color: colors.textSecondary,
  },
  errText: {
    ...fonts.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
