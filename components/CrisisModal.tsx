import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { radius, spacing } from '../constants/spacing';

interface Props {
  visible: boolean;
}

export default function CrisisModal({ visible }: Props) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.message}>
            Sol is here with you. Please reach out to someone who can help right now.
          </Text>
          <Text style={styles.number}>Samaritans: 116 123</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => Linking.openURL('tel:116123')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Call now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.gapLarge,
  },
  message: {
    ...fonts.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  number: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.amberDark,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  buttonText: {
    ...fonts.taskTitle,
    color: '#FFFFFF',
  },
});
