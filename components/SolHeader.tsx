import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { radius, spacing } from '../constants/spacing';

interface Props {
  onSecretTap?: () => void;
}

export default function SolHeader({ onSecretTap }: Props) {
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleWordmarkTap() {
    if (!__DEV__ || !onSecretTap) return;
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      onSecretTap();
    } else {
      tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1000);
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.iconMark}>
        <Svg width={20} height={20} viewBox="0 0 20 20">
          <Circle cx="10" cy="10" r="5" fill="#FFFFFF" opacity={0.9} />
          <Circle cx="10" cy="10" r="8" fill="none" stroke="#FFFFFF" strokeWidth={1} opacity={0.35} />
        </Svg>
      </View>
      <Pressable
        onPress={handleWordmarkTap}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Text style={styles.wordmark}>Sol</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.gap,
  },
  iconMark: {
    width: 44,
    height: 44,
    borderRadius: radius.icon * 2,
    backgroundColor: colors.amberDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...fonts.wordmark,
    color: colors.amberDark,
  },
});
