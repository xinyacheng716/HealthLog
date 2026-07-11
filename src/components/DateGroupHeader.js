import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';

export default function DateGroupHeader({ date }) {
  // Parse date for display
  const parts = date.split('/');
  const dateDisplay = parts.length === 3
    ? `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`
    : date;

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={[styles.date, { fontFamily: KAITI }]}>{dateDisplay}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.3,
  },
  date: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
