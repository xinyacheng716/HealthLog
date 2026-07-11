import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  TextInput, StyleSheet, Platform, SafeAreaView,
} from 'react-native';
import { colors } from '../constants/colors';

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

export default function SymptomMultiPicker({
  symptomList, value = [], onChange,
  placeholder = '── 請選擇症狀 ──',
  title = '選　擇　症　狀',
  allowOther = false,
}) {
  const effectiveList = (allowOther && !symptomList.includes('其他'))
    ? [...symptomList, '其他']
    : symptomList;

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [customText, setCustomText] = useState('');

  const scrollRef = useRef(null);
  const customInputRef = useRef(null);

  const hasOther = selected.includes('其他');

  // When 其他 is toggled on: scroll to bottom then focus AFTER Modal slide animation (~350ms)
  useEffect(() => {
    if (!hasOther) return;
    const scrollT = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    const focusT  = setTimeout(() => customInputRef.current?.focus(), 380);
    return () => { clearTimeout(scrollT); clearTimeout(focusT); };
  }, [hasOther]);

  function openModal() {
    const knownItems  = value.filter((s) => effectiveList.includes(s));
    const customItems = value.filter((s) => !effectiveList.includes(s));
    if (customItems.length > 0) {
      setSelected([...knownItems, '其他']);
      setCustomText(customItems.join('、'));
    } else {
      setSelected([...knownItems]);
      setCustomText('');
    }
    setModalOpen(true);
  }

  function confirm() {
    const result = selected.filter((s) => s !== '其他');
    if (selected.includes('其他')) {
      const custom = customText.trim();
      result.push(custom || '其他');
    }
    onChange(result);
    setModalOpen(false);
  }

  function toggle(item) {
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item],
    );
  }

  const displayText =
    value.length === 0
      ? null
      : value.length <= 2
        ? value.join('、')
        : `${value.slice(0, 2).join('、')} …等${value.length}項`;

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={openModal} activeOpacity={0.7}>
        <Text style={[styles.triggerText, value.length === 0 && styles.placeholder, FONT]}>
          {displayText || placeholder}
        </Text>
        <View style={styles.chevronWrap}>
          <View style={styles.chevronDiamond} />
        </View>
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="slide">
        {/*
          No KeyboardAvoidingView here — KAV inside a Modal causes layout bounce on iOS.
          Instead: automaticallyAdjustKeyboardInsets on the ScrollView handles inset,
          and we manually scrollToEnd + focus via ref after the slide animation finishes.
        */}
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetTopRule} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleWrap}>
                <View style={styles.sheetStamp} />
                <Text style={[styles.sheetTitle, FONT]}>{title}</Text>
                {value.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={[styles.countText, FONT]}>{value.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={confirm} style={styles.doneWrap}>
                <Text style={[styles.doneBtn, FONT]}>完　成</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.listScroll}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
              {effectiveList.map((item, idx) => {
                const isChecked = selected.includes(item);
                const isLast = idx === effectiveList.length - 1;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.row, isLast && styles.rowLast, isChecked && styles.rowChecked]}
                    onPress={() => toggle(item)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Text style={[styles.checkMark, FONT]}>選</Text>}
                    </View>
                    <Text style={[styles.rowText, FONT, isChecked && styles.rowTextChecked]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {hasOther && (
                <View style={styles.customWrap}>
                  <Text style={[styles.customLabel, FONT]}>自行輸入名稱</Text>
                  <TextInput
                    ref={customInputRef}
                    style={[styles.customInput, FONT]}
                    placeholder="請輸入名稱"
                    placeholderTextColor={colors.textMuted}
                    value={customText}
                    onChangeText={setCustomText}
                    returnKeyType="done"
                    onSubmitEditing={confirm}
                    blurOnSubmit
                  />
                </View>
              )}

              {/* Extra space so keyboard doesn't overlap last item */}
              <View style={{ height: hasOther ? 200 : 16 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 48,
  },
  triggerText: { fontSize: 15, color: colors.textPrimary, flex: 1, letterSpacing: 0.5, flexWrap: 'wrap' },
  placeholder: { color: colors.textMuted },
  chevronWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8, opacity: 0.6 },
  chevronDiamond: {
    width: 7, height: 7,
    borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderColor: colors.gold,
    transform: [{ rotate: '45deg' }, { translateY: -2 }],
  },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,20,16,0.55)' },
  sheet: { backgroundColor: colors.bg, maxHeight: '80%' },
  sheetTopRule: { height: 3, backgroundColor: colors.cinnabar, opacity: 0.9 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  sheetTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetStamp: {
    width: 10, height: 10, borderRadius: 2,
    borderWidth: 1.5, borderColor: colors.cinnabar,
    backgroundColor: 'rgba(139,48,32,0.12)',
  },
  sheetTitle: { fontSize: 13, color: colors.textLabel, letterSpacing: 3 },
  countBadge: { backgroundColor: colors.cinnabar, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, marginLeft: 4 },
  countText: { fontSize: 11, color: colors.white, letterSpacing: 0.5 },
  doneWrap: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: colors.cinnabar, borderRadius: 3 },
  doneBtn: { fontSize: 13, color: colors.white, letterSpacing: 2 },

  listScroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
    gap: 14, backgroundColor: colors.bgCard,
  },
  rowLast: { borderBottomWidth: 0 },
  rowChecked: { backgroundColor: colors.cinnabarFaint },
  checkbox: {
    width: 22, height: 22, borderRadius: 3,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent', flexShrink: 0,
  },
  checkboxChecked: { borderColor: colors.cinnabar, backgroundColor: colors.cinnabar },
  checkMark: { fontSize: 10, color: colors.white, lineHeight: 13, letterSpacing: 0 },
  rowText: { fontSize: 16, color: colors.textPrimary, letterSpacing: 0.5, flex: 1 },
  rowTextChecked: { color: colors.cinnabar, fontWeight: '500' },

  customWrap: {
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: colors.bgSection,
    borderTopWidth: 1, borderTopColor: colors.borderFaint,
    gap: 8,
  },
  customLabel: { fontSize: 11, color: colors.textLabel, letterSpacing: 2 },
  customInput: {
    borderWidth: 1, borderColor: colors.cinnabar, borderRadius: 3,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary, letterSpacing: 0.5,
  },
});
