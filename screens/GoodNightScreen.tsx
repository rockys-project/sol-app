import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import type { StackScreenProps } from '@react-navigation/stack';
import SolHeader from '../components/SolHeader';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { radius, spacing } from '../constants/spacing';
import { getLastMessageIndex, setLastMessageIndex } from '../store/database';
import { getAICompletionMessage } from '../store/ai';
import type { RootStackParamList } from '../types';
import messages from '../data/messages.json';

type Props = StackScreenProps<RootStackParamList, 'GoodNight'>;

const TYPEWRITER_INTERVAL_MS = 28;

export default function GoodNightScreen({ route, navigation }: Props) {
  const { outcome, task, phase } = route.params;

  const [displayed,     setDisplayed]     = useState('');
  const fullMessageRef  = useRef('');
  const typewriterTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const canNavigate     = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => { canNavigate.current = true; }, 3000);
    loadMessage();
    return () => {
      clearTimeout(timer);
      if (typewriterTimer.current) clearInterval(typewriterTimer.current);
    };
  }, []);

  function startTypewriter(text: string) {
    fullMessageRef.current = text;
    let i = 0;
    typewriterTimer.current = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typewriterTimer.current!);
        typewriterTimer.current = null;
      }
    }, TYPEWRITER_INTERVAL_MS);
  }

  async function loadMessage() {
    // Try AI-generated message first when we have context
    if (task && phase) {
      try {
        const timeOfDay = (() => {
          const h = new Date().getHours();
          if (h >= 5  && h < 12) return 'morning'  as const;
          if (h >= 12 && h < 17) return 'afternoon' as const;
          if (h >= 17 && h < 21) return 'evening'   as const;
          return 'any' as const;
        })();

        const aiMessage = await getAICompletionMessage(task, outcome, phase, timeOfDay);
        if (aiMessage) {
          startTypewriter(aiMessage);
          return;
        }
      } catch {}
    }

    // Fallback — pick from the static message pool
    loadStaticMessage();
  }

  async function loadStaticMessage() {
    const pool = outcome === 'completed' ? messages.completed : messages.skipped;
    let lastIndex = -1;
    try { lastIndex = await getLastMessageIndex(outcome); } catch {}
    const available = pool.map((_, i) => i).filter(i => i !== lastIndex);
    const nextIndex = available[Math.floor(Math.random() * available.length)];
    try { await setLastMessageIndex(outcome, nextIndex); } catch {}
    startTypewriter(pool[nextIndex]);
  }

  function handleTap() {
    if (!canNavigate.current) return;
    navigation.replace('Today');
  }

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <SafeAreaView style={styles.container}>
        <SolHeader />
        <View style={styles.centre}>
          <View style={styles.iconMark}>
            <Svg width={20} height={20} viewBox="0 0 20 20">
              <Circle cx="10" cy="10" r="5" fill="#FFFFFF" opacity={0.9} />
              <Circle cx="10" cy="10" r="8" fill="none" stroke="#FFFFFF" strokeWidth={1} opacity={0.35} />
            </Svg>
          </View>
          <Text style={styles.message}>{displayed}</Text>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.gapLarge,
    paddingHorizontal: spacing.screenPadding * 2,
  },
  iconMark: {
    width: 44,
    height: 44,
    borderRadius: radius.icon * 2,
    backgroundColor: colors.amberDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...fonts.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
