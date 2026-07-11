import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, KeyboardAvoidingView, Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, cardShadow } from '../constants/colors';
import { SettingsContext } from '../context';
import { loadDailyMed, saveDailyMed, loadMarkedDates } from '../storage';
import { useViewer } from '../context/ViewerContext';
import { fetchOwnerDailyMed, fetchOwnerMedList, fetchOwnerAllMedKeys } from '../lib/viewerData';
import {
  ensureAnticoagulantReminder,
  ensureAnticoagulantEveningReminder,
  scheduleMorphinePatchReminder,
  cancelMorphinePatchReminder,
} from '../lib/notifications';

const SCREEN_H = Dimensions.get('window').height;
const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DailyMedScreen() {
  const { medList } = useContext(SettingsContext);
  const { isViewerMode, activeOwner } = useViewer();
  const insets = useSafeAreaInsets();
  const today = todayKey();
  const activeDate = today;

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyViewMode, setHistoryViewMode] = useState('date'); // 'date' | 'med'

  // ── Own data state ───────────────────────────────────────────────────────
  const [checked, setChecked] = useState({});
  const [markedDates, setMarkedDates] = useState(new Set());

  // ── Viewer data state ────────────────────────────────────────────────────
  const [viewerChecked, setViewerChecked] = useState({});
  const [viewerFullMedList, setViewerFullMedList] = useState([]);
  const [viewerAllMedKeys, setViewerAllMedKeys] = useState([]);

  useEffect(() => {
    loadMarkedDates().then(setMarkedDates);
  }, []);

  useEffect(() => {
    loadDailyMed(activeDate).then((data) => setChecked(data.checked || {}));
  }, [activeDate]);

  // Load viewer data when entering viewer mode or switching owner
  useEffect(() => {
    if (!isViewerMode || !activeOwner) {
      setViewerChecked({});
      setViewerFullMedList([]);
      setViewerAllMedKeys([]);
      return;
    }
    fetchOwnerMedList(activeOwner.id).then(setViewerFullMedList);
    fetchOwnerAllMedKeys(activeOwner.id).then(setViewerAllMedKeys);
  }, [isViewerMode, activeOwner?.id]);

  // Re-fetch owner med list whenever this tab comes into focus
  useFocusEffect(useCallback(() => {
    if (isViewerMode && activeOwner) {
      fetchOwnerMedList(activeOwner.id).then(setViewerFullMedList);
      fetchOwnerAllMedKeys(activeOwner.id).then(setViewerAllMedKeys);
    }
  }, [isViewerMode, activeOwner?.id]));

  // Load viewer daily med for active date
  useEffect(() => {
    if (!isViewerMode || !activeOwner) { setViewerChecked({}); return; }
    fetchOwnerDailyMed(activeOwner.id, activeDate).then(setViewerChecked);
  }, [isViewerMode, activeOwner?.id, activeDate]);

  // 切換身份時確認抗凝血每日提醒（早晚各一筆）是否已排程（idempotent）
  useEffect(() => {
    ensureAnticoagulantReminder();
    ensureAnticoagulantEveningReminder();
  }, [activeOwner?.id]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function loadHistoryData() {
    const pad = (n) => String(n).padStart(2, '0');
    const result = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      let dayChecked = {};
      if (isViewerMode && activeOwner) {
        dayChecked = (await fetchOwnerDailyMed(activeOwner.id, dateKey)) || {};
      } else {
        const data = await loadDailyMed(dateKey);
        dayChecked = data.checked || {};
      }
      result.push({ dateKey, checked: dayChecked });
    }
    setHistoryData(result);
  }

  function toggle(med) {
    setChecked((prev) => {
      const isNowChecked = !prev[med];
      const next = { ...prev, [med]: isNowChecked };
      saveDailyMed(activeDate, next);
      const anyChecked = Object.values(next).some(Boolean);
      setMarkedDates((s) => {
        const ns = new Set(s);
        anyChecked ? ns.add(activeDate) : ns.delete(activeDate);
        return ns;
      });
      // 嗎啡貼布：打勾 → 排程換貼提醒；取消打勾 → 取消排程
      if (med === '嗎啡貼布') {
        if (isNowChecked) scheduleMorphinePatchReminder();
        else cancelMorphinePatchReminder();
      }
      return next;
    });
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeChecked = isViewerMode ? viewerChecked : checked;

  // viewer mode: prefer profiles.med_list; fall back to union of all historical check keys + today's keys
  const viewerMedKeys = Object.keys(viewerChecked);
  const viewerFallbackKeys = [...new Set([...viewerAllMedKeys, ...viewerMedKeys])];
  const activeMedList = isViewerMode
    ? (viewerFullMedList.length > 0 ? viewerFullMedList : viewerFallbackKeys)
    : medList;
  const checkedCount = activeMedList.filter((m) => activeChecked[m]).length;
  const total = activeMedList.length;
  const progress = total > 0 ? checkedCount / total : 0;
  const complete = progress === 1 && total > 0;

  // ════════════════════════════════════════════════════════════════════════
  //  TODAY MED TAB (今日用藥)
  // ════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View style={styles.dateLabelRow}>
            <Text style={[styles.dateLabel, FONT]}>
              {today.replace(/-(\d+)-(\d+)$/, '年$1月$2日')}（今日）
            </Text>
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => { loadHistoryData(); setHistoryViewMode('date'); setShowHistoryModal(true); }}
              activeOpacity={0.7}
            >
              <View style={styles.historyBtnIconWrap}>
                <View style={styles.historyBtnClockRing} />
                <View style={styles.historyBtnClockH} />
                <View style={styles.historyBtnClockM} />
              </View>
              <Text style={[styles.historyBtnLabel, FONT]}>歷史</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.progressCard, cardShadow]}>
            <View style={styles.cardTopRule}>
              <View style={styles.cardLine} />
              <View style={styles.cardDiamond} />
              <View style={styles.cardLine} />
            </View>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, FONT]}>今日用藥進度</Text>
              <View style={styles.countWrap}>
                <Text style={[styles.countNum, FONT]}>{checkedCount}</Text>
                <Text style={[styles.countSlash, FONT]}> / </Text>
                <Text style={[styles.countTotal, FONT]}>{total}</Text>
              </View>
            </View>
            <View style={styles.trackBg}>
              {Array.from({ length: total + 1 }).map((_, i) => (
                <View key={i} style={[styles.trackTick, { left: `${(i / total) * 100}%` }]} />
              ))}
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
            </View>
            {complete && (
              <View style={styles.banner}>
                <View style={styles.bannerLine} />
                <Text style={[styles.bannerText, FONT]}>今日用藥已全部確認</Text>
                <View style={styles.bannerLine} />
              </View>
            )}
          </View>

          <View style={[styles.listCard, cardShadow]}>
            <View style={styles.listHeader}>
              <Text style={[styles.listHeaderText, FONT]}>藥　　物</Text>
              <Text style={[styles.listHeaderText, FONT]}>服藥狀態</Text>
            </View>
            {activeMedList.length === 0 ? (
              <View style={styles.row}>
                <Text style={[styles.medName, FONT, { opacity: 0.5 }]}>尚無用藥記錄</Text>
              </View>
            ) : activeMedList.map((med, idx) => {
              const isChecked = activeChecked[med];
              const isLast = idx === activeMedList.length - 1;
              return (
                <TouchableOpacity
                  key={med}
                  style={[styles.row, isLast && styles.rowLast, isChecked && styles.rowChecked]}
                  onPress={isViewerMode ? undefined : () => toggle(med)}
                  activeOpacity={isViewerMode ? 1 : 0.65}
                  disabled={isViewerMode}
                >
                  <Text style={[styles.rowIndex, FONT]}>{idx + 1}</Text>
                  <Text style={[styles.medName, FONT, isChecked && styles.medNameChecked]}>
                    {med}
                  </Text>
                  <View style={[styles.statusBox, isChecked && styles.statusBoxChecked]}>
                    {isChecked
                      ? <Text style={[styles.statusCheck, FONT]}>服</Text>
                      : <View style={styles.statusEmpty} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 近七日用藥紀錄 Modal ── */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowHistoryModal(false)}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom }]}>
            {/* handle bar */}
            <View style={styles.modalHandle} />

            {/* header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalRuleLine} />
              <View style={styles.modalDiamond} />
              <Text style={[styles.modalTitleText, FONT]}>近七日用藥紀錄</Text>
              <View style={styles.modalDiamond} />
              <View style={styles.modalRuleLine} />
            </View>

            {/* close */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowHistoryModal(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCloseTxt, FONT]}>收起</Text>
            </TouchableOpacity>

            {/* 依日期 / 依藥物 切換 */}
            <View style={styles.historyModeToggleRow}>
              <TouchableOpacity
                style={[styles.historyModeBtn, historyViewMode === 'date' && styles.historyModeBtnActive]}
                onPress={() => setHistoryViewMode('date')}
                activeOpacity={0.7}
              >
                <Text style={[styles.historyModeBtnText, FONT, historyViewMode === 'date' && styles.historyModeBtnTextActive]}>
                  依日期
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.historyModeBtn, historyViewMode === 'med' && styles.historyModeBtnActive]}
                onPress={() => setHistoryViewMode('med')}
                activeOpacity={0.7}
              >
                <Text style={[styles.historyModeBtnText, FONT, historyViewMode === 'med' && styles.historyModeBtnTextActive]}>
                  依藥物
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              {historyViewMode === 'med' ? activeMedList.map((med) => (
                <View key={med} style={[styles.historyMedGroupCard, cardShadow]}>
                  <View style={styles.historyMedGroupHeaderRow}>
                    <Text style={[styles.historyMedGroupTitle, FONT]}>{med}</Text>
                  </View>
                  {historyData.map(({ dateKey, checked: dayChecked }, idx) => {
                    const isYesterday = idx === 0;
                    const dayLabel = isYesterday
                      ? '昨天'
                      : dateKey.replace(/^\d+-0*(\d+)-0*(\d+)$/, '$1/$2');
                    const taken = !!dayChecked[med];
                    const isLast = idx === historyData.length - 1;
                    return (
                      <View
                        key={dateKey}
                        style={[styles.historyMedDayRow, isLast && styles.historyMedRowLast, taken && styles.rowChecked]}
                      >
                        <Text style={[styles.historyMedDayLabel, FONT]}>{dayLabel}</Text>
                        <View style={[styles.statusBox, taken && styles.statusBoxChecked]}>
                          {taken
                            ? <Text style={[styles.statusCheck, FONT]}>服</Text>
                            : <View style={styles.statusEmpty} />}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )) : historyData.map(({ dateKey, checked: dayChecked }) => {
                const dateDisplay = dateKey.replace(/-(\d+)-(\d+)$/, '年$1月$2日');
                const takenMeds = activeMedList.filter((m) => !!dayChecked[m]);
                const hasRecord = takenMeds.length > 0;
                return (
                  <View key={dateKey} style={[styles.historyDayCard, cardShadow]}>
                    <View style={styles.historyDayHeaderRow}>
                      <Text style={[styles.historyDayDateText, FONT]}>{dateDisplay}</Text>
                      {hasRecord ? (
                        <Text style={[styles.historyDayCount, FONT]}>
                          {takenMeds.length} / {activeMedList.length}
                        </Text>
                      ) : (
                        <Text style={[styles.historyNoRecordBadge, FONT]}>無紀錄</Text>
                      )}
                    </View>
                    {hasRecord ? (
                      takenMeds.map((med, idx) => {
                        const isLast = idx === takenMeds.length - 1;
                        return (
                          <View
                            key={med}
                            style={[styles.historyMedRow, isLast && styles.historyMedRowLast, styles.rowChecked]}
                          >
                            <Text style={[styles.rowIndex, FONT]}>{idx + 1}</Text>
                            <Text style={[styles.medName, FONT, (med === '嗎啡貼布' || med === '鎮頑癲') && styles.historyMedNameCheckedBold]}>
                              {med}
                            </Text>
                            <View style={[styles.statusBox, styles.statusBoxChecked]}>
                              <Text style={[styles.statusCheck, FONT]}>服</Text>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.historyNoRecordRow}>
                        <Text style={[styles.historyNoRecordText, FONT]}>本日無用藥紀錄</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },

  // Date label row
  dateLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 2,
  },
  dateLabel: { fontSize: 14, color: colors.textPrimary, letterSpacing: 1 },

  // Progress card
  progressCard: {
    backgroundColor: colors.bgCard, borderRadius: 4,
    borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12,
  },
  cardTopRule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLine: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.3 },
  cardDiamond: {
    width: 5, height: 5, backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }], opacity: 0.5,
  },
  progressHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  progressTitle: { fontSize: 11, color: colors.textLabel, letterSpacing: 3 },
  countWrap: { flexDirection: 'row', alignItems: 'baseline' },
  countNum: { fontSize: 26, color: colors.cinnabar, fontWeight: 'bold', lineHeight: 30 },
  countSlash: { fontSize: 14, color: colors.textMuted },
  countTotal: { fontSize: 15, color: colors.textMuted },
  trackBg: {
    height: 6, backgroundColor: colors.borderFaint,
    borderRadius: 1, overflow: 'hidden', position: 'relative',
  },
  trackTick: {
    position: 'absolute', top: 0, bottom: 0,
    width: 1, backgroundColor: colors.bg, zIndex: 1,
  },
  trackFill: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    backgroundColor: colors.cinnabar, opacity: 0.8, zIndex: 0,
  },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerLine: { flex: 1, height: 1, backgroundColor: colors.textRelief, opacity: 0.3 },
  bannerText: { fontSize: 11, color: colors.textRelief, letterSpacing: 2 },

  // Checklist
  listCard: {
    backgroundColor: colors.bgCard, borderRadius: 4,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: colors.bgSection,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listHeaderText: { fontSize: 10, color: colors.textMuted, letterSpacing: 3 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
    backgroundColor: colors.bgCard, gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowChecked: { backgroundColor: '#f5f0e8' },
  rowIndex: {
    fontSize: 10, color: colors.border,
    width: 16, textAlign: 'center', letterSpacing: 0.5, flexShrink: 0,
  },
  medName: { fontSize: 15, color: colors.textPrimary, flex: 1, letterSpacing: 0.5 },
  medNameChecked: { color: colors.textMuted, textDecorationLine: 'line-through' },
  statusBox: {
    width: 28, height: 28, borderRadius: 3, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statusBoxChecked: { backgroundColor: colors.cinnabar, borderColor: colors.cinnabar },
  statusCheck: { color: colors.white, fontSize: 12, lineHeight: 16 },
  statusEmpty: {
    width: 8, height: 8, borderRadius: 1,
    borderWidth: 1, borderColor: colors.border, opacity: 0.4,
  },

  // ── History button ────────────────────────────────────────────────────────
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 2, borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(154,120,56,0.07)',
  },
  historyBtnIconWrap: {
    width: 13, height: 13, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  historyBtnClockRing: {
    position: 'absolute',
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1.2, borderColor: colors.gold, opacity: 0.85,
  },
  historyBtnClockH: {
    position: 'absolute',
    width: 1.5, height: 4,
    backgroundColor: colors.gold, opacity: 0.85,
    top: 3, left: 5.5,
  },
  historyBtnClockM: {
    position: 'absolute',
    width: 3.5, height: 1.5,
    backgroundColor: colors.gold, opacity: 0.85,
    top: 5.5, left: 6,
  },
  historyBtnLabel: {
    fontSize: 11, color: colors.gold, letterSpacing: 1,
  },

  // ── History Modal ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(30,20,16,0.42)',
  },
  modalSheet: {
    backgroundColor: colors.bgCard,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    height: SCREEN_H * 0.76,
  },
  modalHandle: {
    width: 36, height: 3, borderRadius: 2,
    backgroundColor: colors.gold, opacity: 0.45,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 2,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  modalRuleLine: {
    flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.25,
  },
  modalDiamond: {
    width: 5, height: 5, backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }], opacity: 0.45,
  },
  modalTitleText: {
    fontSize: 13, color: colors.textPrimary, letterSpacing: 3,
  },
  modalCloseBtn: {
    position: 'absolute', top: 34, right: 16,
    paddingVertical: 3, paddingHorizontal: 9,
    borderRadius: 2, borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.bgSection,
  },
  modalCloseTxt: {
    fontSize: 10, color: colors.textMuted, letterSpacing: 1.5,
  },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 14, gap: 10, paddingBottom: 24 },

  // ── History mode toggle (依日期 / 依藥物) ──────────────────────────────────
  historyModeToggleRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  historyModeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 3, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgSection,
  },
  historyModeBtnActive: {
    borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.07)',
  },
  historyModeBtnText: {
    fontSize: 12, color: colors.textMuted, letterSpacing: 2,
  },
  historyModeBtnTextActive: {
    color: colors.cinnabar,
  },

  // ── History grouped by med (依藥物) ────────────────────────────────────────
  historyMedGroupCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  historyMedGroupHeaderRow: {
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.bgSection,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  historyMedGroupTitle: {
    fontSize: 14, color: colors.textPrimary, letterSpacing: 1, fontWeight: 'bold',
  },
  historyMedDayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
    backgroundColor: colors.bgCard,
  },
  historyMedDayLabel: {
    fontSize: 13, color: colors.textPrimary, letterSpacing: 1,
  },

  // History day cards
  historyDayCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  historyDayHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.bgSection,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  historyDayDateText: {
    fontSize: 13, color: colors.textPrimary, letterSpacing: 0.8, fontWeight: 'bold',
  },
  historyDayCount: {
    fontSize: 13, color: colors.cinnabar, letterSpacing: 0.5, fontWeight: 'bold',
  },
  historyNoRecordBadge: {
    fontSize: 11, color: colors.textMuted, letterSpacing: 1,
  },
  historyMedNameCheckedBold: { fontWeight: 'bold' },
  historyMedRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
    backgroundColor: colors.bgCard, gap: 12,
  },
  historyMedRowLast: { borderBottomWidth: 0 },
  historyNoRecordRow: {
    paddingVertical: 14, alignItems: 'center',
  },
  historyNoRecordText: {
    fontSize: 11, color: colors.textMuted, letterSpacing: 2,
  },
});
