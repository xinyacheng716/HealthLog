import React, { useState, useRef, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Keyboard,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import DateTimeField from './DateTimeField';
import AppPicker from './AppPicker';
import { colors, cardShadow, TYPE_COLORS } from '../constants/colors';
import { SettingsContext } from '../context';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

function defaultTime(dateStr) {
  return dateStr.replace(/-/g, '/') + ' 09:00';
}

export default function AppointmentSection({
  appointments, onAdd, onUpdate, onDelete, defaultDate,
  readOnly = false,
  autoOpen = false,
  timeOnly = false,
  showAddButton = true,
}) {
  const { hospitalList, visitTypeList, doctorList } = useContext(SettingsContext);
  const knownHospitals = (hospitalList || []).filter((h) => h !== '其他');
  const initDateTime = defaultDate ? defaultTime(defaultDate) : '';
  const [showForm, setShowForm] = useState(autoOpen);
  const [editingId, setEditingId] = useState(null); // null = adding new

  const [dateTime, setDateTime] = useState(autoOpen ? initDateTime : '');
  const [hospitalType, setHospitalType] = useState('');
  const [customHospital, setCustomHospital] = useState('');
  const [type, setType] = useState('門診');
  const [doctor, setDoctor] = useState('');
  const [note, setNote] = useState('');

  const customHospitalRef = useRef(null);

  const effectiveHospital = hospitalType === '其他' ? customHospital.trim() : hospitalType;
  const canSave = !!effectiveHospital && !!dateTime;

  function resetForm() {
    setDateTime(defaultDate ? defaultTime(defaultDate) : '');
    setHospitalType('');
    setCustomHospital('');
    setType('門診');
    setDoctor('');
    setNote('');
  }

  function openAddForm() {
    setEditingId(null);
    resetForm();
    setShowForm(true);
  }

  function openEditForm(appt) {
    setEditingId(appt.id);
    setDateTime(appt.dateTime);
    // restore hospital picker state
    if (knownHospitals.includes(appt.hospital)) {
      setHospitalType(appt.hospital);
      setCustomHospital('');
    } else {
      setHospitalType('其他');
      setCustomHospital(appt.hospital);
    }
    setType(appt.type || '門診');
    setDoctor(appt.doctor || '');
    setNote(appt.note || '');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function handleTypeChange(v) {
    setType(v);
    if (v !== '門診') setDoctor('');
  }

  function handleSave() {
    if (!canSave) return;
    const data = {
      dateTime,
      hospital: effectiveHospital,
      type: type || '門診',
      doctor: type === '門診' ? (doctor || null) : null,
      note: note.trim() || null,
    };
    if (editingId) {
      onUpdate?.(editingId, data);
    } else {
      onAdd({ id: uuidv4(), ...data });
    }
    closeForm();
  }

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHead}>
        <View style={styles.stamp}>
          <Text style={[styles.stampText, FONT]}>診</Text>
        </View>
        <Text style={[styles.sectionTitle, FONT]}>醫　院　行　程</Text>
        <View style={styles.rule} />
        {!readOnly && showAddButton && (
          <TouchableOpacity style={styles.addBtn} onPress={openAddForm} hitSlop={8}>
            <Text style={[styles.addBtnText, FONT]}>＋ 新增</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Appointment list */}
      {appointments.length > 0 && (
        <View style={[styles.list, cardShadow]}>
          {[...appointments]
            .sort((a, b) => a.dateTime.localeCompare(b.dateTime))
            .map((appt, idx, arr) => (
              <ApptRow
                key={appt.id}
                appt={appt}
                isLast={idx === arr.length - 1}
                readOnly={readOnly}
                onEdit={openEditForm}
                onDelete={onDelete}
              />
            ))}
        </View>
      )}

      {appointments.length === 0 && !showForm && (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, FONT]}>尚無行程記錄</Text>
        </View>
      )}

      {/* Add / Edit form */}
      {!readOnly && showForm && (
        <View style={[styles.form, cardShadow]}>
          <View style={styles.formHead}>
            <View style={styles.formLine} />
            <View style={styles.formStamp}>
              <Text style={[styles.formStampText, FONT]}>
                {editingId ? '編輯行程' : '新增行程'}
              </Text>
            </View>
            <View style={styles.formLine} />
          </View>

          {/* 時間 / 日期時間 */}
          <View style={styles.field}>
            <Text style={[styles.label, FONT]}>{timeOnly ? '時　　間' : '日期時間'}</Text>
            <DateTimeField
              value={dateTime}
              onChange={setDateTime}
              timeOnly={timeOnly}
              placeholder={timeOnly ? '── 選擇時間 ──' : '── 選擇日期時間 ──'}
            />
          </View>

          {/* 醫院 */}
          <View style={styles.field}>
            <Text style={[styles.label, FONT]}>醫　　院</Text>
            <AppPicker
              items={hospitalList}
              value={hospitalType}
              onChange={setHospitalType}
              placeholder="── 請選擇醫院 ──"
              nullable
            />
            {hospitalType === '其他' && (
              <View style={styles.customRow}>
                <TextInput
                  ref={customHospitalRef}
                  style={[styles.input, { flex: 1 }, FONT]}
                  placeholder="請輸入診所名稱"
                  placeholderTextColor={colors.textMuted}
                  value={customHospital}
                  onChangeText={setCustomHospital}
                  returnKeyType="done"
                  onSubmitEditing={() => customHospitalRef.current?.blur()}
                />
                <TouchableOpacity
                  style={styles.customDoneBtn}
                  onPress={() => customHospitalRef.current?.blur()}
                  hitSlop={8}
                >
                  <Text style={[styles.customDoneText, FONT]}>完成</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 行程類型 */}
          <View style={styles.field}>
            <Text style={[styles.label, FONT]}>行程類型</Text>
            <AppPicker
              items={visitTypeList}
              value={type}
              onChange={handleTypeChange}
              placeholder="── 請選擇 ──"
            />
          </View>

          {/* 看診醫生（門診才顯示） */}
          {type === '門診' && (
            <View style={styles.field}>
              <Text style={[styles.label, FONT]}>看診醫生</Text>
              <AppPicker
                items={doctorList}
                value={doctor}
                onChange={setDoctor}
                placeholder="── 請選擇醫生 ──"
                nullable
              />
            </View>
          )}

          {/* 備註 */}
          <View style={styles.field}>
            <Text style={[styles.label, FONT]}>備　　註</Text>
            <TextInput
              style={[styles.input, FONT]}
              placeholder="例：需空腹、帶藥袋"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDim]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveBtnText, FONT]}>
                {editingId ? '更　新' : '儲　存'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeForm} activeOpacity={0.8}>
              <Text style={[styles.cancelBtnText, FONT]}>取　消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function ApptRow({ appt, isLast, readOnly, onEdit, onDelete }) {
  const timeStr = appt.dateTime.slice(11, 16);
  const typeColor = TYPE_COLORS[appt.type] ?? colors.textMuted;
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={[styles.typeStripe, { backgroundColor: typeColor }]} />
      <View style={styles.rowInner}>
        <View style={styles.rowInfo}>
          <View style={styles.rowInfoTop}>
            {timeStr ? (
              <View style={styles.timeBadge}>
                <Text style={[styles.timeText, FONT]}>{timeStr}</Text>
              </View>
            ) : null}
            {appt.type ? (
              <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
                <Text style={[styles.typeText, FONT, { color: colors.white }]}>{appt.type}</Text>
              </View>
            ) : null}
            <Text style={[styles.hospitalText, FONT]} numberOfLines={1}>{appt.hospital}</Text>
          </View>
          {(appt.doctor || appt.note) ? (
            <View style={styles.rowMeta}>
              {appt.doctor ? (
                <View style={[styles.typeBadge, styles.doctorBadge]}>
                  <Text style={[styles.typeText, styles.doctorText, FONT]}>{appt.doctor}</Text>
                </View>
              ) : null}
              {appt.note ? (
                <Text style={[styles.noteText, FONT]} numberOfLines={1}>{appt.note}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
        {!readOnly && (
          <View style={styles.rowActions}>
            <TouchableOpacity onPress={() => onEdit(appt)} hitSlop={8} style={styles.actionBtn}>
              <Text style={[styles.editText, FONT]}>編輯</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(appt.id)} hitSlop={8} style={styles.actionBtn}>
              <Text style={[styles.deleteText, FONT]}>刪除</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stamp: {
    width: 22, height: 22, borderRadius: 3,
    borderWidth: 1.5, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(154,120,56,0.08)', flexShrink: 0,
  },
  stampText: { fontSize: 11, color: colors.gold, lineHeight: 14 },
  sectionTitle: { fontSize: 12, color: colors.textLabel, letterSpacing: 2, flexShrink: 0 },
  rule: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.2 },
  addBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 3, borderWidth: 1,
    borderColor: colors.gold, backgroundColor: 'rgba(154,120,56,0.06)',
  },
  addBtnText: { fontSize: 11, color: colors.gold, letterSpacing: 1 },

  emptyWrap: {
    paddingVertical: 16, alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { fontSize: 12, color: colors.textMuted, letterSpacing: 1 },

  // List — gold border distinguishes from form; keep bg clean
  list: {
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1.5, borderColor: colors.gold, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
  },
  rowLast: { borderBottomWidth: 0 },
  typeStripe: { width: 4, flexShrink: 0 },
  rowInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    padding: 12, paddingHorizontal: 14, gap: 12,
  },
  rowInfo: { flex: 1, gap: 6 },
  rowInfoTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBadge: {
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 2,
    backgroundColor: colors.bgSection, flexShrink: 0,
  },
  timeText: { fontSize: 14, color: colors.textPrimary, letterSpacing: 1 },
  hospitalText: { flex: 1, fontSize: 15, color: colors.textPrimary, letterSpacing: 0.5 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 2,
  },
  typeText: { fontSize: 12, letterSpacing: 1 },
  doctorBadge: { borderColor: colors.borderLight, backgroundColor: colors.bgCard },
  doctorText: { color: colors.textLabel },
  noteText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, flex: 1 },
  rowActions: { flexDirection: 'row', gap: 8, flexShrink: 0, paddingTop: 2 },
  actionBtn: { paddingHorizontal: 2, paddingVertical: 2 },
  editText: { fontSize: 11, color: colors.gold, letterSpacing: 1, opacity: 0.9 },
  deleteText: { fontSize: 11, color: colors.deleteRed, letterSpacing: 1, opacity: 0.85 },

  // Form
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12,
  },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  formLine: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.3 },
  formStamp: {
    paddingHorizontal: 10, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.gold,
    borderRadius: 2, backgroundColor: 'rgba(154,120,56,0.06)',
  },
  formStampText: { fontSize: 10, color: colors.gold, letterSpacing: 3 },
  field: { gap: 5 },
  label: { fontSize: 11, color: colors.textLabel, letterSpacing: 2 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.textPrimary, letterSpacing: 0.5,
  },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  customDoneBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 3, borderWidth: 1,
    borderColor: colors.gold, backgroundColor: 'rgba(154,120,56,0.06)',
    flexShrink: 0,
  },
  customDoneText: { fontSize: 13, color: colors.gold, letterSpacing: 1 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtn: {
    backgroundColor: colors.cinnabar, borderRadius: 3,
    paddingVertical: 10, paddingHorizontal: 22,
  },
  saveBtnDim: { opacity: 0.45 },
  saveBtnText: { color: colors.white, fontSize: 13, letterSpacing: 2 },
  cancelBtn: {
    borderRadius: 3, paddingVertical: 10, paddingHorizontal: 22,
    borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textLabel, fontSize: 13, letterSpacing: 2 },
});
