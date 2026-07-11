import React, { useState, useContext } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  TextInput, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import SymptomMultiPicker from '../components/SymptomMultiPicker';
import PeriodTimeField, { periodStartTime } from '../components/PeriodTimeField';
import Section from '../components/Section';
import { colors, cardShadow } from '../constants/colors';
import { LogsContext, SettingsContext } from '../context';
import { useViewer } from '../context/ViewerContext';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

export default function RecordScreen() {
  const { symptomList, medList } = useContext(SettingsContext);
  const { addLog } = useContext(LogsContext);
  const { isViewerMode } = useViewer();
  const insets = useSafeAreaInsets();

  if (isViewerMode) {
    return (
      <View style={styles.viewerWrap}>
        <View style={styles.viewerBox}>
          <View style={styles.viewerStamp}>
            <Text style={[styles.viewerStampChar, FONT]}>閱</Text>
          </View>
          <Text style={[styles.viewerTitle, FONT]}>目前為查看模式</Text>
          <Text style={[styles.viewerHint, FONT]}>無法在查看他人記錄時新增症狀紀錄</Text>
          <Text style={[styles.viewerHint, FONT]}>請在上方切換回「查看自己」</Text>
        </View>
      </View>
    );
  }

  const [symptoms, setSymptoms] = useState([]);
  const [startTime, setStartTime] = useState(() => periodStartTime());
  const [selfMeds, setSelfMeds] = useState([]);
  const [note, setNote] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);

  const canSubmit = symptoms.length > 0;

  function handleSubmit() {
    addLog({
      id: uuidv4(),
      symptoms,
      severity: 5,
      startTime,
      selfMeds,
      note: note.trim() || null,
      endTime: null,
      doctorDiagnosis: null,
      doctorMed: null,
      reliefSeverity: null,
      reliefNote: null,
    });
    setSymptoms([]);
    setStartTime(periodStartTime());
    setSelfMeds([]);
    setNote('');
  }

  return (
    // 鍵盤處理：iOS 用 automaticallyAdjustKeyboardInsets（自動把 focus 的欄位捲到鍵盤上方），
    // Android 用預設 adjustResize。不要再疊 KeyboardAvoidingView 或手動 scrollToEnd，否則會重複位移。
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      {/* 症狀（多選） */}
      <View style={[styles.fieldCard, cardShadow]}>
        <Section title="症　　狀">
          <SymptomMultiPicker
            symptomList={symptomList}
            value={symptoms}
            onChange={setSymptoms}
          />
        </Section>
      </View>

      {/* 開始時間 */}
      <View style={[styles.fieldCard, cardShadow]}>
        <Section title="開　始　時　間">
          <PeriodTimeField value={startTime} onChange={setStartTime} />
          <Text style={[styles.hint, FONT]}>自動依當下時間判斷上午／中午／下午，可按「調整」修改</Text>
        </Section>
      </View>

      {/* 自行服藥（多選） */}
      <View style={[styles.fieldCard, cardShadow]}>
        <Section title="當　下　自　行　服　藥">
          <SymptomMultiPicker
            symptomList={medList}
            value={selfMeds}
            onChange={setSelfMeds}
            placeholder="── 未服藥（點選以記錄）──"
            title="選　擇　服　藥"
            allowOther
          />
        </Section>
      </View>

      {/* 備註 */}
      <View style={[styles.fieldCard, cardShadow]}>
        <Section title="備　　　註">
          <View style={styles.noteHead}>
            <Text style={[styles.hint, styles.noteHint, FONT]}>可記錄其他細節，例如誘發原因、伴隨症狀</Text>
            {noteFocused && (
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => Keyboard.dismiss()}
                activeOpacity={0.7}
              >
                <Text style={[styles.doneText, FONT]}>完　成</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.noteInput, FONT]}
            value={note}
            onChangeText={setNote}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
            placeholder="例：飯後散步時開始，伴隨輕微咳嗽"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </Section>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {canSubmit && (
          <>
            <View style={styles.btnCornerTL} />
            <View style={styles.btnCornerBR} />
          </>
        )}
        <Text style={[styles.submitText, FONT]}>記　　錄</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 14, gap: 8 },

  viewerWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  viewerBox: {
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,48,32,0.25)',
    borderRadius: 4,
    padding: 32,
    backgroundColor: 'rgba(139,48,32,0.04)',
  },
  viewerStamp: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(139,48,32,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  viewerStampChar: {
    fontSize: 22,
    color: colors.cinnabar,
    opacity: 0.7,
  },
  viewerTitle: {
    fontSize: 16,
    color: colors.cinnabar,
    letterSpacing: 3,
    opacity: 0.85,
  },
  viewerHint: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  noteHint: {
    marginTop: 0,
    flex: 1,
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.cinnabar,
    marginLeft: 10,
  },
  doneText: {
    fontSize: 12,
    color: colors.cinnabar,
    letterSpacing: 2,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    minHeight: 80,
    lineHeight: 22,
  },

  fieldCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },

  hint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 5,
    letterSpacing: 1,
    opacity: 0.8,
  },

  submitBtn: {
    backgroundColor: colors.cinnabar,
    borderRadius: 3,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(154,120,56,0.5)',
    position: 'relative',
    overflow: 'hidden',
    ...cardShadow,
    shadowColor: colors.cinnabar,
    shadowOpacity: 0.3,
  },
  submitDisabled: {
    backgroundColor: colors.btnDisabled,
    borderColor: colors.btnDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    color: colors.white,
    fontSize: 18,
    letterSpacing: 8,
  },
  btnCornerTL: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 8,
    height: 8,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: 'rgba(196,160,88,0.6)',
  },
  btnCornerBR: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 8,
    height: 8,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: 'rgba(196,160,88,0.6)',
  },
});
