import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';

export default function Section({ title, children }) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {/* Cinnabar left stamp-mark */}
        <View style={styles.stamp}>
          <View style={styles.stampInner} />
        </View>
        <Text style={[styles.title, { fontFamily: KAITI }]}>{title}</Text>
        {/* Trailing hairline */}
        <View style={styles.rule} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 11,
  },
  stamp: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.cinnabar,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0.75,
  },
  stampInner: {
    width: 4,
    height: 4,
    borderRadius: 1,
    backgroundColor: colors.cinnabar,
  },
  title: {
    fontSize: 11,
    color: colors.textLabel,
    letterSpacing: 3,
    flexShrink: 0,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
  },
});
