/**
 * ErrorBoundary — app-wide render-crash guard (design-v2)
 *
 * Wraps the navigation tree so a render exception in ONE screen no longer
 * white-screens and freezes the whole app. Instead we show a calm, warm
 * fallback with the actual error text (so beta issues are diagnosable) and a
 * way back to Home — the JS thread stays alive and navigation keeps working.
 *
 * Colours are hard-coded to the base warm palette on purpose: the boundary must
 * render even if the theme/provider is what threw, so it does NOT call useAurora().
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in `adb logcat` / dev console for deeper debugging.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private reset = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  private goHome = (): void => {
    this.reset();
    try {
      router.replace('/(tabs)/home');
    } catch {
      // navigation not ready — reset alone will re-render the tree
    }
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const stackPreview = componentStack
      ? componentStack.trim().split('\n').slice(0, 6).join('\n')
      : null;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.emoji}>🌙</Text>
          <Text style={styles.title}>This screen hit a snag</Text>
          <Text style={styles.subtitle}>
            The rest of Dottie is fine — head back and keep going.
          </Text>

          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>WHAT HAPPENED</Text>
            <Text style={styles.errorText}>{error.message || String(error)}</Text>
            {stackPreview ? <Text style={styles.stackText}>{stackPreview}</Text> : null}
          </View>

          <Pressable
            style={styles.button}
            onPress={this.goHome}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <Text style={styles.buttonText}>Back to Home</Text>
          </Pressable>
          <Pressable
            style={styles.buttonGhost}
            onPress={this.reset}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonGhostText}>Try again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    paddingTop: 96,
    gap: 12,
  },
  emoji: {
    fontSize: 52,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D1B12',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B5344',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorBox: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF1E8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(180,130,100,0.20)',
    padding: 16,
    gap: 6,
    marginBottom: 8,
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#9B8B80',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B33A2B',
  },
  stackText: {
    fontSize: 11,
    color: '#6B5344',
    marginTop: 4,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: '#FF6B6B',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF8F2',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonGhost: {
    alignSelf: 'stretch',
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonGhostText: {
    color: '#6B5344',
    fontSize: 15,
    fontWeight: '600',
  },
});
