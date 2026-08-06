import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, Keyboard, AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadConsultMemo, saveConsultMemo, saveConsultMemoLocalOnly } from '../storage';
import { fetchOwnerConsultMemo } from '../lib/viewerData';
import { useAuth } from '../context/AuthContext';
import { colors, cardShadow } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

// Text is "effectively empty" if it contains only bullets/whitespace (nothing real typed)
function effectivelyEmpty(t) {
  return t.replace(/[•\s\n]/g, '').length === 0;
}

// TextInput 收合狀態下（空白或只有一兩行）給一個看起來像正常筆記欄位的
// 最小高度，而不是每次都貼著文字量縮到極小。
const MIN_INPUT_HEIGHT = 66;

export default function ConsultationMemo({ date, ownerId = null, readOnly = false }) {
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  // TextInput 高度跟著實際內容自動調整（onContentSizeChange），不再用
  // flex/minHeight 撐滿整張卡片——撐滿卡片會讓「點文字下方一大片空白」也
  // 落在 TextInput 的觸控範圍內、跟著跳出鍵盤，使用者滑動/點卡片其他地方
  // 常常誤觸。改成內容多高、輸入框就多高，卡片其餘留白區域不掛任何 TextInput。
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const inputRef = useRef(null);

  // Load when date or ownerId changes
  useEffect(() => {
    if (!date) { setText(''); return; }
    if (ownerId) {
      fetchOwnerConsultMemo(ownerId, date).then(setText);
    } else {
      loadConsultMemo(date).then(setText);
    }
  }, [date, ownerId]);

  // Auto-save 600ms after last keystroke (skip in readOnly or viewer mode)
  useEffect(() => {
    if (!date || readOnly || ownerId) return;
    const toSave = effectivelyEmpty(text) ? '' : text;
    const timer = setTimeout(() => saveConsultMemo(date, toSave), 600);
    return () => clearTimeout(timer);
  }, [text, date, readOnly, ownerId]);

  // Owner 模式：畫面目前實際顯示的日期／是否正在編輯，讓非同步的雲端拉取
  // 回呼能拿到解析當下的最新值，而不是呼叫當下那次 render 關閉住的舊值。
  // 比照 DailyMedScreen 的 activeDateRef 模式。
  const dateRef = useRef(date);
  useEffect(() => { dateRef.current = date; }, [date]);
  const focusedRef = useRef(focused);
  useEffect(() => { focusedRef.current = focused; }, [focused]);

  // Owner 模式：重新從雲端拉取「本人」這一天的問診備忘，寫回本機快取並直接
  // 更新畫面 state（不是只寫本機、等下次掛載被動撿到）。AppState 前景轉換、
  // 畫面 focus 兩個觸發來源共用這支函式，比照 daily med / appointments
  // （Build 31/32）的做法。viewer mode 已經是每次 date/ownerId 改變就直接
  // 讀雲端（見上面的 load effect），不需要這層。
  async function refreshConsultMemoFromCloud(dateAtCallTime) {
    const selfOwnerId = session?.user?.id;
    if (!selfOwnerId) return;
    try {
      const content = await fetchOwnerConsultMemo(selfOwnerId, dateAtCallTime);
      await saveConsultMemoLocalOnly(dateAtCallTime, content);
      // 拉取期間使用者瀏覽的日期已經變了，這次拉到的資料是舊日期的，
      // 不能拿來覆蓋畫面目前顯示的（新）日期。
      if (dateAtCallTime !== dateRef.current) return;
      // 使用者正在輸入中（尚未經過 600ms debounce 落地）：這時用雲端資料
      // 覆蓋畫面會蓋掉還沒存出去的內容，先跳過，等下次觸發再拉。
      if (focusedRef.current) return;
      setText(content);
    } catch (e) {
      console.warn('[ConsultationMemo] 重新拉取問診備忘失敗，保留本機狀態:', e.message);
    }
  }

  // Owner 模式：畫面每次取得 focus（含第一次掛載／冷啟動）都重新拉取一次。
  useFocusEffect(useCallback(() => {
    if (ownerId || readOnly || !date) return;
    refreshConsultMemoFromCloud(date);
  }, [ownerId, readOnly, date, session?.user?.id]));

  // Owner 模式：App 從背景切回前景時，同樣重新拉取一次，避免多裝置間
  // 問診備忘不同步。
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (ownerId || readOnly) return undefined;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const cameToForeground = appStateRef.current !== 'active' && nextAppState === 'active';
      appStateRef.current = nextAppState;
      if (!cameToForeground || !date) return;
      refreshConsultMemoFromCloud(date);
    });

    return () => subscription.remove();
  }, [ownerId, readOnly, date, session?.user?.id]);

  function handleFocus() {
    if (text === '') setText('• ');
    setFocused(true);
  }

  function handleChangeText(newText) {
    // Auto-add bullet point after Enter
    if (newText.length === text.length + 1 && newText.endsWith('\n')) {
      setText(newText + '• ');
    } else {
      setText(newText);
    }
  }

  function addBullet() {
    let next;
    if (text === '' || effectivelyEmpty(text)) {
      next = '• ';
    } else if (text.endsWith('\n')) {
      next = text + '• ';
    } else {
      next = text + '\n• ';
    }
    setText(next);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleDone() {
    Keyboard.dismiss();
    setFocused(false);
  }

  function handleContentSizeChange(e) {
    setInputHeight(Math.max(MIN_INPUT_HEIGHT, e.nativeEvent.contentSize.height));
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stamp}>
          <Text style={[styles.stampText, FONT]}>備</Text>
        </View>
        <Text style={[styles.title, FONT]}>問　診　備　忘</Text>
        <View style={styles.rule} />

        {!readOnly && focused && (
          <TouchableOpacity onPress={handleDone} hitSlop={8} style={styles.doneBtn}>
            <Text style={[styles.doneBtnText, FONT]}>完　成</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Input area with ruled-line decoration. inputWrap 維持固定高度只是
          裝飾用的格線背景；TextInput 本身高度貼著內容（見 inputHeight），
          兩者不相等時，inputWrap 裡格線以下、TextInput 範圍外的留白純粹是
          背景 View，不掛觸控事件，點下去不會跳鍵盤。 */}
      <View style={styles.inputWrap}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.ruledLine, { top: 22 + i * 22 }]} />
        ))}
        <TextInput
          ref={inputRef}
          style={[styles.input, FONT, { height: inputHeight }]}
          multiline
          placeholder={readOnly ? '（無備忘記錄）' : '• 記下想問醫生的問題\n• 需帶的資料、檢查結果…'}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={readOnly ? undefined : handleChangeText}
          onContentSizeChange={handleContentSizeChange}
          textAlignVertical="top"
          scrollEnabled={false}
          onFocus={readOnly ? undefined : handleFocus}
          onBlur={readOnly ? undefined : () => setFocused(false)}
          editable={!readOnly}
        />
      </View>

      {/* 新增一項 — 明確的操作入口，取代原本「點卡片空白處」觸發 focus 的
          舊行為。點下去才 append 換行（或首次輸入的話直接開一個新項目）+
          focus 到內容尾端。hidden in readOnly。 */}
      {!readOnly && (
        <TouchableOpacity onPress={addBullet} hitSlop={6} style={styles.addRow} activeOpacity={0.6}>
          <Text style={[styles.addRowText, FONT]}>＋　新增一項</Text>
        </TouchableOpacity>
      )}

      {/* Character count */}
      {text.length > 0 && !focused && (
        <Text style={[styles.counter, FONT]}>{text.length} 字</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fdf8ee',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 14,
    gap: 10,
    ...cardShadow,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  stamp: {
    width: 22,
    height: 22,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(154,120,56,0.08)',
    flexShrink: 0,
  },
  stampText: { fontSize: 11, color: colors.gold, lineHeight: 14 },
  title: { fontSize: 12, color: colors.textLabel, letterSpacing: 2, flexShrink: 0 },
  rule: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.2 },

  doneBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: colors.cinnabar,
  },
  doneBtnText: {
    fontSize: 11,
    color: colors.white,
    letterSpacing: 2,
  },

  // inputWrap 維持固定 minHeight 只是為了背景格線的視覺效果一直鋪滿；
  // 實際可觸控、會 focus 的範圍是 TextInput 自己的 height（見 input 樣式），
  // 兩者不必相等——inputWrap 裡格線以下、TextInput 高度以外的部分只是
  // 背景 View，沒有掛任何觸控事件。
  inputWrap: {
    minHeight: 132,
    position: 'relative',
  },
  ruledLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.12,
  },
  input: {
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    lineHeight: 22,
    padding: 0,
    zIndex: 1,
  },

  addRow: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  addRowText: {
    fontSize: 12,
    color: colors.gold,
    letterSpacing: 1,
    opacity: 0.85,
  },

  counter: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
});
