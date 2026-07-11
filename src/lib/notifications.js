import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANTICOAGULANT_ID = 'reminder_anticoagulant_daily';
const ANTICOAGULANT_EVENING_ID = 'reminder_anticoagulant_evening';
const MORPHINE_PATCH_KEY = 'notif_morphine_patch_id';

// ── 請求通知授權 ──────────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  try {
    const { status: current } = await Notifications.getPermissionsAsync();
    if (current === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[Notifications] requestPermission:', e.message);
    return false;
  }
}

// ── 情境 1：每日抗凝血藥物提醒 ───────────────────────────────────────────────
// 使用固定 identifier，idempotent — 若已存在排程則直接跳過。
export async function ensureAnticoagulantReminder() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const exists = scheduled.some((n) => n.identifier === ANTICOAGULANT_ID);
    if (exists) return;

    await Notifications.scheduleNotificationAsync({
      identifier: ANTICOAGULANT_ID,
      content: {
        title: '用藥提醒',
        body: '今日抗凝血藥物尚未服用，請記得服藥。',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 10,
        minute: 30,
      },
    });
  } catch (e) {
    console.warn('[Notifications] ensureAnticoagulantReminder:', e.message);
  }
}

// ── 情境 1b：每日抗凝血藥物提醒（晚間）───────────────────────────────────────
// 與 ensureAnticoagulantReminder() 各自獨立判斷是否已排程，互不影響。
export async function ensureAnticoagulantEveningReminder() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const exists = scheduled.some((n) => n.identifier === ANTICOAGULANT_EVENING_ID);
    if (exists) return;

    await Notifications.scheduleNotificationAsync({
      identifier: ANTICOAGULANT_EVENING_ID,
      content: {
        title: '用藥提醒',
        body: '晚間用藥提醒：今日抗凝血藥物尚未服用，請記得服藥。',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 22,
        minute: 30,
      },
    });
  } catch (e) {
    console.warn('[Notifications] ensureAnticoagulantEveningReminder:', e.message);
  }
}

// ── 情境 2：嗎啡貼布換貼提醒 — 排程 ─────────────────────────────────────────
export async function scheduleMorphinePatchReminder() {
  try {
    await cancelMorphinePatchReminder();

    const triggerDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '換貼片提醒',
        body: '嗎啡貼布已使用 2 天，請記得更換新貼片。',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    await AsyncStorage.setItem(MORPHINE_PATCH_KEY, id);
  } catch (e) {
    console.warn('[Notifications] scheduleMorphinePatchReminder:', e.message);
  }
}

// ── 情境 2：嗎啡貼布換貼提醒 — 取消 ─────────────────────────────────────────
export async function cancelMorphinePatchReminder() {
  try {
    const id = await AsyncStorage.getItem(MORPHINE_PATCH_KEY);
    if (!id) return;
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(MORPHINE_PATCH_KEY);
  } catch (e) {
    console.warn('[Notifications] cancelMorphinePatchReminder:', e.message);
  }
}
