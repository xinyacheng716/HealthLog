import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Platform,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';

export default function AppPicker({
  items, value, onChange,
  placeholder = '── 請選擇 ──',
  nullable = false,
}) {
  const [iosOpen, setIosOpen] = useState(false);
  // tempValue holds the in-picker selection so the first item is always committable
  const [tempValue, setTempValue] = useState(value);
  const displayLabel = value || placeholder;

  function openPicker() {
    setTempValue(value);
    setIosOpen(true);
  }

  function confirmPicker() {
    onChange(tempValue);
    setIosOpen(false);
  }

  if (Platform.OS === 'android') {
    return (
      <View style={styles.androidWrapper}>
        <Picker
          selectedValue={value}
          onValueChange={(v) => onChange(v === '__placeholder__' ? '' : v)}
          style={[styles.androidPicker, { fontFamily: KAITI }]}
          dropdownIconColor={colors.gold}
        >
          <Picker.Item
            label={placeholder}
            value={nullable ? '' : '__placeholder__'}
            color={colors.textMuted}
          />
          {items.map((item) => (
            <Picker.Item key={item} label={item} value={item} color={colors.textPrimary} />
          ))}
        </Picker>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.iosTrigger}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.iosTriggerText,
          !value && styles.placeholder,
          { fontFamily: KAITI },
        ]}>
          {displayLabel}
        </Text>
        {/* Chevron as a small diamond rotated */}
        <View style={styles.chevronWrap}>
          <View style={styles.chevronDiamond} />
        </View>
      </TouchableOpacity>

      <Modal visible={iosOpen} transparent animationType="slide">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            {/* Cinnabar top rule */}
            <View style={styles.sheetTopRule} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleWrap}>
                {/* Small stamp ornament */}
                <View style={styles.sheetStamp} />
                <Text style={[styles.sheetTitle, { fontFamily: KAITI }]}>請選擇</Text>
              </View>
              <TouchableOpacity onPress={confirmPicker} style={styles.doneWrap}>
                <Text style={[styles.doneBtn, { fontFamily: KAITI }]}>完　成</Text>
              </TouchableOpacity>
            </View>

            <Picker
              selectedValue={tempValue}
              onValueChange={(v) => setTempValue(v)}
              itemStyle={[styles.iosItemStyle, { fontFamily: KAITI }]}
            >
              {nullable && (
                <Picker.Item label={placeholder} value="" color={colors.textMuted} />
              )}
              {items.map((item) => (
                <Picker.Item key={item} label={item} value={item} color={colors.textPrimary} />
              ))}
            </Picker>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  androidWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  androidPicker: {
    height: 50,
    color: colors.textPrimary,
  },

  iosTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iosTriggerText: {
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: 0.5,
  },
  placeholder: {
    color: colors.textMuted,
  },
  chevronWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    opacity: 0.6,
  },
  chevronDiamond: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.gold,
    transform: [{ rotate: '45deg' }, { translateY: -2 }],
  },

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(30,20,16,0.55)',
  },
  sheet: {
    backgroundColor: colors.bg,
  },
  sheetTopRule: {
    height: 3,
    backgroundColor: colors.cinnabar,
    opacity: 0.9,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sheetTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetStamp: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.12)',
  },
  sheetTitle: {
    fontSize: 13,
    color: colors.textLabel,
    letterSpacing: 3,
  },
  doneWrap: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: colors.cinnabar,
    borderRadius: 3,
  },
  doneBtn: {
    fontSize: 13,
    color: colors.white,
    letterSpacing: 2,
  },
  iosItemStyle: {
    fontSize: 17,
    color: colors.textPrimary,
  },
});
