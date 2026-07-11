import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Modal, SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../constants/colors';
import { parseDate, formatDate } from './DateTimeField';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

const PERIODS = ['上午', '中午', '下午'];
const PERIOD_HOUR = { 上午: 9, 中午: 12, 下午: 15 };

function periodFromHour(h) {
  if (h < 12) return '上午';
  if (h < 14) return '中午';
  return '下午';
}

// 用當下實際時間自動判斷區段，回傳該區段代表時刻的 startTime 字串
export function periodStartTime(date = new Date()) {
  const period = periodFromHour(date.getHours());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), PERIOD_HOUR[period], 0);
  return formatDate(d);
}

function dateLabel(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export default function PeriodTimeField({ value, onChange }) {
  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempPeriod, setTempPeriod] = useState('上午');

  const current = parseDate(value);
  const period = periodFromHour(current.getHours());

  function openModal() {
    setTempDate(current);
    setTempPeriod(period);
    setShowDatePicker(false);
    setShowModal(true);
  }

  function confirm() {
    const combined = new Date(
      tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(),
      PERIOD_HOUR[tempPeriod], 0,
    );
    onChange(formatDate(combined));
    setShowModal(false);
  }

  function handleDateChange(event, selectedDate) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'dismissed' || !selectedDate) return;
      setTempDate(selectedDate);
    } else if (selectedDate) {
      setTempDate(selectedDate);
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.display}>
        <Text style={[styles.displayText, FONT]}>{dateLabel(current)}　{period}</Text>
      </View>

      <TouchableOpacity style={styles.adjustBtn} onPress={openModal} activeOpacity={0.7}>
        <View style={styles.adjustIcon}>
          <View style={styles.adjustIconTop} />
          <View style={styles.adjustIconBody} />
        </View>
        <Text style={[styles.adjustText, FONT]}>調整</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetRule} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetStampWrap}>
                <View style={styles.sheetStamp} />
                <Text style={[styles.sheetTitle, FONT]}>調　整　時　段</Text>
              </View>
              <TouchableOpacity style={styles.doneWrap} onPress={confirm}>
                <Text style={[styles.doneText, FONT]}>完　成</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <Text style={[styles.sectionLabel, FONT]}>日　　期</Text>
              <TouchableOpacity
                style={styles.dateRow}
                onPress={() => setShowDatePicker((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateRowText, FONT]}>{dateLabel(tempDate)}</Text>
                <Text style={[styles.dateRowChange, FONT]}>更　改</Text>
              </TouchableOpacity>

              {showDatePicker && Platform.OS === 'ios' && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  locale="zh-TW"
                  textColor={colors.textPrimary}
                  style={styles.dtPicker}
                />
              )}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}

              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, FONT]}>時　　段</Text>
              <View style={styles.periodRow}>
                {PERIODS.map((p) => {
                  const active = tempPeriod === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.periodBtn, active && styles.periodBtnActive]}
                      onPress={() => setTempPeriod(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.periodBtnText, FONT, active && styles.periodBtnTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  display: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  displayText: { fontSize: 15, color: colors.textPrimary, letterSpacing: 1 },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
  },
  adjustIcon: { width: 14, height: 14, alignItems: 'center', justifyContent: 'flex-end', opacity: 0.6 },
  adjustIconTop: { width: 9, height: 2, backgroundColor: colors.gold, borderRadius: 1, marginBottom: 2 },
  adjustIconBody: { width: 11, height: 8, borderWidth: 1, borderColor: colors.gold, borderRadius: 1 },
  adjustText: { fontSize: 12, color: colors.textLabel, letterSpacing: 1 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,20,16,0.55)' },
  sheet: { backgroundColor: colors.bg },
  sheetRule: { height: 3, backgroundColor: colors.cinnabar, opacity: 0.9 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sheetStampWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetStamp: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.12)',
  },
  sheetTitle: { fontSize: 13, color: colors.textLabel, letterSpacing: 3 },
  doneWrap: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: colors.cinnabar, borderRadius: 3 },
  doneText: { fontSize: 13, color: colors.white, letterSpacing: 2 },

  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  sectionLabel: { fontSize: 11, color: colors.textLabel, letterSpacing: 2 },
  sectionLabelSpaced: { marginTop: 18 },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateRowText: { fontSize: 15, color: colors.textPrimary, letterSpacing: 1 },
  dateRowChange: { fontSize: 11, color: colors.cinnabar, letterSpacing: 1 },
  dtPicker: { width: '100%', backgroundColor: colors.bgCard },

  periodRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
  },
  periodBtnActive: {
    borderColor: colors.cinnabar,
    backgroundColor: colors.cinnabar,
  },
  periodBtnText: { fontSize: 14, color: colors.textPrimary, letterSpacing: 2 },
  periodBtnTextActive: { color: colors.white },
});
