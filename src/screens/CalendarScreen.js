import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, KeyboardAvoidingView, AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, cardShadow, TYPE_COLORS } from '../constants/colors';
import { loadAppointments, saveAppointments, saveAppointmentsLocalOnly } from '../storage';
import { deleteAppointmentFromCloud } from '../lib/cloudSync';
import { useViewer } from '../context/ViewerContext';
import { useAuth } from '../context/AuthContext';
import { fetchOwnerAppointments } from '../lib/viewerData';
import CalendarView from '../components/CalendarView';
import AppointmentSection from '../components/AppointmentSection';
import ConsultationMemo from '../components/ConsultationMemo';
import AppPicker from '../components/AppPicker';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function apptDateKey(appt) {
  return appt.dateTime.split(' ')[0].replace(/\//g, '-');
}

// mode: 'schedule' | 'calendar'
// isDrilled: only relevant in calendar mode

export default function CalendarScreen() {
  const { isViewerMode, activeOwner } = useViewer();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const today = todayKey();

  // 預設開啟「所有行程」而不是「新增行程」——大多數時候是要查看既有行程，
  // 不是要新增（爸爸反映一直找不到「所有行程」在哪）。
  const [mode, setMode] = useState('schedule');
  const [calendarDate, setCalendarDate] = useState(today);
  const [isDrilled, setIsDrilled] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);

  const activeDate = mode === 'calendar'
    ? (isDrilled ? calendarDate : null)
    : today;

  // ── Own data state ───────────────────────────────────────────────────────
  const [appointments, setAppointments] = useState([]);

  // ── Viewer data state ────────────────────────────────────────────────────
  const [viewerAppointments, setViewerAppointments] = useState([]);

  useEffect(() => {
    loadAppointments().then(setAppointments);
  }, []);

  // Owner 模式：重新從雲端拉取所有行程，直接更新畫面 state（不是只寫本機、
  // 等下次掛載被動撿到）。AppState 前景轉換、畫面 focus 兩個觸發來源共用
  // 這支函式，比照 daily med（Build 31/32）的做法。
  async function refreshAppointmentsFromCloud() {
    const ownerId = session?.user?.id;
    if (!ownerId) return;
    try {
      const cloudAppointments = await fetchOwnerAppointments(ownerId);
      await saveAppointmentsLocalOnly(cloudAppointments);
      // 已知風險（這次先不處理）：如果使用者剛新增一筆行程、還沒推上雲端
      // 成功，這時剛好觸發這支函式，會用還沒包含那筆新行程的雲端舊清單
      // 覆蓋掉本機剛新增的那筆，導致畫面上短暫消失。
      setAppointments(cloudAppointments);
    } catch (e) {
      console.warn('[CalendarScreen] 重新拉取行程失敗，保留本機狀態:', e.message);
    }
  }

  // Owner 模式：畫面每次取得 focus（含第一次掛載／冷啟動）都重新拉取一次。
  useFocusEffect(useCallback(() => {
    if (isViewerMode) return;
    refreshAppointmentsFromCloud();
  }, [isViewerMode, session?.user?.id]));

  // Owner 模式：App 從背景切回前景時，同樣重新拉取一次，避免多裝置間
  // 行程資料不同步。
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (isViewerMode) return undefined;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const cameToForeground = appStateRef.current !== 'active' && nextAppState === 'active';
      appStateRef.current = nextAppState;
      if (!cameToForeground) return;
      refreshAppointmentsFromCloud();
    });

    return () => subscription.remove();
  }, [isViewerMode, session?.user?.id]);

  // Load viewer data when entering viewer mode or switching owner
  useEffect(() => {
    if (!isViewerMode || !activeOwner) {
      setViewerAppointments([]);
      return;
    }
    fetchOwnerAppointments(activeOwner.id)
      .then(setViewerAppointments)
      .catch((e) => {
        console.warn('[CalendarScreen] 讀取檢視者行程失敗，保留原有畫面狀態:', e.message);
      });
  }, [isViewerMode, activeOwner?.id]);

  // ── Actions ──────────────────────────────────────────────────────────────
  function addAppointment(appt) {
    setAppointments((prev) => {
      const next = [...prev, appt];
      saveAppointments(next, appt);
      return next;
    });
  }

  function updateAppointment(id, patch) {
    setAppointments((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
      const updated = next.find((a) => a.id === id);
      saveAppointments(next, updated);
      return next;
    });
  }

  function deleteAppointment(id) {
    setAppointments((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAppointments(next);
      deleteAppointmentFromCloud(id);
      return next;
    });
  }

  function switchMode(m) {
    setMode(m);
    setIsDrilled(false);
    setSelectedAppt(null);
    setFilterType('');
    setFilterHospital('');
    setShowPast(false);
  }

  function drillInto(date) {
    setCalendarDate(date);
    setIsDrilled(true);
  }

  function drillBack() {
    setIsDrilled(false);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const allAppts = isViewerMode ? viewerAppointments : appointments;
  const displayAppts = activeDate
    ? allAppts.filter((a) => apptDateKey(a) === activeDate)
    : [];
  const appointmentDates = new Set(allAppts.map(apptDateKey));

  // ── 2-tab mode bar ────────────────────────────────────────────────────────
  const TABS_DEF = [
    { key: 'calendar', label: '新增行程' },
    { key: 'schedule', label: '所有行程' },
  ];

  const ModeBar = (
    <>
      <View style={styles.modeBar}>
      {TABS_DEF.map((t, i) => (
        <React.Fragment key={t.key}>
          {i > 0 && <View style={styles.modeDivider} />}
          <TouchableOpacity
            style={[styles.modeTab, mode === t.key && styles.modeTabActive]}
            onPress={() => switchMode(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeTabText, FONT, mode === t.key && styles.modeTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
      </View>
    </>
  );

  // ════════════════════════════════════════════════════════════════════════
  //  CALENDAR MODE, NOT DRILLED
  // ════════════════════════════════════════════════════════════════════════
  if (mode === 'calendar' && !isDrilled) {
    return (
      <View style={styles.container}>
        {ModeBar}
        <ScrollView
          style={styles.calendarScroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        >
          <CalendarView
            selectedDate={calendarDate}
            today={today}
            appointmentDates={appointmentDates}
            onSelectDate={drillInto}
          />
          <View style={styles.calendarHint}>
            <View style={[styles.hintDot, styles.hintDotGold]} />
            <Text style={[styles.hintText, FONT]}>醫院行程</Text>
            <Text style={[styles.hintSep, FONT]}>  ·  </Text>
            <Text style={[styles.hintAction, FONT]}>點選日期查看詳情</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CALENDAR MODE, DRILLED
  // ════════════════════════════════════════════════════════════════════════
  if (mode === 'calendar' && isDrilled) {
    const isViewingToday = calendarDate === today;
    const displayDateStr = calendarDate.replace(/-(\d+)-(\d+)$/, '年$1月$2日');
    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={drillBack} activeOpacity={0.7}>
            <View style={styles.backChevron} />
            <Text style={[styles.backText, FONT]}>返回</Text>
          </TouchableOpacity>
          <Text style={[styles.detailDate, FONT]}>{displayDateStr}</Text>
          {isViewingToday ? (
            <View style={styles.detailTodayBadge}>
              <Text style={[styles.detailTodayText, FONT]}>今日</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.detailTodayBtn}
              onPress={() => drillInto(today)}
            >
              <Text style={[styles.detailTodayBtnText, FONT]}>今日</Text>
            </TouchableOpacity>
          )}
        </View>

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
            <AppointmentSection
              appointments={displayAppts}
              onAdd={isViewerMode ? undefined : addAppointment}
              onUpdate={isViewerMode ? undefined : updateAppointment}
              onDelete={isViewerMode ? undefined : deleteAppointment}
              defaultDate={activeDate}
              autoOpen={!isViewerMode}
              timeOnly
              readOnly={isViewerMode}
            />
            <ConsultationMemo
              date={activeDate}
              ownerId={isViewerMode ? activeOwner?.id : null}
              readOnly={isViewerMode}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ALL APPOINTMENTS — DETAIL VIEW (tapped card)
  // ════════════════════════════════════════════════════════════════════════
  if (mode === 'schedule' && selectedAppt) {
    const typeColor = TYPE_COLORS[selectedAppt.type] ?? colors.textMuted;
    const dateKey = apptDateKey(selectedAppt);
    const dateDisplay = dateKey.replace(/-(\d+)-(\d+)$/, '年$1月$2日');
    return (
      <View style={styles.container}>
        {ModeBar}
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedAppt(null)} activeOpacity={0.7}>
            <View style={styles.backChevron} />
            <Text style={[styles.backText, FONT]}>返回</Text>
          </TouchableOpacity>
          <Text style={[styles.detailDate, FONT]}>{dateDisplay}</Text>
          <View style={[styles.detailTodayBadge, { borderColor: typeColor, backgroundColor: typeColor }]}>
            <Text style={[styles.detailTodayText, FONT, { color: colors.white }]}>
              {selectedAppt.type || '行程'}
            </Text>
          </View>
        </View>
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
            <AppointmentSection
              appointments={[selectedAppt]}
              onUpdate={(id, data) => {
                updateAppointment(id, data);
                setSelectedAppt((prev) => (prev ? { ...prev, ...data } : prev));
              }}
              onDelete={(id) => {
                deleteAppointment(id);
                setSelectedAppt(null);
              }}
              defaultDate={dateKey}
              readOnly={isViewerMode}
              showAddButton={false}
              timeOnly={false}
            />
            <ConsultationMemo
              date={dateKey}
              ownerId={isViewerMode ? activeOwner?.id : null}
              readOnly={isViewerMode}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ALL APPOINTMENTS TAB (所有行程，含 filter)
  // ════════════════════════════════════════════════════════════════════════
  const existingTypes = [...new Set(allAppts.map((a) => a.type).filter(Boolean))];
  const existingHospitals = [...new Set(allAppts.map((a) => a.hospital).filter(Boolean))];

  const filtered = allAppts.filter((a) => {
    const typeOk = !filterType || a.type === filterType;
    const hospOk = !filterHospital || a.hospital === filterHospital;
    const dateOk = showPast || apptDateKey(a) >= today;
    return typeOk && hospOk && dateOk;
  });

  const allSorted = [...filtered].sort((a, b) =>
    showPast
      ? b.dateTime.localeCompare(a.dateTime)
      : a.dateTime.localeCompare(b.dateTime),
  );
  const groups = [];
  for (const appt of allSorted) {
    const dk = apptDateKey(appt);
    const g = groups.find((x) => x.dateKey === dk);
    if (g) g.appts.push(appt);
    else groups.push({ dateKey: dk, appts: [appt] });
  }

  return (
    <View style={styles.container}>
      {ModeBar}

      {/* Filter row */}
      {allAppts.length > 0 && (
        <View style={styles.filterPickerRow}>
          <View style={styles.filterPickerCol}>
            <AppPicker
              items={existingTypes}
              value={filterType}
              onChange={setFilterType}
              placeholder="全部類型"
              nullable
            />
          </View>
          <View style={styles.filterPickerCol}>
            <AppPicker
              items={existingHospitals}
              value={filterHospital}
              onChange={setFilterHospital}
              placeholder="全部醫院"
              nullable
            />
          </View>
          <TouchableOpacity
            style={[styles.pastToggle, showPast && styles.pastToggleActive]}
            onPress={() => setShowPast((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.pastToggleDot, showPast && styles.pastToggleDotActive]} />
            <Text style={[styles.pastToggleText, FONT, showPast && styles.pastToggleTextActive]}>
              歷史
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      >
        {groups.length === 0 ? (
          <View style={styles.allEmpty}>
            <Text style={[styles.allEmptyText, FONT]}>
              {allAppts.length === 0
                ? '尚無任何行程記錄'
                : !showPast && allAppts.every((a) => apptDateKey(a) < today)
                  ? '目前無未來行程'
                  : '無符合篩選條件的行程'}
            </Text>
            {allAppts.length > 0 && !showPast && allAppts.every((a) => apptDateKey(a) < today) && (
              <Text style={[styles.allEmptyHint, FONT]}>點選「歷史」可查看過去紀錄</Text>
            )}
          </View>
        ) : groups.map(({ dateKey, appts: groupAppts }) => {
          const dateDisplay = dateKey.replace(/-(\d+)-(\d+)$/, '年$1月$2日');
          const isToday = dateKey === today;
          return (
            <View key={dateKey} style={styles.allGroup}>
              <View style={styles.allDateRow}>
                <Text style={[styles.allDateText, FONT]}>
                  {isToday ? `${dateDisplay}（今日）` : dateDisplay}
                </Text>
              </View>
              {groupAppts.map((appt) => {
                const typeColor = TYPE_COLORS[appt.type] ?? colors.textMuted;
                const timeStr = appt.dateTime.split(' ')[1] ?? '';
                return (
                  <TouchableOpacity
                    key={appt.id}
                    style={[styles.allApptCard, cardShadow]}
                    onPress={() => setSelectedAppt(appt)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.allTypeStripe, { backgroundColor: typeColor }]} />
                    <View style={styles.allApptBody}>
                      <View style={styles.allApptTop}>
                        {timeStr ? (
                          <Text style={[styles.allTimeText, FONT]}>{timeStr}</Text>
                        ) : null}
                        {appt.type ? (
                          <View style={[styles.allTypeBadge, { backgroundColor: typeColor }]}>
                            <Text style={[styles.allTypeBadgeText, FONT, { color: colors.white }]}>
                              {appt.type}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={[styles.allHospitalText, FONT]} numberOfLines={1}>
                          {appt.hospital}
                        </Text>
                        <View style={styles.allApptChevron}>
                          <View style={styles.allApptChevronIcon} />
                        </View>
                      </View>
                      {appt.doctor ? (
                        <Text style={[styles.allDetailText, FONT]}>醫師：{appt.doctor}</Text>
                      ) : null}
                      {appt.note ? (
                        <Text style={[styles.allDetailText, FONT]}>{appt.note}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },

  // 2-tab mode bar
  modeBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgSection,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modeTab: {
    flex: 1, paddingVertical: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  modeTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.cinnabar,
    backgroundColor: colors.bgCard,
  },
  modeTabText: { fontSize: 12, color: colors.textMuted, letterSpacing: 1.5, fontWeight: '700' },
  modeTabTextActive: { color: colors.cinnabar },
  modeDivider: { width: 1, backgroundColor: colors.borderLight, marginVertical: 8 },

  // Calendar (not drilled)
  calendarScroll: { flex: 1, backgroundColor: colors.bg },
  calendarHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  hintDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.cinnabar, opacity: 0.75,
  },
  hintDotGold: { backgroundColor: colors.gold },
  hintText: { fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },
  hintSep: { fontSize: 11, color: colors.borderLight },
  hintAction: { fontSize: 11, color: colors.textMuted, letterSpacing: 0.5, opacity: 0.7 },

  // Detail header (calendar drilled / schedule detail)
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.bgSection,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingRight: 8,
    flexShrink: 0,
  },
  backChevron: {
    width: 8, height: 8,
    borderLeftWidth: 1.5, borderBottomWidth: 1.5,
    borderColor: colors.cinnabar,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  backText: { fontSize: 13, color: colors.cinnabar, letterSpacing: 1, fontWeight: '700' },
  detailDate: {
    flex: 1, fontSize: 15,
    color: colors.textPrimary, letterSpacing: 1,
    textAlign: 'center',
  },
  detailTodayBadge: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 2, borderWidth: 1,
    borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.07)',
    flexShrink: 0,
  },
  detailTodayText: { fontSize: 10, color: colors.cinnabar, letterSpacing: 2 },
  detailTodayBtn: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 2, borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(154,120,56,0.06)',
    flexShrink: 0,
  },
  detailTodayBtnText: { fontSize: 10, color: colors.gold, letterSpacing: 2 },

  // Filter pickers
  filterPickerRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.bgSection,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterPickerCol: { flex: 1 },
  pastToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 13,
    borderRadius: 3, borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    flexShrink: 0,
  },
  pastToggleActive: {
    borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.07)',
  },
  pastToggleDot: {
    width: 7, height: 7, borderRadius: 1,
    borderWidth: 1.5, borderColor: colors.btnDisabled,
  },
  pastToggleDotActive: {
    backgroundColor: colors.cinnabar,
    borderColor: colors.cinnabar,
  },
  pastToggleText: {
    fontSize: 12, color: colors.textMuted, letterSpacing: 1.5,
  },
  pastToggleTextActive: {
    color: colors.cinnabar,
  },

  // All-appointments list
  allEmpty: {
    paddingVertical: 48, alignItems: 'center', gap: 6,
  },
  allEmptyText: { fontSize: 13, color: colors.textMuted, letterSpacing: 1 },
  allEmptyHint: { fontSize: 11, color: colors.btnDisabled, letterSpacing: 1 },
  allGroup: { gap: 6, marginBottom: 4 },
  allDateRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 2, paddingHorizontal: 2,
  },
  allDateText: { fontSize: 17, color: colors.textPrimary, letterSpacing: 0.5, fontWeight: '700' },
  allApptCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  allTypeStripe: { width: 4, flexShrink: 0 },
  allApptBody: { flex: 1, padding: 12, gap: 4 },
  allApptTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allTimeText: {
    fontSize: 14, color: colors.textPrimary, letterSpacing: 1,
    backgroundColor: colors.bgSection,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2,
    flexShrink: 0,
  },
  allTypeBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 2, flexShrink: 0,
  },
  allTypeBadgeText: { fontSize: 13, letterSpacing: 1 },
  allHospitalText: {
    flex: 1, fontSize: 15, color: colors.textPrimary, letterSpacing: 0.5,
  },
  allDetailText: {
    fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, lineHeight: 18,
  },
  allApptChevron: { flex: 1, alignItems: 'flex-end' },
  allApptChevronIcon: {
    width: 7, height: 7,
    borderRightWidth: 1.5, borderTopWidth: 1.5,
    borderColor: colors.borderLight,
    transform: [{ rotate: '45deg' }],
  },
});
