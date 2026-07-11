import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform, SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 21 }, (_, i) => THIS_YEAR - 5 + i); // -5 to +15
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function parseYMD(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function toDateStr(year, month, day) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function buildGrid(year, month) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const count = daysInMonth(year, month);
  const prevCount = daysInMonth(year, month === 1 ? 12 : month - 1);
  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) cells.push({ day: prevCount - i, kind: 'prev' });
  for (let d = 1; d <= count; d++) cells.push({ day: d, kind: 'cur' });
  const rem = cells.length % 7;
  if (rem > 0) for (let d = 1; d <= 7 - rem; d++) cells.push({ day: d, kind: 'next' });
  return cells;
}

export default function CalendarView({
  selectedDate, today, markedDates, appointmentDates, onSelectDate,
}) {
  const sel = parseYMD(selectedDate);
  const [dispYear, setDispYear] = useState(sel.year);
  const [dispMonth, setDispMonth] = useState(sel.month);

  // Year/month picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(sel.year);
  const [pickerMonth, setPickerMonth] = useState(sel.month);

  useEffect(() => {
    const { year, month } = parseYMD(selectedDate);
    setDispYear(year);
    setDispMonth(month);
  }, [selectedDate]);

  function openPicker() {
    setPickerYear(dispYear);
    setPickerMonth(dispMonth);
    setPickerOpen(true);
  }

  function confirmPicker() {
    setDispYear(pickerYear);
    setDispMonth(pickerMonth);
    setPickerOpen(false);
  }

  function prevMonth() {
    if (dispMonth === 1) { setDispYear(y => y - 1); setDispMonth(12); }
    else setDispMonth(m => m - 1);
  }

  function nextMonth() {
    if (dispMonth === 12) { setDispYear(y => y + 1); setDispMonth(1); }
    else setDispMonth(m => m + 1);
  }

  function handlePress(cell) {
    let year = dispYear, month = dispMonth;
    if (cell.kind === 'prev') { month--; if (month < 1) { month = 12; year--; } setDispYear(year); setDispMonth(month); }
    if (cell.kind === 'next') { month++; if (month > 12) { month = 1; year++; } setDispYear(year); setDispMonth(month); }
    onSelectDate(toDateStr(year, month, cell.day));
  }

  const cells = buildGrid(dispYear, dispMonth);
  // Split into rows of 7 — avoids float-width rounding that hides Saturday
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.calendar}>
      {/* Month header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity style={styles.monthArrow} onPress={prevMonth} hitSlop={12}>
          <View style={styles.chevronLeft} />
        </TouchableOpacity>

        {/* Tappable year/month title */}
        <TouchableOpacity style={styles.monthTitleBtn} onPress={openPicker} activeOpacity={0.7}>
          <Text style={[styles.monthTitle, FONT]}>
            {dispYear}年{String(dispMonth).padStart(2, '0')}月
          </Text>
          <View style={styles.titleChevron} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.monthArrow} onPress={nextMonth} hitSlop={12}>
          <View style={styles.chevronRight} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((wd, i) => (
          <View key={wd} style={styles.weekCell}>
            <Text style={[styles.weekText, FONT]}>{wd}</Text>
          </View>
        ))}
      </View>

      {/* Day grid — row-based to avoid float-width Saturday bug */}
      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {row.map((cell, colIdx) => {
              const idx = rowIdx * 7 + colIdx;
              const isCur = cell.kind === 'cur';
              let year = dispYear, month = dispMonth;
              if (cell.kind === 'prev') { month--; if (month < 1) { month = 12; year--; } }
              if (cell.kind === 'next') { month++; if (month > 12) { month = 1; year++; } }
              const dateStr = toDateStr(year, month, cell.day);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              const hasAppt = appointmentDates?.has(dateStr);
              const dimmed = !isCur;

              return (
                <TouchableOpacity
                  key={`${cell.kind}-${cell.day}-${idx}`}
                  style={styles.dayCell}
                  onPress={() => handlePress(cell)}
                  activeOpacity={0.55}
                >
                  <View style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSel,
                    !isSelected && isToday && styles.dayCircleToday,
                  ]}>
                    <Text style={[
                      styles.dayNum, FONT,
                      isSelected && styles.dayNumSel,
                      !isSelected && isToday && styles.dayNumToday,
                      dimmed && styles.dayNumDim,
                    ]}>
                      {cell.day}
                    </Text>
                  </View>
                  {hasAppt && (
                    <View style={[
                      styles.dot,
                      isSelected ? styles.dotWhite : (isCur ? styles.dotAppt : styles.dotDim),
                    ]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Year / Month picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetRule} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetStampWrap}>
                <View style={styles.sheetStamp} />
                <Text style={[styles.sheetTitle, FONT]}>選　擇　年　月</Text>
              </View>
              <TouchableOpacity style={styles.doneWrap} onPress={confirmPicker}>
                <Text style={[styles.doneText, FONT]}>完　成</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickersRow}>
              {/* Year picker */}
              <View style={styles.pickerCol}>
                {Platform.OS === 'android' ? (
                  <View style={styles.androidPickerWrap}>
                    <Picker
                      selectedValue={pickerYear}
                      onValueChange={setPickerYear}
                      style={[styles.androidPicker, FONT]}
                      dropdownIconColor={colors.gold}
                    >
                      {YEARS.map(y => (
                        <Picker.Item key={y} label={`${y} 年`} value={y} color={colors.textPrimary} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <Picker
                    selectedValue={pickerYear}
                    onValueChange={setPickerYear}
                    itemStyle={[styles.iosItem, FONT]}
                  >
                    {YEARS.map(y => (
                      <Picker.Item key={y} label={`${y}年`} value={y} color={colors.textPrimary} />
                    ))}
                  </Picker>
                )}
              </View>

              <View style={styles.pickerDivider} />

              {/* Month picker */}
              <View style={styles.pickerCol}>
                {Platform.OS === 'android' ? (
                  <View style={styles.androidPickerWrap}>
                    <Picker
                      selectedValue={pickerMonth}
                      onValueChange={setPickerMonth}
                      style={[styles.androidPicker, FONT]}
                      dropdownIconColor={colors.gold}
                    >
                      {MONTHS.map(m => (
                        <Picker.Item key={m} label={`${String(m).padStart(2, '0')} 月`} value={m} color={colors.textPrimary} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <Picker
                    selectedValue={pickerMonth}
                    onValueChange={setPickerMonth}
                    itemStyle={[styles.iosItem, FONT]}
                  >
                    {MONTHS.map(m => (
                      <Picker.Item key={m} label={`${String(m).padStart(2, '0')}月`} value={m} color={colors.textPrimary} />
                    ))}
                  </Picker>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },

  monthHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 11,
    backgroundColor: colors.header,
    borderBottomWidth: 1, borderBottomColor: 'rgba(154,120,56,0.25)',
  },
  monthArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  chevronLeft: {
    width: 8, height: 8, borderLeftWidth: 1.5, borderBottomWidth: 1.5,
    borderColor: colors.goldLight, transform: [{ rotate: '45deg' }], marginLeft: 3,
  },
  chevronRight: {
    width: 8, height: 8, borderRightWidth: 1.5, borderTopWidth: 1.5,
    borderColor: colors.goldLight, transform: [{ rotate: '45deg' }], marginRight: 3,
  },

  monthTitleBtn: { alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2 },
  monthTitle: { fontSize: 15, color: colors.white, letterSpacing: 2 },
  titleChevron: {
    width: 6, height: 6,
    borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(196,160,88,0.65)',
    transform: [{ rotate: '45deg' }, { translateY: -2 }],
  },

  weekRow: {
    flexDirection: 'row', backgroundColor: colors.bgSection,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint, paddingVertical: 5,
  },
  weekCell: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },
  weekSun: { color: colors.cinnabar, opacity: 0.85 },

  grid: { backgroundColor: colors.bgCard, paddingVertical: 2 },
  gridRow: { flexDirection: 'row' },
  dayCell: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleSel: { backgroundColor: colors.cinnabar },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.cinnabar },
  dayNum: { fontSize: 16, color: colors.textPrimary, lineHeight: 20 },
  dayNumSel: { color: colors.white, fontWeight: '600' },
  dayNumToday: { color: colors.cinnabar, fontWeight: '600' },
  dayNumDim: { color: colors.borderLight },
  dayNumSun: { color: colors.cinnabar, opacity: 0.75 },
  dots: { flexDirection: 'row', gap: 3, marginTop: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotMed: { backgroundColor: colors.cinnabar, opacity: 0.8 },
  dotAppt: { backgroundColor: colors.gold, opacity: 0.9 },
  dotDim: { backgroundColor: colors.border, opacity: 0.5 },
  dotWhite: { backgroundColor: colors.white, opacity: 0.75 },

  // Picker modal
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
    borderWidth: 1.5, borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.12)',
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
});
