import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/store/authStore';
import { theme } from '@/src/theme';

type Step = 'email' | 'verify';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSendMagicLink() {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await api.post('/auth/magic-link', { email: email.trim().toLowerCase() });
      setInfo('Check your email for a magic link or one-time code.');
      setStep('verify');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify() {
    if (!token.trim()) {
      setError('Please enter the verification code from your email.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post<{ token: string; user: { userId: string; email: string } }>(
        '/auth/verify',
        { email: email.trim().toLowerCase(), token: token.trim() },
      );
      await setAuth(res.token, res.user);
      router.replace('/(tabs)/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="headlineLarge" style={styles.title}>
            Work Logbook
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Track your daily work, effortlessly.
          </Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Sign In
              </Text>
              <TextInput
                label="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                mode="outlined"
                style={styles.input}
                outlineColor="#333"
                activeOutlineColor={theme.colors.primary}
                textColor="#fff"
                theme={{ colors: { background: '#1a1a1a' } }}
              />
              {error ? <HelperText type="error">{error}</HelperText> : null}
              <Button
                mode="contained"
                onPress={handleSendMagicLink}
                loading={isLoading}
                disabled={isLoading}
                style={styles.button}
                buttonColor={theme.colors.primary}
              >
                Send Magic Link
              </Button>
            </>
          ) : (
            <>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Verify Your Email
              </Text>
              {info ? (
                <Text variant="bodySmall" style={styles.infoText}>
                  {info}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={styles.emailHint}>
                Sent to: {email}
              </Text>
              <TextInput
                label="Verification code"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoComplete="one-time-code"
                mode="outlined"
                style={styles.input}
                outlineColor="#333"
                activeOutlineColor={theme.colors.primary}
                textColor="#fff"
                theme={{ colors: { background: '#1a1a1a' } }}
              />
              {error ? <HelperText type="error">{error}</HelperText> : null}
              <Button
                mode="contained"
                onPress={handleVerify}
                loading={isLoading}
                disabled={isLoading}
                style={styles.button}
                buttonColor={theme.colors.primary}
              >
                Verify
              </Button>
              <Button
                mode="text"
                onPress={() => {
                  setStep('email');
                  setToken('');
                  setError('');
                  setInfo('');
                }}
                style={styles.backButton}
                textColor="#888"
              >
                Back
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
  },
  cardTitle: {
    color: '#ffffff',
    marginBottom: 20,
    fontWeight: '600',
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  backButton: {
    marginTop: 4,
  },
  infoText: {
    color: '#6C63FF',
    marginBottom: 12,
    lineHeight: 18,
  },
  emailHint: {
    color: '#888',
    marginBottom: 12,
  },
});
