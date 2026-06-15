import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, ClipPath, Defs, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { radius, spacing } from '../constants/spacing';
import type { Task } from '../types';

const HOLD_MS   = 1500;
const RING_R    = 48;
const RING_C    = 2 * Math.PI * RING_R;
const PEEK_MAX  = 100;  // how many px the active card slides up on full peek
const PEEK_H    = 100;  // height of the peek card strip revealed below

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  task:       Task;
  onComplete: () => void;
  nextTask?:  Task | null;
}

export default function HoldGesture({ task, onComplete, nextTask }: Props) {
  const progress    = useSharedValue(0);
  const touchX      = useSharedValue(0);
  const touchY      = useSharedValue(0);
  const cardW       = useSharedValue(300);
  const cardH       = useSharedValue(500);
  const wiggle      = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const burst       = useSharedValue(0);
  const done        = useSharedValue(false);
  const dotOpacity  = useSharedValue(0);
  const peekProg    = useSharedValue(0);  // 0 = hidden, 1 = fully peeked

  const hasNext = !!nextTask;

  // Pulse dots when next card exists
  useEffect(() => {
    if (hasNext) {
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 900 }),
          withTiming(1,    { duration: 900 }),
        ),
        -1, false,
      );
    } else {
      cancelAnimation(dotOpacity);
      dotOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [hasNext]);

  // Reset on task change (new card slides in)
  useEffect(() => {
    done.value        = false;
    progress.value    = 0;
    cardOpacity.value = 1;
    burst.value       = 0;
    peekProg.value    = 0;
  }, [task.id]);

  function fireAndNavigate() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onComplete();
  }

  const triggerComplete = () => {
    'worklet';
    if (done.value) return;
    done.value = true;
    runOnJS(fireAndNavigate)();
    cardOpacity.value = withTiming(0, { duration: 400 });
    burst.value       = withTiming(1, { duration: 500 });
  };

  const holdGesture = Gesture.LongPress()
    .minDuration(50)
    .maxDistance(9999)
    .onBegin((e) => {
      'worklet';
      if (done.value) return;
      touchX.value = e.x;
      touchY.value = e.y;
      progress.value = withTiming(1, { duration: HOLD_MS }, (finished) => {
        if (finished) triggerComplete();
      });
      wiggle.value = withDelay(
        Math.floor(HOLD_MS * 0.85),
        withRepeat(
          withSequence(
            withTiming(3,  { duration: 60 }),
            withTiming(-3, { duration: 60 }),
            withTiming(0,  { duration: 60 }),
          ),
          3, false,
        ),
      );
    })
    .onFinalize(() => {
      'worklet';
      if (done.value) return;
      cancelAnimation(progress);
      cancelAnimation(wiggle);
      progress.value = withTiming(0, { duration: 300 });
      wiggle.value   = 0;
    });

  // Peek gesture — upward pull reveals next card, release springs back
  const panGesture = Gesture.Pan()
    .activeOffsetY(-15)
    .failOffsetY(20)
    .enabled(hasNext)
    .onUpdate((e) => {
      'worklet';
      if (e.translationY < 0) {
        peekProg.value = Math.min(1, -e.translationY / PEEK_MAX);
      }
    })
    .onEnd(() => {
      'worklet';
      peekProg.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const gesture = hasNext
    ? Gesture.Race(panGesture, holdGesture)
    : holdGesture;

  // ── Animated props / styles ───────────────────────────────────────────────

  const fillCircleProps = useAnimatedProps(() => {
    const maxR = Math.sqrt(
      Math.pow(Math.max(touchX.value, cardW.value - touchX.value), 2) +
      Math.pow(Math.max(touchY.value, cardH.value - touchY.value), 2),
    );
    return { r: progress.value * maxR, cx: touchX.value, cy: touchY.value };
  });

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }));

  const burst1Props = useAnimatedProps(() => ({
    cx: touchX.value, cy: touchY.value,
    r:  burst.value * 90,
    opacity: Math.max(0, 1 - burst.value),
  }));
  const burst2Props = useAnimatedProps(() => ({
    cx: touchX.value, cy: touchY.value,
    r:  burst.value * 150,
    opacity: Math.max(0, (1 - burst.value) * 0.5),
  }));

  // Active card slides up as peek increases
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${wiggle.value}deg` },
      { translateY: -peekProg.value * PEEK_MAX },
    ],
    opacity: cardOpacity.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  // Peek card slides up from below as peekProg increases
  const peekCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - peekProg.value) * PEEK_H }],
  }));

  return (
    <View style={styles.wrapper}>
      {/* Peek card — rendered first = behind active card */}
      {nextTask && (
        <Animated.View style={[styles.peekCard, peekCardStyle]} pointerEvents="none">
          <Text style={styles.peekTitle} numberOfLines={2}>{nextTask.title}</Text>
        </Animated.View>
      )}

      {/* Active card — rendered second = on top */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.card, cardStyle]}
          onLayout={(e) => {
            cardW.value = e.nativeEvent.layout.width;
            cardH.value = e.nativeEvent.layout.height;
          }}
        >
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <ClipPath id="holdFill">
                <AnimatedCircle animatedProps={fillCircleProps} />
              </ClipPath>
            </Defs>
            <Rect
              x={-1000} y={-1000} width={9999} height={9999}
              fill={colors.amberMid} fillOpacity={0.25}
              clipPath="url(#holdFill)"
            />
            <AnimatedCircle animatedProps={burst1Props} fill="none" stroke={colors.amber}    strokeWidth={2} />
            <AnimatedCircle animatedProps={burst2Props} fill="none" stroke={colors.amberMid} strokeWidth={1.5} />
          </Svg>

          <View style={styles.textBlock}>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.desc}>{task.description}</Text>
          </View>

          <View style={styles.ringWrap}>
            <Svg width={120} height={120} viewBox="0 0 120 120">
              <Circle cx="60" cy="60" r={RING_R} fill="none" stroke={colors.amberBorder} strokeWidth={2} />
              <AnimatedCircle
                animatedProps={ringProps}
                cx="60" cy="60" r={RING_R}
                fill="none" stroke={colors.amber} strokeWidth={3}
                strokeDasharray={RING_C} strokeLinecap="round"
                rotation="-90" origin="60,60"
              />
            </Svg>
          </View>

          {/* Amber dots — only visible when next card exists */}
          <Animated.View style={[styles.dotRow, dotStyle]} pointerEvents="none">
            <View style={styles.dotsRow}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <Text style={styles.pullLabel}>pull for next</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.amberLight,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.amberBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.gapLarge,
  },
  peekCard: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: PEEK_H,
    backgroundColor: colors.amberLight,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.amberBorder,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: spacing.cardPadding,
  },
  peekTitle: {
    ...fonts.taskTitle,
    color: colors.amberDark,
    textAlign: 'center',
    opacity: 0.7,
  },
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.cardPadding,
    gap: spacing.gap,
  },
  title: {
    ...fonts.taskTitle,
    color: colors.amberDark,
    textAlign: 'center',
  },
  desc: {
    ...fonts.taskDesc,
    color: colors.taskText,
    textAlign: 'center',
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRow: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: spacing.cardPadding,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.amberDark,
    opacity: 0.6,
  },
  pullLabel: {
    fontSize: 9,
    color: colors.amberDark,
    opacity: 0.5,
  },
});
