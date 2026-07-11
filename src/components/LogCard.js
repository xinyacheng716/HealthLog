import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Platform, Alert, Keyboard,
} from 'react-native';
import DateTimeField from './DateTimeField';
import SymptomMultiPicker from './SymptomMultiPicker';
import { colors, cardShadow } from '../constants/colors';
import { SettingsContext } from '../context';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

// ── Fuzzy allergy matching ────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// Returns true if `token` fuzzy-matches anywhere in `text`.
// threshold: 1 edit for length 3–8, 2 edits for length 9+, exact-only for ≤2.
function allergyTokenMatches(token, text) {
  const t = token.toLowerCase();
  const s = text.toLowerCase();
  if (s.includes(t)) return true;          // exact substring → done
  const len = t.length;
  if (len <= 2) return false;              // too short for fuzzy
  const threshold = len <= 8 ? 1 : 2;
  // check space/punct-separated words (works for English)
  for (const word of s.split(/[\s,，。、.！？]+/).filter(Boolean)) {
    if (levenshtein(t, word) <= threshold) return true;
  }
  // sliding window of same length (handles unsegmented Chinese)
  for (let i = 0; i <= s.length - len; i++) {
    if (levenshtein(t, s.slice(i, i + len)) <= threshold) return true;
  }
  return false;
}

function getSymptoms(log) {
  if (Array.isArray(log.symptoms) && log.symptoms.length > 0) return log.symptoms;
  if (log.symptom) return [log.symptom];
  return [];
}

// backward compat: old selfMed (string) vs new selfMeds (string[])
function getSelfMeds(log) {
  if (Array.isArray(log.selfMeds) && log.selfMeds.length > 0) return log.selfMeds;
  if (log.selfMed) return [log.selfMed];
  return [];
}

export default function LogCard({ log, onUpdate, onDelete, readOnly = false }) {
  const { symptomList, medList, allergyList } = useContext(SettingsContext);

  const [editing, setEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Original record fields
  const [symptoms, setSymptoms] = useState(getSymptoms(log));
  const [severity, setSeverity] = useState(log.severity ?? 5);
  const [startTime, setStartTime] = useState(log.startTime || '');
  const [selfMeds, setSelfMeds] = useState(getSelfMeds(log));

  // Supplemental fields
  const [endTime, setEndTime] = useState(log.endTime || '');
  const [doctorDiagnosis, setDoctorDiagnosis] = useState(log.doctorDiagnosis || '');
  const [doctorMed, setDoctorMed] = useState(log.doctorMed || '');
  const [reliefSeverity, setReliefSeverity] = useState(log.reliefSeverity ?? null);
  const [reliefNote, setReliefNote] = useState(log.reliefNote || '');

  function openEdit() {
    setSymptoms(getSymptoms(log));
    setSeverity(log.severity ?? 5);
    setStartTime(log.startTime || '');
    setSelfMeds(getSelfMeds(log));
    setEndTime(log.endTime || '');
    setDoctorDiagnosis(log.doctorDiagnosis || '');
    setDoctorMed(log.doctorMed || '');
    setReliefSeverity(log.reliefSeverity ?? null);
    setReliefNote(log.reliefNote || '');
    setShowOriginal(false);
    setEditing(true);
  }

  function buildPatch() {
    const patch = {
      endTime: endTime || null,
      doctorDiagnosis: doctorDiagnosis.trim() || null,
      doctorMed: doctorMed.trim() || null,
      reliefSeverity,
      reliefNote: reliefNote.trim() || null,
    };
    if (showOriginal) {
      patch.symptoms = symptoms;
      patch.symptom = undefined;
      patch.severity = severity;
      patch.startTime = startTime;
      patch.selfMeds = selfMeds;
      patch.selfMed = undefined;
    }
    return patch;
  }

  function doSave(patch) {
    onUpdate(log.id, patch);
    setEditing(false);
    setShowOriginal(false);
  }

  function save() {
    const noFollowUp = !doctorDiagnosis.trim() && !doctorMed.trim();
    if (noFollowUp && !showOriginal) {
      Alert.alert('尚未填寫事後補填資料', '請至少填寫醫生診斷或醫生確認用藥後再儲存。');
      return;
    }

    const patch = buildPatch();

    // Allergy check: split each entry by whitespace, match any token
    const med = patch.doctorMed || '';
    if (med && allergyList.length > 0) {
      // Split each entry by whitespace to get individual drug name tokens
      const matched = allergyList.filter((drug) =>
        drug.split(/\s+/).filter(Boolean).some((token) =>
          allergyTokenMatches(token, med),
        ),
      );
      if (matched.length > 0) {
        Alert.alert(
          '過敏藥物警示',
          `醫生確認用藥含有您記錄的過敏藥物：\n\n${matched.join('、')}\n\n請與醫生確認後再儲存。`,
          [
            { text: '返回編輯', style: 'cancel' },
            { text: '確認儲存', onPress: () => doSave(patch) },
          ],
        );
        return;
      }
    }

    doSave(patch);
  }

  function cancel() {
    setEditing(false);
    setShowOriginal(false);
  }

  function confirmDelete() {
    Alert.alert(
      '刪除記錄',
      '確定要刪除這筆症狀記錄？此操作無法復原。',
      [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: () => onDelete?.(log.id) },
      ],
    );
  }

  const displaySymptoms = getSymptoms(log);
  const symptomDisplay = displaySymptoms.join('、');
  const selfMedDisplay = getSelfMeds(log);
  const hasFollowUp = log.endTime || log.doctorMed || log.reliefSeverity !== null;
  const startHM = log.startTime.slice(11, 16);
  const endHM = log.endTime ? log.endTime.slice(11, 16) : null;

  return (
    <View style={[styles.card, cardShadow]}>
    <TouchableWithoutFeedback onPress={() => editing && cancel()}>
      <View style={styles.cardContent}>
        {/* Top section */}
        <View style={styles.top}>
          <View style={styles.info}>
            <View style={styles.symptomRow}>
              <View style={styles.symptomAccent} />
              <Text style={[styles.symptomName, FONT]}>{symptomDisplay}</Text>
            </View>

            <View style={styles.timeRow}>
              <Text style={[styles.timeText, FONT]}>{startHM}</Text>
              {endHM && (
                <>
                  <Text style={styles.timeArrow}>→</Text>
                  <Text style={[styles.timeText, FONT]}>{endHM}</Text>
                </>
              )}
            </View>

            {selfMedDisplay.length > 0 ? (
              <FieldTag color={colors.textSelfMed} label="自行服藥" value={selfMedDisplay.join('、')} />
            ) : null}
            {log.doctorDiagnosis ? (
              <FieldTag color={colors.textDiagnosis} label="醫生診斷" value={log.doctorDiagnosis} />
            ) : null}
            {log.doctorMed ? (
              <FieldTag color={colors.textDoctorMed} label="醫生用藥" value={log.doctorMed} bold />
            ) : null}
            {log.reliefSeverity !== null ? (
              <FieldTag
                color={colors.textRelief}
                label="緩解後"
                value={`${log.reliefSeverity}/10${log.reliefNote ? `　${log.reliefNote}` : ''}`}
              />
            ) : null}
          </View>
        </View>

        {/* Dashed separator */}
        <View style={styles.separator}>
          <View style={styles.separatorDash} />
          <View style={styles.separatorCenter}>
            <View style={styles.separatorDot} />
          </View>
          <View style={styles.separatorDash} />
        </View>

        {/* Bottom section */}
        {!readOnly && <View style={styles.bottom}>
          {editing ? (
            <EditForm
              symptomList={symptomList}
              medList={medList}
              showOriginal={showOriginal}
              onToggleOriginal={() => setShowOriginal((v) => !v)}
              symptoms={symptoms} setSymptoms={setSymptoms}
              startTime={startTime} setStartTime={setStartTime}
              selfMeds={selfMeds} setSelfMeds={setSelfMeds}
              doctorDiagnosis={doctorDiagnosis} setDoctorDiagnosis={setDoctorDiagnosis}
              doctorMed={doctorMed} setDoctorMed={setDoctorMed}
              onSave={save}
              onCancel={cancel}
            />
          ) : (
            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.toggleBtn} onPress={openEdit} activeOpacity={0.65}>
                <View style={[styles.toggleBtnStamp, hasFollowUp && styles.toggleBtnStampFilled]} />
                <Text style={[styles.toggleBtnText, FONT]}>
                  {hasFollowUp ? '編輯補充資料' : '補填醫生診斷・確認用藥'}
                </Text>
              </TouchableOpacity>

              {onDelete && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={confirmDelete}
                  activeOpacity={0.65}
                  hitSlop={8}
                >
                  <Text style={[styles.deleteBtnText, FONT]}>刪除</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>}
      </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

// ── FieldTag ─────────────────────────────────────────────────────────────────

function FieldTag({ color, label, value, bold }) {
  return (
    <View style={tagStyles.row}>
      <View style={[tagStyles.dot, { backgroundColor: color }]} />
      <Text style={[tagStyles.label, { color, fontFamily: KAITI }]}>{label}：</Text>
      <Text
        style={[tagStyles.value, { color, fontFamily: KAITI }, bold && tagStyles.bold]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const tagStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7,
    marginRight: 5,
    flexShrink: 0,
    opacity: 0.8,
  },
  label: {
    fontSize: 11,
    lineHeight: 18,
    opacity: 0.8,
    flexShrink: 0,
  },
  value: {
    fontSize: 11,
    lineHeight: 18,
    flex: 1,
  },
  bold: { fontWeight: 'bold' },
});

// ── EditForm ──────────────────────────────────────────────────────────────────

function SectionDivider({ title }) {
  return (
    <View style={editStyles.sectionHead}>
      <View style={editStyles.sectionLine} />
      <View style={editStyles.sectionStamp}>
        <Text style={[editStyles.sectionText, { fontFamily: KAITI }]}>{title}</Text>
      </View>
      <View style={editStyles.sectionLine} />
    </View>
  );
}

function EditForm({
  symptomList, medList,
  showOriginal, onToggleOriginal,
  symptoms, setSymptoms,
  startTime, setStartTime,
  selfMeds, setSelfMeds,
  doctorDiagnosis, setDoctorDiagnosis,
  doctorMed, setDoctorMed,
  onSave, onCancel,
}) {
  return (
    <View style={editStyles.form}>

      {/* ── 事後補填 ── */}
      <SectionDivider title="事後補填" />

      <EditField
        label="醫生診斷"
        placeholder="例：骨轉移壓迫、藥物副作用"
        value={doctorDiagnosis}
        onChangeText={setDoctorDiagnosis}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
      <EditField
        label="醫生確認用藥"
        placeholder="例：加強嗎啡劑量"
        value={doctorMed}
        onChangeText={setDoctorMed}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      {/* ── 修改原始記錄（可展開）── */}
      <TouchableOpacity
        style={editStyles.originalToggle}
        onPress={onToggleOriginal}
        activeOpacity={0.7}
      >
        <View style={editStyles.originalToggleChevron}>
          <View style={[editStyles.chevron, showOriginal && editStyles.chevronDown]} />
        </View>
        <Text style={[editStyles.originalToggleText, { fontFamily: KAITI }]}>
          {showOriginal ? '收合原始記錄' : '修改原始症狀記錄'}
        </Text>
      </TouchableOpacity>

      {showOriginal && (
        <View style={editStyles.originalSection}>
          <View style={editStyles.fieldWrap}>
            <Text style={[editStyles.label, { fontFamily: KAITI }]}>症　　狀</Text>
            <SymptomMultiPicker
              symptomList={symptomList}
              value={symptoms}
              onChange={setSymptoms}
            />
          </View>

          <View style={editStyles.fieldWrap}>
            <Text style={[editStyles.label, { fontFamily: KAITI }]}>開始時間</Text>
            <DateTimeField value={startTime} onChange={setStartTime} />
          </View>

          <View style={editStyles.fieldWrap}>
            <Text style={[editStyles.label, { fontFamily: KAITI }]}>自行服藥</Text>
            <SymptomMultiPicker
              symptomList={medList}
              value={selfMeds}
              onChange={setSelfMeds}
              placeholder="── 未服藥（點選以記錄）──"
              title="選　擇　服　藥"
              allowOther
            />
          </View>
        </View>
      )}

      <View style={editStyles.btnRow}>
        <TouchableOpacity style={editStyles.saveBtn} onPress={onSave} activeOpacity={0.8}>
          <Text style={[editStyles.saveBtnText, { fontFamily: KAITI }]}>儲　存</Text>
        </TouchableOpacity>
        <TouchableOpacity style={editStyles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={[editStyles.cancelBtnText, { fontFamily: KAITI }]}>取　消</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EditField({ label, placeholder, value, onChangeText, returnKeyType, onSubmitEditing }) {
  return (
    <View style={editStyles.fieldWrap}>
      <Text style={[editStyles.label, { fontFamily: KAITI }]}>{label}</Text>
      <TextInput
        style={[editStyles.input, { fontFamily: KAITI }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={returnKeyType === 'done'}
      />
    </View>
  );
}

const editStyles = StyleSheet.create({
  form: { gap: 12 },
  fieldWrap: {},
  label: {
    fontSize: 11,
    color: colors.textLabel,
    letterSpacing: 2,
    marginBottom: 5,
  },
  labelValue: {
    fontSize: 13,
    color: colors.cinnabar,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.35,
  },
  sectionStamp: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.cinnabar,
    borderRadius: 2,
    backgroundColor: 'rgba(139,48,32,0.06)',
  },
  sectionText: {
    fontSize: 10,
    color: colors.cinnabar,
    letterSpacing: 3,
    opacity: 0.85,
  },
  originalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 3,
    backgroundColor: colors.bgSection,
  },
  originalToggleChevron: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevron: {
    width: 6,
    height: 6,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.gold,
    transform: [{ rotate: '-45deg' }],
  },
  chevronDown: {
    transform: [{ rotate: '45deg' }],
  },
  originalToggleText: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  originalSection: {
    gap: 12,
    paddingTop: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(154,120,56,0.3)',
    marginLeft: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: colors.cinnabar,
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 13,
    letterSpacing: 2,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textLabel,
    fontSize: 13,
    letterSpacing: 2,
  },
});

// ── Main card styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardContent: { flex: 1 },
  top: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  info: { flex: 1 },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  symptomAccent: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
    backgroundColor: colors.cinnabar,
    opacity: 0.85,
    marginTop: 3,
    flexShrink: 0,
  },
  symptomName: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 1,
    flexWrap: 'wrap',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  timeArrow: {
    fontSize: 10,
    color: colors.gold,
    opacity: 0.7,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 14,
  },
  separatorDash: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  separatorCenter: { paddingHorizontal: 6 },
  separatorDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.gold,
    opacity: 0.4,
  },
  bottom: {
    padding: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.bgCardBottom,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 3,
    flex: 1,
  },
  toggleBtnStamp: {
    width: 8,
    height: 8,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.gold,
    opacity: 0.7,
    flexShrink: 0,
  },
  toggleBtnStampFilled: {
    backgroundColor: colors.gold,
    opacity: 0.7,
  },
  toggleBtnText: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.5,
    flex: 1,
    flexWrap: 'wrap',
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.deleteRed,
    borderRadius: 3,
    flexShrink: 0,
  },
  deleteBtnText: {
    fontSize: 12,
    color: colors.deleteRed,
    letterSpacing: 1,
    opacity: 0.85,
  },
});
