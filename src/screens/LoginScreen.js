import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

export default function LoginScreen() {
  const { signInWithApple } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSignIn() {
    setLoading(true);
    setErrorMsg('');
    try {
      await signInWithApple();
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setErrorMsg(e.message || '登入發生錯誤');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRule} />

      <View style={styles.centerBlock}>
        {/* Corner marks */}
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />

        <Text style={[styles.title, FONT]}>健康記錄</Text>

        <View style={styles.goldDivider} />

        <Text style={[styles.subtitle, FONT]}>私人醫案手帳</Text>

        <View style={styles.spacer} />

        <Text style={[styles.prompt, FONT]}>以 Apple 帳號登入</Text>

        {loading ? (
          <ActivityIndicator color={colors.cinnabar} size="large" style={styles.spinner} />
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={4}
            style={styles.appleBtn}
            onPress={handleSignIn}
          />
        )}

        {errorMsg ? <Text style={[styles.error, FONT]}>{errorMsg}</Text> : null}
      </View>

      <View style={styles.bottomRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  topRule: {
    position: 'absolute',
    top: 72,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.45,
  },
  bottomRule: {
    position: 'absolute',
    bottom: 72,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.45,
  },

  centerBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 36,
    borderWidth: 1,
    borderColor: `${colors.gold}70`,
  },

  // Corner ornaments
  cornerTL: { position: 'absolute', top: -1,  left: -1,  width: 10, height: 10, borderTopWidth: 2,    borderLeftWidth: 2,   borderColor: colors.gold, opacity: 0.75 },
  cornerTR: { position: 'absolute', top: -1,  right: -1, width: 10, height: 10, borderTopWidth: 2,    borderRightWidth: 2,  borderColor: colors.gold, opacity: 0.75 },
  cornerBL: { position: 'absolute', bottom: -1, left: -1,  width: 10, height: 10, borderBottomWidth: 2, borderLeftWidth: 2,   borderColor: colors.gold, opacity: 0.75 },
  cornerBR: { position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderBottomWidth: 2, borderRightWidth: 2,  borderColor: colors.gold, opacity: 0.75 },

  title: {
    color: colors.header,
    fontSize: 44,
    letterSpacing: 14,
    marginBottom: 16,
  },

  goldDivider: {
    width: 48,
    height: 1.5,
    backgroundColor: colors.gold,
    opacity: 0.55,
    marginBottom: 12,
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 5,
  },

  spacer: {
    height: 36,
  },

  prompt: {
    color: colors.textLabel,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 16,
  },

  appleBtn: {
    width: 210,
    height: 46,
  },

  spinner: {
    height: 46,
  },

  error: {
    color: colors.cinnabarMid,
    fontSize: 12,
    marginTop: 14,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
