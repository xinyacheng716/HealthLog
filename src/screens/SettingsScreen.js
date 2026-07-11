import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Platform, Keyboard, Alert, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, cardShadow } from '../constants/colors';
import { SettingsContext } from '../context';
import { useAuth } from '../context/AuthContext';
import { useViewer } from '../context/ViewerContext';
import { supabase } from '../lib/supabase';
import { fetchOwnerSettings } from '../lib/viewerData';
import { syncListFieldToCloud } from '../lib/cloudSync';
import Section from '../components/Section';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

function SectionBlock({ title, char, children }) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHead}>
        <View style={styles.charBadge}>
          <Text style={[styles.charBadgeText, FONT]}>{char}</Text>
        </View>
        <Text style={[styles.sectionTitle, FONT]}>{title}</Text>
        <View style={styles.sectionRule} />
      </View>
      {children}
    </View>
  );
}

// Editable row — shows TextInput when isEditing, otherwise plain text
function EditableRow({
  idx, value, isEditing,
  editValue, setEditValue,
  onStartEdit, onConfirm, onCancel, onDelete,
  isLast, readOnly = false,
}) {
  return (
    <View style={[styles.listRow, isLast && !isEditing && styles.listRowLast]}>
      <Text style={[styles.rowNum, FONT]}>{idx + 1}</Text>

      {isEditing && !readOnly ? (
        <>
          <TextInput
            style={[styles.editInput, FONT]}
            value={editValue}
            onChangeText={setEditValue}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onConfirm}
            selectTextOnFocus
          />
          <TouchableOpacity onPress={onConfirm} hitSlop={8} style={styles.confirmBtn}>
            <Text style={[styles.confirmText, FONT]}>確定</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.cancelInlineBtn}>
            <Text style={[styles.cancelInlineText, FONT]}>取消</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[styles.itemText, FONT]} numberOfLines={2}>{value}</Text>
          {!readOnly && (
            <>
              <TouchableOpacity onPress={onStartEdit} hitSlop={8} style={styles.editBtn}>
                <Text style={[styles.editBtnText, FONT]}>編輯</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
                <Text style={[styles.deleteText, FONT]}>刪除</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const {
    allergyList, setAllergyList,
    medList, setMedList,
    symptomList, setSymptomList,
    hospitalList, setHospitalList,
    visitTypeList, setVisitTypeList,
    doctorList, setDoctorList,
  } = useContext(SettingsContext);
  const { signOut } = useAuth();
  const { isViewerMode, activeOwner } = useViewer();
  const insets = useSafeAreaInsets();

  // ── Viewer mode: fetch owner's lists from Supabase profiles ──────────────
  const [ownerSettings, setOwnerSettings] = useState(null);
  useEffect(() => {
    if (!isViewerMode || !activeOwner) { setOwnerSettings(null); return; }
    fetchOwnerSettings(activeOwner.id).then(setOwnerSettings);
  }, [isViewerMode, activeOwner?.id]);

  // In viewer mode: show owner's lists (empty if null/unsynced, NOT viewer's defaults)
  const displayAllergyList   = isViewerMode ? (ownerSettings?.allergyList   ?? []) : allergyList;
  const displayMedList       = isViewerMode ? (ownerSettings?.medList       ?? []) : medList;
  const displaySymptomList   = isViewerMode ? (ownerSettings?.symptomList   ?? []) : symptomList;
  const displayHospitalList  = isViewerMode ? (ownerSettings?.hospitalList  ?? []) : hospitalList;
  const displayVisitTypeList = isViewerMode ? (ownerSettings?.visitTypeList ?? []) : visitTypeList;
  const displayDoctorList    = isViewerMode ? (ownerSettings?.doctorList    ?? []) : doctorList;

  // ── 家人分享 ──────────────────────────────────────────────────────────────
  const [generatedCode, setGeneratedCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async function handleGenerateInvite() {
    setInviteLoading(true);
    setInviteError('');
    setGeneratedCode('');
    const code = makeCode();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('invite_codes').insert({
      owner_id: session?.user.id,
      code,
      expires_at: expiresAt,
    });
    setInviteLoading(false);
    if (error) {
      setInviteError(`產生失敗：${error.message}`);
    } else {
      setGeneratedCode(code);
    }
  }

  async function handleShareInvite() {
    try {
      await Share.share({
        message: `我用「健康記錄」App 記錄健康狀況，輸入這組邀請碼就能一起查看：${generatedCode}`,
      });
    } catch (_) {}
  }

  async function handleRedeem() {
    const code = redeemInput.trim().toUpperCase();
    if (!code) return;
    setRedeemLoading(true);
    const { error } = await supabase.rpc('redeem_invite_code', { invite_code: code });
    setRedeemLoading(false);
    if (error) {
      Alert.alert('綁定失敗', error.message);
    } else {
      setRedeemInput('');
      Alert.alert('綁定成功', '已成功綁定，現在可以查看對方的健康記錄。');
    }
  }

  function handleSignOut() {
    Alert.alert('登出', '確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '登出', style: 'destructive', onPress: signOut },
    ]);
  }

  // ── 開發用暫時按鈕（__DEV__ only，除錯完成後應移除）──────────────────────
  const [devSyncing, setDevSyncing] = useState(false);
  const [devResetDone, setDevResetDone] = useState(false);

  async function handleDevSyncSettings() {
    setDevSyncing(true);
    const fields = [
      ['symptom_list', symptomList],
      ['med_list', medList],
      ['allergy_list', allergyList],
      ['hospital_list', hospitalList],
      ['visit_type_list', visitTypeList],
      ['doctor_list', doctorList],
    ];
    console.log('[dev] 逐欄位呼叫 syncListFieldToCloud，本機目前的六個清單：', JSON.stringify({
      symptomList, medList, allergyList, hospitalList, visitTypeList, doctorList,
    }));
    const results = [];
    for (const [fieldName, listValue] of fields) {
      const result = await syncListFieldToCloud(fieldName, listValue);
      results.push({ fieldName, ...result });
    }
    console.log('[dev] syncListFieldToCloud 逐欄位回傳結果：', JSON.stringify(results));
    const failed = results.filter((r) => !r.success);
    if (failed.length === 0) {
      Alert.alert('同步完成', 'Supabase profiles 六個欄位已逐一更新，請查看 console log 確認每個欄位的結果。');
    } else {
      Alert.alert('部分同步失敗', failed.map((r) => `${r.fieldName}: ${JSON.stringify(r.error)}`).join('\n'));
    }
    setDevSyncing(false);
  }

  async function handleDevResetInitFlag() {
    await AsyncStorage.removeItem('localDataInitialized');
    setDevResetDone(true);
    console.log('[dev] localDataInitialized flag 已清除，下次登入會重新觸發雲端拉取');
    Alert.alert('已清除', '下次登出重新登入時，initSync 會重新從雲端拉取資料。');
  }

  // Inline edit state: { section: 'allergy'|'med'|'sym', index: number } | null
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  // New-item inputs
  const [newAllergy, setNewAllergy] = useState('');
  const [newMed, setNewMed] = useState('');
  const [newSym, setNewSym] = useState('');
  const [newHospital, setNewHospital] = useState('');
  const [newVisitType, setNewVisitType] = useState('');
  const [newDoctor, setNewDoctor] = useState('');

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function startEdit(section, index, value) {
    Keyboard.dismiss();
    setEditingKey({ section, index });
    setEditValue(value);
  }

  function confirmEdit() {
    const v = editValue.trim();
    if (!v || !editingKey) return;
    const { section, index } = editingKey;
    if (section === 'allergy')   setAllergyList((p) => p.map((item, i) => i === index ? v : item));
    if (section === 'med')       setMedList((p) => p.map((item, i) => i === index ? v : item));
    if (section === 'sym')       setSymptomList((p) => p.map((item, i) => i === index ? v : item));
    if (section === 'hospital')  setHospitalList((p) => p.map((item, i) => i === index ? v : item));
    if (section === 'visitType') setVisitTypeList((p) => p.map((item, i) => i === index ? v : item));
    if (section === 'doctor')    setDoctorList((p) => p.map((item, i) => i === index ? v : item));
    setEditingKey(null);
    setEditValue('');
    Keyboard.dismiss();
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
  }

  function isEditing(section, index) {
    return editingKey?.section === section && editingKey?.index === index;
  }

  // ── Add helpers ───────────────────────────────────────────────────────────

  function addAllergy() {
    const v = newAllergy.trim();
    if (!v || allergyList.includes(v)) return;
    setAllergyList((prev) => [...prev, v]);
    setNewAllergy('');
  }

  function addMed() {
    const v = newMed.trim();
    if (!v || medList.includes(v)) return;
    setMedList((prev) => [...prev, v]);
    setNewMed('');
  }

  function addSymptom() {
    const v = newSym.trim();
    if (!v || symptomList.includes(v)) return;
    setSymptomList((prev) => [...prev.filter((s) => s !== '其他'), v, '其他']);
    setNewSym('');
  }

  function addHospital() {
    const v = newHospital.trim();
    if (!v || hospitalList.includes(v)) return;
    setHospitalList((prev) => [...prev.filter((h) => h !== '其他'), v, '其他']);
    setNewHospital('');
  }

  function addVisitType() {
    const v = newVisitType.trim();
    if (!v || visitTypeList.includes(v)) return;
    setVisitTypeList((prev) => [...prev, v]);
    setNewVisitType('');
  }

  function addDoctor() {
    const v = newDoctor.trim();
    if (!v || doctorList.includes(v)) return;
    setDoctorList((prev) => [...prev, v]);
    setNewDoctor('');
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  function deleteAllergy(item)   { setAllergyList((p) => p.filter((a) => a !== item)); }
  function deleteMed(item)       { setMedList((p) => p.filter((m) => m !== item)); }
  function deleteSymptom(item)   { setSymptomList((p) => p.filter((s) => s !== item)); }
  function deleteHospital(item)  { setHospitalList((p) => p.filter((h) => h !== item)); }
  function deleteVisitType(item) { setVisitTypeList((p) => p.filter((t) => t !== item)); }
  function deleteDoctor(item)    { setDoctorList((p) => p.filter((d) => d !== item)); }

  // In own mode: filter out '其他' (it's hardcoded as a locked row at the bottom)
  // In viewer mode: show owner's symptomList as-is (no hardcoded '其他')
  const symListNoOther = isViewerMode
    ? displaySymptomList
    : symptomList.filter((s) => s !== '其他');

  // 醫院清單的「其他」也是固定在末尾、不可刪除的鎖定項目（觸發自訂診所名稱輸入）
  const hospitalListNoOther = isViewerMode
    ? displayHospitalList
    : hospitalList.filter((h) => h !== '其他');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      {/* 藥物過敏 */}
      <SectionBlock title="藥　物　過　敏" char="敏">
        <View style={[styles.listCard, cardShadow]}>
          {displayAllergyList.length === 0 ? (
            <View style={[styles.listRow, styles.listRowLast]}>
              <Text style={[styles.emptyText, FONT]}>尚無記錄</Text>
            </View>
          ) : displayAllergyList.map((item, idx) => (
            <EditableRow
              key={`allergy-${idx}`}
              idx={idx}
              value={item}
              isEditing={isEditing('allergy', idx)}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={() => startEdit('allergy', idx, item)}
              onConfirm={confirmEdit}
              onCancel={cancelEdit}
              onDelete={() => deleteAllergy(item)}
              isLast={idx === displayAllergyList.length - 1}
              readOnly={isViewerMode}
            />
          ))}
        </View>
        {!isViewerMode && (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, FONT]}
              placeholder="新增過敏藥物"
              placeholderTextColor={colors.textMuted}
              value={newAllergy}
              onChangeText={setNewAllergy}
              onSubmitEditing={addAllergy}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addAllergy} activeOpacity={0.75}>
              <Text style={[styles.addBtnText, FONT]}>新　增</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionBlock>

      {/* 藥物清單 */}
      <SectionBlock title="藥　物　清　單" char="藥">
        <View style={[styles.listCard, cardShadow]}>
          {displayMedList.length === 0 ? (
            <View style={[styles.listRow, styles.listRowLast]}>
              <Text style={[styles.emptyText, FONT]}>尚無記錄</Text>
            </View>
          ) : displayMedList.map((med, idx) => (
            <EditableRow
              key={`med-${idx}`}
              idx={idx}
              value={med}
              isEditing={isEditing('med', idx)}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={() => startEdit('med', idx, med)}
              onConfirm={confirmEdit}
              onCancel={cancelEdit}
              onDelete={() => deleteMed(med)}
              isLast={idx === displayMedList.length - 1}
              readOnly={isViewerMode}
            />
          ))}
        </View>
        {!isViewerMode && (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, FONT]}
              placeholder="新增藥物名稱"
              placeholderTextColor={colors.textMuted}
              value={newMed}
              onChangeText={setNewMed}
              onSubmitEditing={addMed}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addMed} activeOpacity={0.75}>
              <Text style={[styles.addBtnText, FONT]}>新　增</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionBlock>

      {/* 症狀清單 */}
      <SectionBlock title="症　狀　清　單" char="症">
        <View style={[styles.listCard, cardShadow]}>
          {symListNoOther.map((sym, idx) => (
            <EditableRow
              key={`sym-${idx}`}
              idx={idx}
              value={sym}
              isEditing={isEditing('sym', idx)}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={() => startEdit('sym', idx, sym)}
              onConfirm={confirmEdit}
              onCancel={cancelEdit}
              onDelete={() => deleteSymptom(sym)}
              isLast={false}
              readOnly={isViewerMode}
            />
          ))}
          {/* 其他 — 固定不可編輯，只在自己的設定頁顯示 */}
          {!isViewerMode && (
            <View style={[styles.listRow, styles.listRowLast, styles.lockedRow]}>
              <Text style={[styles.rowNum, FONT, { color: colors.border }]}>
                {symListNoOther.length + 1}
              </Text>
              <Text style={[styles.itemText, styles.lockedText, FONT]}>其他</Text>
              <View style={styles.lockedTag}>
                <Text style={[styles.lockedTagText, FONT]}>固定項目</Text>
              </View>
            </View>
          )}
        </View>
        {!isViewerMode && (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, FONT]}
              placeholder="新增症狀名稱"
              placeholderTextColor={colors.textMuted}
              value={newSym}
              onChangeText={setNewSym}
              onSubmitEditing={addSymptom}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addSymptom} activeOpacity={0.75}>
              <Text style={[styles.addBtnText, FONT]}>新　增</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionBlock>

      {/* 醫院清單 */}
      <SectionBlock title="醫　院　清　單" char="院">
        <View style={[styles.listCard, cardShadow]}>
          {hospitalListNoOther.map((h, idx) => (
            <EditableRow
              key={`hospital-${idx}`}
              idx={idx}
              value={h}
              isEditing={isEditing('hospital', idx)}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={() => startEdit('hospital', idx, h)}
              onConfirm={confirmEdit}
              onCancel={cancelEdit}
              onDelete={() => deleteHospital(h)}
              isLast={false}
              readOnly={isViewerMode}
            />
          ))}
          {/* 其他 — 固定不可編輯，只在自己的設定頁顯示（觸發自訂診所名稱輸入） */}
          {!isViewerMode && (
            <View style={[styles.listRow, styles.listRowLast, styles.lockedRow]}>
              <Text style={[styles.rowNum, FONT, { color: colors.border }]}>
                {hospitalListNoOther.length + 1}
              </Text>
              <Text style={[styles.itemText, styles.lockedText, FONT]}>其他</Text>
              <View style={styles.lockedTag}>
                <Text style={[styles.lockedTagText, FONT]}>固定項目</Text>
              </View>
            </View>
          )}
        </View>
        {!isViewerMode && (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, FONT]}
              placeholder="新增醫院名稱"
              placeholderTextColor={colors.textMuted}
              value={newHospital}
              onChangeText={setNewHospital}
              onSubmitEditing={addHospital}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addHospital} activeOpacity={0.75}>
              <Text style={[styles.addBtnText, FONT]}>新　增</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionBlock>

      {/* 行程類型清單 */}
      <SectionBlock title="行程類型清單" char="型">
        <View style={[styles.listCard, cardShadow]}>
          {displayVisitTypeList.length === 0 ? (
            <View style={[styles.listRow, styles.listRowLast]}>
              <Text style={[styles.emptyText, FONT]}>尚無記錄</Text>
            </View>
          ) : displayVisitTypeList.map((t, idx) => (
            <EditableRow
              key={`visitType-${idx}`}
              idx={idx}
              value={t}
              isEditing={isEditing('visitType', idx)}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={() => startEdit('visitType', idx, t)}
              onConfirm={confirmEdit}
              onCancel={cancelEdit}
              onDelete={() => deleteVisitType(t)}
              isLast={idx === displayVisitTypeList.length - 1}
              readOnly={isViewerMode}
            />
          ))}
        </View>
        {!isViewerMode && (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, FONT]}
              placeholder="新增行程類型"
              placeholderTextColor={colors.textMuted}
              value={newVisitType}
              onChangeText={setNewVisitType}
              onSubmitEditing={addVisitType}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addVisitType} activeOpacity={0.75}>
              <Text style={[styles.addBtnText, FONT]}>新　增</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionBlock>

      {/* 看診醫生清單 */}
      <SectionBlock title="看　診　醫　生" char="醫">
        <View style={[styles.listCard, cardShadow]}>
          {displayDoctorList.length === 0 ? (
            <View style={[styles.listRow, styles.listRowLast]}>
              <Text style={[styles.emptyText, FONT]}>尚無記錄</Text>
            </View>
          ) : displayDoctorList.map((d, idx) => (
            <EditableRow
              key={`doctor-${idx}`}
              idx={idx}
              value={d}
              isEditing={isEditing('doctor', idx)}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={() => startEdit('doctor', idx, d)}
              onConfirm={confirmEdit}
              onCancel={cancelEdit}
              onDelete={() => deleteDoctor(d)}
              isLast={idx === displayDoctorList.length - 1}
              readOnly={isViewerMode}
            />
          ))}
        </View>
        {!isViewerMode && (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, FONT]}
              placeholder="新增看診醫生"
              placeholderTextColor={colors.textMuted}
              value={newDoctor}
              onChangeText={setNewDoctor}
              onSubmitEditing={addDoctor}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addDoctor} activeOpacity={0.75}>
              <Text style={[styles.addBtnText, FONT]}>新　增</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionBlock>

      {/* 家人分享 — hidden in viewer mode */}
      {!isViewerMode && <View style={styles.shareBlock}>
        <Section title="家　人　分　享">
          {/* 產生邀請碼 */}
          <View style={styles.shareCard}>
            <Text style={[styles.shareSubTitle, FONT]}>產　生　邀　請　碼</Text>
            <Text style={[styles.shareHint, FONT]}>
              邀請碼有效期 48 小時，家人輸入後即可共同查看健康記錄。
            </Text>

            {generatedCode ? (
              <View style={styles.codeRow}>
                <Text style={[styles.codeText, FONT]}>{generatedCode}</Text>
                <TouchableOpacity
                  style={styles.shareCodeBtn}
                  onPress={handleShareInvite}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.shareCodeBtnText, FONT]}>分　享</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {inviteError ? (
              <Text style={[styles.errorText, FONT]}>{inviteError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.generateBtn, inviteLoading && styles.btnDim]}
              onPress={handleGenerateInvite}
              disabled={inviteLoading}
              activeOpacity={0.75}
            >
              <Text style={[styles.generateBtnText, FONT]}>
                {inviteLoading ? '產生中…' : generatedCode ? '重新產生' : '產　生　邀　請　碼'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 輸入邀請碼 */}
          <View style={[styles.shareCard, { marginTop: 10 }]}>
            <Text style={[styles.shareSubTitle, FONT]}>輸　入　邀　請　碼</Text>
            <Text style={[styles.shareHint, FONT]}>
              輸入對方提供的 6 碼邀請碼完成綁定。
            </Text>
            <View style={styles.redeemRow}>
              <TextInput
                style={[styles.redeemInput, FONT]}
                placeholder="例：AB3X7K"
                placeholderTextColor={colors.textMuted}
                value={redeemInput}
                onChangeText={setRedeemInput}
                autoCapitalize="characters"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleRedeem}
              />
              <TouchableOpacity
                style={[styles.redeemBtn, (!redeemInput.trim() || redeemLoading) && styles.btnDim]}
                onPress={handleRedeem}
                disabled={!redeemInput.trim() || redeemLoading}
                activeOpacity={0.75}
              >
                <Text style={[styles.redeemBtnText, FONT]}>
                  {redeemLoading ? '綁定中…' : '綁　定'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>
      </View>}

      {/* 開發用除錯按鈕 — 只在開發環境顯示，除錯完成後應移除 */}
      {__DEV__ && !isViewerMode && (
        <View style={styles.devBlock}>
          <Text style={[styles.devLabel, FONT]}>開發除錯（僅本機可見）</Text>
          <TouchableOpacity
            style={[styles.devBtn, devSyncing && styles.btnDim]}
            onPress={handleDevSyncSettings}
            disabled={devSyncing}
            activeOpacity={0.75}
          >
            <Text style={[styles.devBtnText, FONT]}>
              {devSyncing ? '同步中…' : '同步設定到雲端'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.devBtn}
            onPress={handleDevResetInitFlag}
            activeOpacity={0.75}
          >
            <Text style={[styles.devBtnText, FONT]}>
              {devResetDone ? '已清除（可再次清除）' : '清除 localDataInitialized flag'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 登出 */}
      <View style={styles.signOutRow}>
        <View style={styles.signOutRule} />
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
          <Text style={[styles.signOutText, FONT]}>登　出</Text>
        </TouchableOpacity>
        <View style={styles.signOutRule} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 24 },

  sectionBlock: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  charBadge: {
    width: 22, height: 22, borderRadius: 3,
    borderWidth: 1.5, borderColor: colors.cinnabar,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(139,48,32,0.08)', flexShrink: 0,
  },
  charBadgeText: { fontSize: 11, color: colors.cinnabar, letterSpacing: 0, lineHeight: 14 },
  sectionTitle: { fontSize: 12, color: colors.textLabel, letterSpacing: 2, flexShrink: 0 },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.2 },

  listCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
    gap: 8,
  },
  listRowLast: { borderBottomWidth: 0 },
  lockedRow: { backgroundColor: colors.bgSection },

  rowNum: {
    fontSize: 10, color: colors.border,
    width: 18, textAlign: 'right', letterSpacing: 0.5, flexShrink: 0,
  },
  itemText: { fontSize: 14, color: colors.textPrimary, flex: 1, letterSpacing: 0.5 },
  lockedText: { color: colors.textMuted },
  emptyText: {
    fontSize: 13, color: colors.textMuted, flex: 1,
    textAlign: 'center', letterSpacing: 0.5, paddingVertical: 2,
  },

  // Inline edit input
  editInput: {
    flex: 1,
    borderWidth: 1, borderColor: colors.cinnabar, borderRadius: 3,
    backgroundColor: 'rgba(139,48,32,0.04)',
    paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 14, color: colors.textPrimary, letterSpacing: 0.5,
  },
  confirmBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 3, backgroundColor: colors.cinnabar,
    flexShrink: 0,
  },
  confirmText: { fontSize: 11, color: colors.white, letterSpacing: 1 },
  cancelInlineBtn: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 3, borderWidth: 1, borderColor: colors.border,
    flexShrink: 0,
  },
  cancelInlineText: { fontSize: 11, color: colors.textMuted, letterSpacing: 1 },

  // Row action buttons
  editBtn: { paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  editBtnText: { fontSize: 11, color: colors.gold, letterSpacing: 1, opacity: 0.9 },
  deleteBtn: { paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  deleteText: { fontSize: 11, color: colors.deleteRed, letterSpacing: 1, opacity: 0.85 },

  lockedTag: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 2, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.bg,
  },
  lockedTagText: { fontSize: 9, color: colors.textMuted, letterSpacing: 1 },

  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: colors.textPrimary, letterSpacing: 0.5,
  },
  addBtn: {
    backgroundColor: colors.header, borderRadius: 3,
    paddingVertical: 11, paddingHorizontal: 16,
    justifyContent: 'center', borderWidth: 1, borderColor: colors.gold, opacity: 0.92,
  },
  addBtnText: { color: colors.white, fontSize: 13, letterSpacing: 2 },

  shareBlock: { gap: 0 },
  shareCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 8, ...cardShadow,
  },
  shareSubTitle: {
    fontSize: 11, color: colors.textLabel, letterSpacing: 3,
  },
  shareHint: {
    fontSize: 11, color: colors.textMuted, letterSpacing: 0.5, lineHeight: 17, opacity: 0.85,
  },
  codeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2,
  },
  codeText: {
    fontSize: 28, color: colors.cinnabar, letterSpacing: 6, flex: 1,
  },
  shareCodeBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 3, borderWidth: 1,
    borderColor: colors.gold, backgroundColor: 'rgba(154,120,56,0.06)',
  },
  shareCodeBtnText: { fontSize: 12, color: colors.gold, letterSpacing: 2 },
  errorText: {
    fontSize: 12, color: colors.deleteRed, letterSpacing: 0.5,
  },
  generateBtn: {
    backgroundColor: colors.header, borderRadius: 3,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.gold, opacity: 0.92,
    marginTop: 2,
  },
  generateBtnText: { color: colors.white, fontSize: 13, letterSpacing: 2 },
  redeemRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  redeemInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 3,
    backgroundColor: colors.bg,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, color: colors.textPrimary, letterSpacing: 4,
  },
  redeemBtn: {
    backgroundColor: colors.cinnabar, borderRadius: 3,
    paddingVertical: 10, paddingHorizontal: 16, justifyContent: 'center',
  },
  redeemBtnText: { color: colors.white, fontSize: 13, letterSpacing: 2 },
  btnDim: { opacity: 0.45 },

  devBlock: {
    gap: 8, padding: 12, borderRadius: 4,
    borderWidth: 1, borderColor: colors.textMuted, borderStyle: 'dashed',
  },
  devLabel: { fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  devBtn: {
    borderWidth: 1, borderColor: colors.textMuted, borderRadius: 3,
    paddingVertical: 9, alignItems: 'center',
  },
  devBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 1 },

  signOutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8,
  },
  signOutRule: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.2 },
  signOutBtn: {
    borderWidth: 1, borderColor: `${colors.cinnabar}60`,
    borderRadius: 3, paddingVertical: 10, paddingHorizontal: 28,
    backgroundColor: 'rgba(139,48,32,0.06)',
  },
  signOutText: { fontSize: 13, color: colors.cinnabar, letterSpacing: 4, opacity: 0.85 },
});
