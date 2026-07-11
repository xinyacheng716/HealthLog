import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppPicker from '../components/AppPicker';
import DateGroupHeader from '../components/DateGroupHeader';
import LogCard from '../components/LogCard';
import MedicalHistoryView from '../components/MedicalHistoryView';
import { colors } from '../constants/colors';
import { LogsContext, MedicalHistoryContext } from '../context';
import { useViewer } from '../context/ViewerContext';
import { fetchOwnerLogs, fetchOwnerMedicalHistory } from '../lib/viewerData';
import { useFocusEffect } from '@react-navigation/native';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

function formatMedicalHistoryText(medicalHistory) {
  if (!medicalHistory || medicalHistory.length === 0) return '【病歷紀錄】\n\n（尚無記錄）';
  const lines = ['【病歷紀錄】'];
  for (const group of medicalHistory) {
    lines.push('');
    lines.push(`${group.year}年`);
    const sorted = [...group.records].sort((a, b) => a.month - b.month);
    for (const r of sorted) {
      lines.push(`• ${r.month}月：${r.text}`);
    }
  }
  return lines.join('\n');
}

const TABS = [
  { key: 'symptom', label: '症狀紀錄' },
  { key: 'medical', label: '病　　歷' },
];

function dateLabel(timeStr) {
  return timeStr?.slice(0, 10) || '';
}

export default function HistoryScreen() {
  const { logs, updateLog, deleteLog } = useContext(LogsContext);
  const { medicalHistory } = useContext(MedicalHistoryContext);
  const { isViewerMode, activeOwner } = useViewer();
  const [viewerLogs, setViewerLogs] = useState([]);
  const [viewerMedHistory, setViewerMedHistory] = useState([]);
  const [filterSymptom, setFilterSymptom] = useState('');
  const [historyOnly, setHistoryOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('symptom');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isViewerMode || !activeOwner) return;
    fetchOwnerLogs(activeOwner.id).then(setViewerLogs);
    fetchOwnerMedicalHistory(activeOwner.id).then(setViewerMedHistory);
  }, [isViewerMode, activeOwner?.id]);

  // Re-fetch whenever this tab comes into focus (picks up owner's latest data)
  useFocusEffect(useCallback(() => {
    if (!isViewerMode || !activeOwner) return;
    fetchOwnerLogs(activeOwner.id).then(setViewerLogs);
    fetchOwnerMedicalHistory(activeOwner.id).then(setViewerMedHistory);
  }, [isViewerMode, activeOwner?.id]));

  const displayLogs = isViewerMode ? viewerLogs : logs;
  const displayMedHistory = isViewerMode ? viewerMedHistory : medicalHistory;

  async function handleShareMedical() {
    const text = formatMedicalHistoryText(displayMedHistory);
    try {
      await Share.share({ message: text });
    } catch (_) {}
  }

  return (
    <View style={styles.container}>
      {/* 檢視者模式 banner */}
      {isViewerMode && (
        <View style={styles.viewerBanner}>
          <View style={styles.viewerBannerDot} />
          <Text style={[styles.viewerBannerText, FONT]}>
            目前查看：{activeOwner?.full_name} 的紀錄
          </Text>
        </View>
      )}
      {/* 分頁切換：症狀紀錄 / 病歷 */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tab}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, FONT, active && styles.tabTextActive]}>
                {t.label}
              </Text>
              <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
            </TouchableOpacity>
          );
        })}
        {activeTab === 'medical' && (
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShareMedical}
            activeOpacity={0.7}
          >
            <Text style={[styles.shareBtnText, FONT]}>分享</Text>
            <View style={styles.tabUnderline} />
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'medical' ? (
        <MedicalHistoryView externalData={isViewerMode ? displayMedHistory : undefined} readOnly={isViewerMode} />
      ) : (
        <SymptomLogTab
          logs={displayLogs}
          updateLog={isViewerMode ? undefined : updateLog}
          deleteLog={isViewerMode ? undefined : deleteLog}
          readOnly={isViewerMode}
          filterSymptom={filterSymptom}
          setFilterSymptom={setFilterSymptom}
          historyOnly={historyOnly}
          setHistoryOnly={setHistoryOnly}
          insets={insets}
        />
      )}
    </View>
  );
}

// 醫生診斷或醫生確認用藥任一有值即算「歷史紀錄」
function isHistoryLog(l) {
  return Boolean(l.doctorDiagnosis?.trim()) || Boolean(l.doctorMed?.trim());
}

function SymptomLogTab({
  logs, updateLog, deleteLog, readOnly,
  filterSymptom, setFilterSymptom,
  historyOnly, setHistoryOnly,
  insets,
}) {
  // Support both old { symptom: string } and new { symptoms: string[] }
  function logSymptoms(l) {
    if (Array.isArray(l.symptoms) && l.symptoms.length > 0) return l.symptoms;
    return l.symptom ? [l.symptom] : [];
  }

  // 症狀篩選下拉列出全部曾出現過的症狀（含已解決／未解決），方便查詢過去相同症狀的解方
  const usedSymptoms = [...new Set(logs.flatMap(logSymptoms))];

  // 已解決（有醫生診斷/用藥）的紀錄預設隱藏，避免佔版面；
  // 只要選了症狀篩選、或開啟「歷史」開關，任一條件成立就會顯示已解決紀錄
  const filtered = logs
    .filter((l) => !filterSymptom || logSymptoms(l).includes(filterSymptom))
    .filter((l) => {
      if (historyOnly) return isHistoryLog(l);
      if (filterSymptom) return true;
      return !isHistoryLog(l);
    })
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const items = [];
  const grouped = {};
  for (const log of filtered) {
    const d = dateLabel(log.startTime);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(log);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  for (const date of sortedDates) {
    items.push({ type: 'header', date, key: `hdr-${date}` });
    for (const log of grouped[date]) {
      items.push({ type: 'card', log, key: `card-${log.id}` });
    }
  }

  return (
    <View style={styles.tabContent}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <View style={styles.filterLabelWrap}>
          {/* Small cinnabar indicator */}
          <View style={styles.filterDot} />
          <Text style={[styles.filterLabelText, FONT]}>篩選症狀</Text>
        </View>
        <View style={styles.filterPicker}>
          <AppPicker
            items={usedSymptoms}
            value={filterSymptom}
            onChange={setFilterSymptom}
            placeholder="── 全部症狀 ──"
            nullable
          />
        </View>
        <TouchableOpacity
          style={[styles.historyToggle, historyOnly && styles.historyToggleActive]}
          onPress={() => setHistoryOnly((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.historyToggleIconWrap}>
            <View style={[styles.historyToggleClockRing, historyOnly && styles.historyToggleClockActiveBorder]} />
            <View style={[styles.historyToggleClockH, historyOnly && styles.historyToggleClockActiveFill]} />
            <View style={[styles.historyToggleClockM, historyOnly && styles.historyToggleClockActiveFill]} />
          </View>
          <Text style={[styles.historyToggleText, FONT, historyOnly && styles.historyToggleTextActive]}>
            歷史
          </Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          {/* Decorative empty state */}
          <View style={styles.emptyFrame}>
            <View style={styles.emptyFrameCornerTL} />
            <View style={styles.emptyFrameCornerBR} />
            <Text style={[styles.emptyChar, FONT]}>無</Text>
          </View>
          <Text style={[styles.emptyText, FONT]}>尚無符合紀錄</Text>
          {(filterSymptom || historyOnly) ? (
            <Text style={[styles.emptyHint, FONT]}>嘗試清除篩選條件</Text>
          ) : (
            <Text style={[styles.emptyHint, FONT]}>在「記錄症狀」頁面新增第一筆記錄</Text>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {items.map((item) => {
            if (item.type === 'header') {
              return <DateGroupHeader key={item.key} date={item.date} />;
            }
            return (
              <View key={item.key} style={styles.cardWrap}>
                <LogCard log={item.log} onUpdate={updateLog} onDelete={deleteLog} readOnly={readOnly} />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabContent: { flex: 1 },

  viewerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: 'rgba(139,48,32,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,48,32,0.18)',
  },
  viewerBannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cinnabar,
    opacity: 0.85,
  },
  viewerBannerText: {
    fontSize: 12,
    color: colors.cinnabar,
    letterSpacing: 1.5,
    opacity: 0.9,
  },

  // ── 分頁切換 ────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 9,
  },
  shareBtn: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 9,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(154,120,56,0.25)',
  },
  shareBtnText: {
    fontSize: 13,
    color: colors.goldLight,
    letterSpacing: 2,
  },
  tabText: {
    fontSize: 14,
    color: colors.goldFaint,
    letterSpacing: 3,
    opacity: 0.6,
  },
  tabTextActive: {
    color: colors.white,
    opacity: 1,
  },
  tabUnderline: {
    marginTop: 7,
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: colors.cinnabarMid,
  },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.bgSection,
    gap: 10,
  },
  filterLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: colors.cinnabar,
    opacity: 0.7,
  },
  filterLabelText: {
    fontSize: 11,
    color: colors.textLabel,
    letterSpacing: 2,
  },
  filterPicker: { flex: 1 },

  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(154,120,56,0.07)',
    flexShrink: 0,
  },
  historyToggleActive: {
    borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.07)',
  },
  historyToggleIconWrap: {
    width: 13,
    height: 13,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyToggleClockRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: colors.gold,
    opacity: 0.85,
  },
  historyToggleClockH: {
    position: 'absolute',
    width: 1.5,
    height: 4,
    backgroundColor: colors.gold,
    opacity: 0.85,
    top: 3,
    left: 5.5,
  },
  historyToggleClockM: {
    position: 'absolute',
    width: 3.5,
    height: 1.5,
    backgroundColor: colors.gold,
    opacity: 0.85,
    top: 5.5,
    left: 6,
  },
  historyToggleClockActiveBorder: {
    borderColor: colors.cinnabar,
  },
  historyToggleClockActiveFill: {
    backgroundColor: colors.cinnabar,
  },
  historyToggleText: {
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 1,
  },
  historyToggleTextActive: {
    color: colors.cinnabar,
  },

  list: { padding: 16 },
  cardWrap: { marginBottom: 10 },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  emptyFrame: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: colors.bgCard,
  },
  emptyFrameCornerTL: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 10,
    height: 10,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: colors.gold,
    opacity: 0.5,
  },
  emptyFrameCornerBR: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: colors.gold,
    opacity: 0.5,
  },
  emptyChar: {
    fontSize: 28,
    color: colors.border,
    letterSpacing: 2,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 2,
  },
  emptyHint: {
    color: colors.btnDisabled,
    fontSize: 11,
    letterSpacing: 1,
  },
});
