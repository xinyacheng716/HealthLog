import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, Alert, Keyboard,
} from 'react-native';
import { loadConsultMemo, saveConsultMemo } from '../storage';
import { fetchOwnerConsultMemo } from '../lib/viewerData';
import { colors, cardShadow } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

// Text is "effectively empty" if it contains only bullets/whitespace (nothing real typed)
function effectivelyEmpty(t) {
  return t.replace(/[•\s\n]/g, '').length === 0;
}

export default function ConsultationMemo({ date, ownerId = null, readOnly = false }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
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

  function handleClear() {
    Alert.alert(
      '清空備忘',
      '確定要清空本頁備忘內容？',
      [
        { text: '取消', style: 'cancel' },
        { text: '清空', style: 'destructive', onPress: () => setText('') },
      ],
    );
  }

  function handleDone() {
    Keyboard.dismiss();
    setFocused(false);
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

        {/* ＋ 條目 — hidden in readOnly */}
        {!readOnly && (
          <TouchableOpacity onPress={addBullet} hitSlop={8} style={styles.bulletBtn}>
            <Text style={[styles.bulletBtnText, FONT]}>＋ 條目</Text>
          </TouchableOpacity>
        )}

        {!readOnly && (focused ? (
          <TouchableOpacity onPress={handleDone} hitSlop={8} style={styles.doneBtn}>
            <Text style={[styles.doneBtnText, FONT]}>完　成</Text>
          </TouchableOpacity>
        ) : !effectivelyEmpty(text) ? (
          <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
            <Text style={[styles.clearText, FONT]}>清空</Text>
          </TouchableOpacity>
        ) : null)}
      </View>

      {/* Input area with ruled-line decoration */}
      <View style={styles.inputWrap}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.ruledLine, { top: 22 + i * 22 }]} />
        ))}
        <TextInput
          ref={inputRef}
          style={[styles.input, FONT]}
          multiline
          placeholder={readOnly ? '（無備忘記錄）' : '• 記下想問醫生的問題\n• 需帶的資料、檢查結果…'}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={readOnly ? undefined : handleChangeText}
          textAlignVertical="top"
          scrollEnabled={false}
          onFocus={readOnly ? undefined : handleFocus}
          onBlur={readOnly ? undefined : () => setFocused(false)}
          editable={!readOnly}
        />
      </View>

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

  bulletBtn: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(154,120,56,0.07)',
  },
  bulletBtnText: {
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 1,
  },
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
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.deleteRed,
    backgroundColor: 'rgba(139,32,32,0.04)',
  },
  clearText: {
    fontSize: 11,
    color: colors.deleteRed,
    letterSpacing: 1,
    opacity: 0.85,
  },

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
    minHeight: 132,
    zIndex: 1,
  },

  counter: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
});
