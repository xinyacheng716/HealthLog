import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  Modal, SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

// Minutes allowed in appointment time picker: union of ×10 and ×15
const MINUTE_OPTIONS = [0, 10, 15, 20, 30, 40, 45, 50];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

function snapMinute(m) {
  return MINUTE_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev,
  );
}

export function parseDate(str) {
  if (!str) return new Date();
  const [datePart, timePart = '00:00'] = str.split(' ');
  const [y, m, d] = datePart.split('/').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function extractTime(str) {
  if (!str) return '';
  return str.split(' ')[1] || '';
}

export default function DateTimeField({
  value,
  onChange,
  nullable = false,
  placeholder,
  timeOnly = false,
}) {
  // ── Full datetime picker state (non-timeOnly) ──────────────────────────
  const [showNative, setShowNative] = useState(false);
  const [androidStep, setAndroidStep] = useState('date');
  const [tempDate, setTempDate] = useState(null);

  // ── Custom time picker state (timeOnly) ────────────────────────────────
  const [showCustom, setShowCustom] = useState(false);
  const [pickerHour, setPickerHour] = useState(0);
  const [pickerMinute, setPickerMinute] = useState(0);

  const pickerDate = value ? parseDate(value) : new Date();
  const defaultPlaceholder = timeOnly ? '── 選擇時間 ──' : '── 選擇日期時間 ──';
  const displayValue = timeOnly ? extractTime(value) : value;

  // ── Handlers ──────────────────────────────────────────────────────────

  function handlePress() {
    if (timeOnly) {
      const d = value ? parseDate(value) : new Date();
      setPickerHour(d.getHours());
      setPickerMinute(snapMinute(d.getMinutes()));
      setShowCustom(true);
    } else {
      setAndroidStep('date');
      setTempDate(null);
      setShowNative(true);
    }
  }

  function confirmCustom() {
    const base = value ? parseDate(value) : new Date();
    const combined = new Date(
      base.getFullYear(), base.getMonth(), base.getDate(),
      pickerHour, pickerMinute,
    );
    onChange(formatDate(combined));
    setShowCustom(false);
  }

  function handleIOSChange(_, selectedDate) {
    if (!selectedDate) return;
    onChange(formatDate(selectedDate));
  }

  function handleAndroidChange(event, selectedDate) {
    if (event.type === 'dismissed') {
      setShowNative(false); setAndroidStep('date'); setTempDate(null);
      return;
    }
    const picked = selectedDate || pickerDate;
    if (androidStep === 'date') {
      setTempDate(picked);
      setAndroidStep('time');
    } else {
      const base = tempDate || pickerDate;
      const combined = new Date(
        base.getFullYear(), base.getMonth(), base.getDate(),
        picked.getHours(), picked.getMinutes(),
      );
      onChange(formatDate(combined));
      setShowNative(false); setAndroidStep('date'); setTempDate(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.trigger, (showNative || showCustom) && styles.triggerOpen]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <Text style={[styles.triggerText, !displayValue && styles.placeholder, FONT]} numberOfLines={1}>
            {displayValue || placeholder || defaultPlaceholder}
          </Text>
          {timeOnly ? (
            <View style={styles.iconWrap}><View style={styles.clockFace} /></View>
          ) : (
            <View style={styles.iconWrap}>
              <View style={styles.iconTop} />
              <View style={styles.iconBody} />
            </View>
          )}
        </TouchableOpacity>

        {nullable && !!value && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => onChange('')} hitSlop={8}>
            <Text style={[styles.clearText, FONT]}>清除</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Custom time picker Modal (timeOnly) ── */}
      <Modal visible={showCustom} transparent animationType="slide">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetRule} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetStampWrap}>
                <View style={styles.sheetStamp} />
                <Text style={[styles.sheetTitle, FONT]}>選　擇　時　間</Text>
              </View>
              <TouchableOpacity style={styles.doneWrap} onPress={confirmCustom}>
                <Text style={[styles.doneText, FONT]}>完　成</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickersRow}>
              {/* Hour */}
              <View style={styles.pickerCol}>
                {Platform.OS === 'android' ? (
                  <View style={styles.androidPickerWrap}>
                    <Picker
                      selectedValue={pickerHour}
                      onValueChange={setPickerHour}
                      style={[styles.androidPicker, FONT]}
                      dropdownIconColor={colors.gold}
                    >
                      {HOUR_OPTIONS.map((h) => (
                        <Picker.Item key={h} label={`${String(h).padStart(2, '0')} 時`} value={h} color={colors.textPrimary} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <Picker
                    selectedValue={pickerHour}
                    onValueChange={setPickerHour}
                    itemStyle={[styles.iosItem, FONT]}
                  >
                    {HOUR_OPTIONS.map((h) => (
                      <Picker.Item key={h} label={`${String(h).padStart(2, '0')} 時`} value={h} color={colors.textPrimary} />
                    ))}
                  </Picker>
                )}
              </View>

              <View style={styles.pickerDivider} />

              {/* Minute — only ×10 and ×15 values */}
              <View style={styles.pickerCol}>
                {Platform.OS === 'android' ? (
                  <View style={styles.androidPickerWrap}>
                    <Picker
                      selectedValue={pickerMinute}
                      onValueChange={setPickerMinute}
                      style={[styles.androidPicker, FONT]}
                      dropdownIconColor={colors.gold}
                    >
                      {MINUTE_OPTIONS.map((m) => (
                        <Picker.Item key={m} label={`${String(m).padStart(2, '0')} 分`} value={m} color={colors.textPrimary} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <Picker
                    selectedValue={pickerMinute}
                    onValueChange={setPickerMinute}
                    itemStyle={[styles.iosItem, FONT]}
                  >
                    {MINUTE_OPTIONS.map((m) => (
                      <Picker.Item key={m} label={`${String(m).padStart(2, '0')} 分`} value={m} color={colors.textPrimary} />
                    ))}
                  </Picker>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── iOS inline spinner (non-timeOnly only) ── */}
      {showNative && Platform.OS === 'ios' && (
        <View style={styles.iosPickerWrap}>
          <TouchableOpacity style={styles.iosDoneRow} onPress={() => setShowNative(false)}>
            <Text style={[styles.iosDoneText, FONT]}>完　成</Text>
          </TouchableOpacity>
          <DateTimePicker
            value={pickerDate}
            mode="datetime"
            display="spinner"
            onChange={handleIOSChange}
            locale="zh-TW"
            textColor={colors.textPrimary}
            style={styles.iosDTPicker}
          />
        </View>
      )}

      {/* ── Android dialog (non-timeOnly only) ── */}
      {showNative && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate || pickerDate}
          mode={androidStep}
          display="default"
          onChange={handleAndroidChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trigger: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 3,
    backgroundColor: colors.bgCard, paddingHorizontal: 12, paddingVertical: 11, gap: 8,
  },
  triggerOpen: { borderColor: colors.gold, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  triggerText: { flex: 1, fontSize: 15, color: colors.textPrimary, letterSpacing: 0.5 },
  placeholder: { color: colors.textMuted, fontSize: 14 },
  iconWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'flex-end', opacity: 0.5 },
  iconTop: { width: 10, height: 2, backgroundColor: colors.gold, borderRadius: 1, marginBottom: 2 },
  iconBody: { width: 12, height: 9, borderWidth: 1, borderColor: colors.gold, borderRadius: 1 },
  clockFace: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.gold },
  clearBtn: {
    paddingHorizontal: 10, paddingVertical: 11,
    borderWidth: 1, borderColor: colors.border, borderRadius: 3, backgroundColor: colors.bgCard,
  },
  clearText: { fontSize: 12, color: colors.textMuted, letterSpacing: 1 },

  // Custom time picker Modal
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,20,16,0.55)' },
  sheet: { backgroundColor: colors.bg },
  sheetRule: { height: 3, backgroundColor: colors.cinnabar, opacity: 0.9 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  sheetStampWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetStamp: {
    width: 10, height: 10, borderRadius: 2,
    borderWidth: 1.5, borderColor: colors.cinnabar, backgroundColor: 'rgba(139,48,32,0.12)',
  },
  sheetTitle: { fontSize: 13, color: colors.textLabel, letterSpacing: 3 },
  doneWrap: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: colors.cinnabar, borderRadius: 3 },
  doneText: { fontSize: 13, color: colors.white, letterSpacing: 2 },
  pickersRow: { flexDirection: 'row', alignItems: 'center' },
  pickerCol: { flex: 1 },
  pickerDivider: { width: 1, height: 120, backgroundColor: colors.borderFaint },
  iosItem: { fontSize: 17, color: colors.textPrimary },
  androidPickerWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 3, margin: 12, backgroundColor: colors.bgCard },
  androidPicker: { height: 50, color: colors.textPrimary },

  // iOS inline spinner (non-timeOnly)
  iosPickerWrap: {
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.gold,
    borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
    backgroundColor: colors.bgCard, overflow: 'hidden',
  },
  iosDoneRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
  },
  iosDoneText: { fontSize: 13, color: colors.cinnabar, letterSpacing: 2 },
  iosDTPicker: { width: '100%', backgroundColor: colors.bgCard },
});
