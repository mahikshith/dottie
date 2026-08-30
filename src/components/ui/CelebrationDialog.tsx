/**
 * CelebrationDialog — warm, themed replacement for native Alert popups.
 *
 * Native `Alert.alert` renders an OS dialog we can't theme (the white boxes beta
 * testers flagged). This is a small in-app modal on a dim scrim with a big emoji,
 * title, optional reward line, and 1–2 actions (primary coral pill + optional
 * ghost). Colours are the base warm palette so a celebration always feels warm,
 * regardless of the current mood theme. Groundwork for richer companion
 * celebrations later.
 */

import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
}

interface Props {
  visible: boolean;
  emoji: string;
  title: string;
  body?: string;
  actions: DialogAction[];
  onRequestClose?: () => void;
}

export function CelebrationDialog({
  visible,
  emoji,
  title,
  body,
  actions,
  onRequestClose,
}: Props): JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(340).springify().damping(18)}
          style={styles.card}
        >
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <View style={styles.actions}>
            {actions.map((a) =>
              a.variant === 'ghost' ? (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  style={styles.ghostBtn}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <Text style={styles.ghostText}>{a.label}</Text>
                </Pressable>
              ) : (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <Text style={styles.primaryText}>{a.label}</Text>
                </Pressable>
              )
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,15,10,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    alignSelf: 'stretch',
    maxWidth: 400,
    backgroundColor: '#FFF8F2',
    borderRadius: 26,
    padding: 26,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#B48264',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 10,
  },
  emoji: { fontSize: 52 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D1B12',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#6B5344',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  actions: { alignSelf: 'stretch', gap: 6, marginTop: 6 },
  primaryBtn: {
    backgroundColor: '#FF6B6B',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryPressed: { transform: [{ scale: 0.97 }], opacity: 0.95 },
  primaryText: { color: '#FFF8F2', fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: '#6B5344', fontSize: 15, fontWeight: '600' },
});
