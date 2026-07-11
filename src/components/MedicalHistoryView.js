import React, { useContext, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Platform, Keyboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppPicker from './AppPicker';
import { colors, cardShadow } from '../constants/colors';
import { MedicalHistoryContext } from '../context';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

export default function MedicalHistoryView({ externalData, readOnly = false }) {
  const ctx = useContext(MedicalHistoryContext);
  const medicalHistory = externalData ?? ctx.medicalHistory;
  const { addMedYear, addMedRecord, updateMedRecord, deleteMedRecord, deleteMedYear } = ctx;
  const insets = useSafeAreaInsets();

  const [collapsed, setCollapsed] = useState({});
  const [newYear, setNewYear] = useState('');
  const [drafts, setDrafts] = useState({});
  const [editDraft, setEditDraft] = useState(null);
  // 哪一個年份的新增表單正在展開（null = 全收起）
  const [addingYear, setAddingYear] = useState(null);

  function toggle(year) {
    setCollapsed((prev) => ({ ...prev, [year]: !prev[year] }));
  }

  function getDraft(year) {
    return drafts[year] || { month: '', text: '' };
  }

  function setDraft(year, patch) {
    setDrafts((prev) => ({ ...prev, [year]: { ...getDraft(year), ...patch } }));
  }

  function handleAddYear() {
    const y = parseInt(newYear, 10);
    if (!y || y < 1900 || y > 2200) {
      Alert.alert('年份格式有誤', '請輸入 1900–2200 之間的西元年份');
      return;
    }
    if (medicalHistory.some((g) => g.year === y)) {
      Alert.alert('年份已存在', `${y} 年已在清單中`);
      return;
    }
    addMedYear(y);
    setNewYear('');
    Keyboard.dismiss();
  }

  function handleAddRecord(year) {
    const draft = getDraft(year);
    const month = parseInt(draft.month, 10);
    const text = draft.text.trim();
    if (!month) { Alert.alert('請選擇月份'); return; }
    if (!text) { Alert.alert('請輸入記錄內容'); return; }
    addMedRecord(year, month, text);
    setDraft(year, { month: '', text: '' });
    setAddingYear(null);
    Keyboard.dismiss();
  }

  function cancelAdd(year) {
    setDraft(year, { month: '', text: '' });
    setAddingYear(null);
    Keyboard.dismiss();
  }

  function startEdit(year, record) {
    setEditDraft({ year, id: record.id, month: String(record.month), text: record.text });
  }

  function cancelEdit() {
    setEditDraft(null);
    Keyboard.dismiss();
  }

  function handleSaveEdit() {
    if (!editDraft) return;
    const month = parseInt(editDraft.month, 10);
    const text = editDraft.text.trim();
    if (!month) { Alert.alert('請選擇月份'); return; }
    if (!text) { Alert.alert('請輸入記錄內容'); return; }
    updateMedRecord(editDraft.year, editDraft.id, { month, text });
    setEditDraft(null);
    Keyboard.dismiss();
  }

  function confirmDeleteRecord(year, id) {
    Alert.alert('刪除這筆記錄？', '刪除後無法復原', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除', style: 'destructive', onPress: () => {
          if (editDraft?.id === id) setEditDraft(null);
          deleteMedRecord(year, id);
        },
      },
    ]);
  }

  function confirmDeleteYear(year, count) {
    Alert.alert(
      `刪除 ${year} 年？`,
      count > 0 ? `此年份底下的 ${count} 筆記錄也會一併刪除` : '將移除這個年份',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除', style: 'destructive', onPress: () => {
            if (editDraft?.year === year) setEditDraft(null);
            deleteMedYear(year);
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      {/* 新增年份 — hidden in readOnly */}
      {!readOnly && <View style={styles.newYearBar}>
        <View style={styles.newYearLabelWrap}>
          <View style={styles.stamp}><View style={styles.stampInner} /></View>
          <Text style={[styles.newYearLabel, FONT]}>新增年份</Text>
        </View>
        <TextInput
          style={[styles.yearInput, FONT]}
          placeholder="西元年"
          placeholderTextColor={colors.textMuted}
          value={newYear}
          onChangeText={setNewYear}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="done"
          onSubmitEditing={handleAddYear}
        />
        <TouchableOpacity style={styles.addYearBtn} onPress={handleAddYear} activeOpacity={0.75}>
          <Text style={[styles.addYearBtnText, FONT]}>新　增</Text>
        </TouchableOpacity>
      </View>}

      {medicalHistory.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, FONT]}>尚無病歷記錄</Text>
          {!readOnly && <Text style={[styles.emptyHint, FONT]}>於上方新增年份後即可填寫</Text>}
        </View>
      ) : (
        medicalHistory.map((group) => {
          const isCollapsed = !!collapsed[group.year];
          const count = group.records.length;
          const draft = getDraft(group.year);
          return (
            <View key={group.year} style={[styles.yearCard, cardShadow]}>
              {/* 年份標題列：左側折疊區 + 右側刪除年份按鈕 */}
              <View style={styles.yearHead}>
                <TouchableOpacity
                  style={styles.yearHeadToggle}
                  onPress={() => toggle(group.year)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.caret, isCollapsed && styles.caretCollapsed]} />
                  <Text style={[styles.yearText, FONT]}>{group.year}</Text>
                  <Text style={[styles.yearUnit, FONT]}>年</Text>
                  <Text style={[styles.yearCount, FONT]}>{count} 筆</Text>
                  <View style={styles.yearRule} />
                </TouchableOpacity>
                {!readOnly && (
                  <TouchableOpacity
                    style={styles.delYearBtn}
                    onPress={() => confirmDeleteYear(group.year, count)}
                    hitSlop={6}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.delYearText, FONT]}>刪除</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!isCollapsed && (
                <View style={styles.yearBody}>
                  {/* 記錄列表 */}
                  {count === 0 ? (
                    <Text style={[styles.recordEmpty, FONT]}>尚無記錄</Text>
                  ) : group.records.map((r) => {
                    const isEditing = editDraft?.id === r.id && editDraft?.year === group.year;

                    if (isEditing) {
                      return (
                        <View key={r.id} style={styles.editRow}>
                          <AppPicker
                            items={MONTHS}
                            value={editDraft.month}
                            onChange={(v) => setEditDraft((d) => ({ ...d, month: v }))}
                            placeholder="── 選擇月份 ──"
                            nullable
                          />
                          <TextInput
                            style={[styles.editTextInput, FONT]}
                            value={editDraft.text}
                            onChangeText={(v) => setEditDraft((d) => ({ ...d, text: v }))}
                            returnKeyType="done"
                            onSubmitEditing={handleSaveEdit}
                            autoFocus
                          />
                          <View style={styles.editActions}>
                            <TouchableOpacity onPress={cancelEdit} hitSlop={8}>
                              <Text style={[styles.editCancelText, FONT]}>取消</Text>
                            </TouchableOpacity>
                            <View style={styles.editActionDivider} />
                            <TouchableOpacity onPress={handleSaveEdit} hitSlop={8}>
                              <Text style={[styles.editSaveText, FONT]}>儲存</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }

                    return (
                      <View key={r.id} style={styles.recordRow}>
                        {/* 月份印章 */}
                        <View style={styles.monthBadge}>
                          <Text style={[styles.monthNum, FONT]}>{r.month}</Text>
                          <View style={styles.monthDivider} />
                          <Text style={[styles.monthChar, FONT]}>月</Text>
                        </View>
                        <Text style={[styles.recordText, FONT]}>{r.text}</Text>
                        {!readOnly && (
                          <View style={styles.recordActions}>
                            <TouchableOpacity
                              onPress={() => startEdit(group.year, r)}
                              hitSlop={8}
                              style={styles.actionBtn}
                            >
                              <Text style={[styles.editBtnText, FONT]}>編輯</Text>
                            </TouchableOpacity>
                            <Text style={[styles.actionSep, FONT]}>·</Text>
                            <TouchableOpacity
                              onPress={() => confirmDeleteRecord(group.year, r.id)}
                              hitSlop={8}
                              style={styles.actionBtn}
                            >
                              <Text style={[styles.delText, FONT]}>刪除</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* 新增記錄 — hidden in readOnly */}
                  {!readOnly && addingYear === group.year ? (
                    <View style={styles.addBox}>
                      <View style={styles.addMonthRow}>
                        <Text style={[styles.addFieldLabel, FONT]}>月份</Text>
                        <View style={styles.monthPickerWrap}>
                          <AppPicker
                            items={MONTHS}
                            value={draft.month}
                            onChange={(v) => setDraft(group.year, { month: v })}
                            placeholder="── 選擇月份 ──"
                            nullable
                          />
                        </View>
                      </View>
                      <View style={styles.addTextRow}>
                        <View style={styles.addFieldSpacer} />
                        <TextInput
                          style={[styles.addTextInput, FONT]}
                          placeholder="輸入事件／治療備註"
                          placeholderTextColor={colors.textMuted}
                          value={draft.text}
                          onChangeText={(v) => setDraft(group.year, { text: v })}
                          returnKeyType="done"
                          onSubmitEditing={() => handleAddRecord(group.year)}
                          autoFocus
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() => cancelAdd(group.year)}
                        style={styles.addCancelBtn}
                        hitSlop={8}
                      >
                        <Text style={[styles.addCancelText, FONT]}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (!readOnly && (
                    <TouchableOpacity
                      style={styles.addTrigger}
                      onPress={() => setAddingYear(group.year)}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.addTriggerText, FONT]}>＋　新增記錄</Text>
                    </TouchableOpacity>
                  ))}


                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },

  // ── 新增年份列 ──────────────────────────────────────────────────────────
  newYearBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  newYearLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 },
  stamp: {
    width: 10, height: 10, borderRadius: 2,
    borderWidth: 1.5, borderColor: colors.cinnabar,
    alignItems: 'center', justifyContent: 'center', opacity: 0.75,
  },
  stampInner: { width: 4, height: 4, borderRadius: 1, backgroundColor: colors.cinnabar },
  newYearLabel: { fontSize: 12, color: colors.textLabel, letterSpacing: 2 },
  yearInput: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border, borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: colors.textPrimary, letterSpacing: 1,
  },
  addYearBtn: {
    backgroundColor: colors.header, borderRadius: 3,
    paddingVertical: 10, paddingHorizontal: 14,
    justifyContent: 'center', borderWidth: 1, borderColor: colors.gold, opacity: 0.92,
  },
  addYearBtnText: { color: colors.white, fontSize: 13, letterSpacing: 2 },

  // ── 年份卡片 ────────────────────────────────────────────────────────────
  yearCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  yearHead: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: colors.bgSection,
  },
  yearHeadToggle: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  caret: {
    width: 8, height: 8,
    borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.cinnabar,
    transform: [{ rotate: '45deg' }, { translateY: -2 }],
    flexShrink: 0,
  },
  caretCollapsed: {
    transform: [{ rotate: '-45deg' }, { translateX: -2 }],
  },
  yearText: { fontSize: 19, color: colors.textPrimary, letterSpacing: 1, flexShrink: 0 },
  yearUnit: { fontSize: 12, color: colors.textLabel, letterSpacing: 1, flexShrink: 0, marginLeft: -3 },
  yearCount: { fontSize: 11, color: colors.cinnabar, letterSpacing: 1, flexShrink: 0, marginLeft: 4 },
  yearRule: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.25, marginLeft: 2 },

  yearBody: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12 },

  // ── 記錄列 ──────────────────────────────────────────────────────────────
  recordRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
  },

  // 月份印章
  monthBadge: {
    width: 34,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1, borderColor: colors.gold,
    backgroundColor: 'rgba(154,120,56,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 1,
  },
  monthNum: {
    fontSize: 18, color: colors.cinnabar,
    letterSpacing: -0.5, lineHeight: 22,
  },
  monthDivider: {
    width: 16, height: 1,
    backgroundColor: colors.gold, opacity: 0.5,
  },
  monthChar: {
    fontSize: 10, color: colors.gold,
    letterSpacing: 1, lineHeight: 13,
  },

  recordText: { flex: 1, fontSize: 14, color: colors.textPrimary, letterSpacing: 0.5, lineHeight: 21 },

  recordActions: {
    flexDirection: 'row', alignItems: 'center',
    flexShrink: 0, gap: 2,
  },
  actionBtn: { paddingHorizontal: 3, paddingVertical: 2 },
  editBtnText: { fontSize: 11, color: colors.textSelfMed, letterSpacing: 1, opacity: 0.85 },
  actionSep: { fontSize: 10, color: colors.textMuted, opacity: 0.5 },
  delText: { fontSize: 11, color: colors.deleteRed, letterSpacing: 1, opacity: 0.85 },

  recordEmpty: {
    fontSize: 13, color: colors.textMuted, letterSpacing: 1,
    textAlign: 'center', paddingVertical: 10,
  },

  // ── inline 編輯列 ───────────────────────────────────────────────────────
  editRow: {
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
    gap: 8,
  },
  editTextInput: {
    borderWidth: 1, borderColor: colors.cinnabar, borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: colors.textPrimary, letterSpacing: 0.5,
  },
  editActions: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6,
  },
  editActionDivider: {
    width: 1, height: 10, backgroundColor: colors.border,
  },
  editCancelText: { fontSize: 12, color: colors.textMuted, letterSpacing: 1 },
  editSaveText: { fontSize: 12, color: colors.cinnabar, letterSpacing: 1 },

  // ── 新增觸發按鈕 ────────────────────────────────────────────────────────
  addTrigger: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderFaint,
  },
  addTriggerText: {
    fontSize: 12, color: colors.gold,
    letterSpacing: 3, opacity: 0.75,
  },

  // ── 新增記錄區 ──────────────────────────────────────────────────────────
  addBox: {
    marginTop: 12,
    backgroundColor: colors.bgSection,
    borderRadius: 3, borderWidth: 1, borderColor: colors.borderLight,
    padding: 10, gap: 8,
  },
  addMonthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addFieldLabel: { fontSize: 11, color: colors.textLabel, letterSpacing: 2, flexShrink: 0, width: 32 },
  addFieldSpacer: { width: 32, flexShrink: 0 },
  monthPickerWrap: { flex: 1 },
  addTextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addTextInput: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border, borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.textPrimary, letterSpacing: 0.5,
  },
  addCancelBtn: { alignSelf: 'flex-end', paddingHorizontal: 4, paddingVertical: 2 },
  addCancelText: { fontSize: 11, color: colors.textMuted, letterSpacing: 1 },

  // ── 刪除年份（年份 header 右側） ────────────────────────────────────────
  delYearBtn: {
    paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: 1, borderLeftColor: colors.borderFaint,
  },
  delYearText: {
    fontSize: 11, color: colors.deleteRed,
    letterSpacing: 1, opacity: 0.65,
    textAlign: 'center', lineHeight: 16,
  },

  // ── 空狀態 ──────────────────────────────────────────────────────────────
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 50 },
  emptyText: { color: colors.textMuted, fontSize: 14, letterSpacing: 2 },
  emptyHint: { color: colors.btnDisabled, fontSize: 11, letterSpacing: 1 },
});
