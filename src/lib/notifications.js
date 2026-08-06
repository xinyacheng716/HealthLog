import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANTICOAGULANT_ID = 'reminder_anticoagulant_daily';
const ANTICOAGULANT_EVENING_ID = 'reminder_anticoagulant_evening';
const BEEF_ESSENCE_ID = 'reminder_beef_essence_daily';
const MORPHINE_PATCH_KEY = 'notif_morphine_patch_id';
const NAIL_CLIP_ID = 'reminder_nail_clip';
const NAIL_CLIP_NEXT_AT_KEY = 'nextNailClipReminderAt';

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

// ── 情境 1c：每日牛肉精提醒（中午）──────────────────────────────────────────
// 與另外兩個抗凝血劑提醒同一套模式：固定 identifier、idempotent，各自獨立
// 判斷是否已排程。
export async function ensureBeefEssenceReminder() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const exists = scheduled.some((n) => n.identifier === BEEF_ESSENCE_ID);
    if (exists) return;

    await Notifications.scheduleNotificationAsync({
      identifier: BEEF_ESSENCE_ID,
      content: {
        title: '用藥提醒',
        body: '中午了，記得喝牛肉精。',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 12,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn('[Notifications] ensureBeefEssenceReminder:', e.message);
  }
}

// ── 情境 1c：每日牛肉精提醒 — 當天已勾選時取消 ─────────────────────────────
// 牛肉精用的是 DAILY 反覆觸發器（單一 identifier 代表「每天中午都會響」），
// 不是每天各自獨立的排程，所以不能只取消「今天那一次」。做法是：使用者在
// 每日用藥勾選牛肉精時，直接取消整個 DAILY 排程（今天不會再響）；等到
// 隔天 DailyMedScreen 重新載入、勾選狀態歸零，會偵測到未勾選並呼叫
// ensureBeefEssenceReminder() 補回排程（見 DailyMedScreen 的對應 useEffect）。
export async function cancelBeefEssenceReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(BEEF_ESSENCE_ID);
  } catch (e) {
    console.warn('[Notifications] cancelBeefEssenceReminder:', e.message);
  }
}

// ── 情境 2：嗎啡貼布換貼提醒 — 正式排程間隔 ─────────────────────────────────
// 正式邏輯：換貼提醒設在打勾後 1.5 天（36 小時）。
const MORPHINE_PATCH_INTERVAL_MS = 36 * 60 * 60 * 1000;

// ── 情境 2：嗎啡貼布換貼提醒 — 排程核心（供正式呼叫與除錯測試按鈕共用）───────
// 與 ensureAnticoagulantReminder() 一樣先確認權限——過去這裡漏了這段檢查，
// 權限未授權時 scheduleNotificationAsync 仍會「成功」排程，但系統永遠不會
// 真的跳出通知，而且不會有任何錯誤或警告，等於整條路徑靜默失效，見 devlog。
//
// 排查嗎啡貼布通知完全沒響過（但抗凝血劑每天正常響）：兩者用的 SchedulableTriggerInputTypes
// 不同，native 層轉換邏輯完全不同路徑——
// - DAILY（抗凝血劑）→ UNCalendarNotificationTrigger(dateMatching:...,repeats:true)，
//   由 iOS 用當下 wall-clock 比對「下一個 10:30」，不會有「已經是過去」的問題。
// - DATE（嗎啡貼布）→ Records.swift 的 DateTriggerRecord 把 JS 傳來的絕對時間戳，
//   轉成 date.timeIntervalSinceNow 後餵給 UNTimeIntervalNotificationTrigger（相對時間、
//   不重複）。如果這個轉換發生時算出來的秒數 <= 0（等於「目標時間已經過去」），
//   iOS 對 UNTimeIntervalNotificationTrigger 的行為是靜默不建立/不觸發，不會丟出任何
//   JS 看得到的錯誤——這與目前「零通知、零錯誤」的症狀完全吻合。
// 這裡在真正呼叫 scheduleNotificationAsync 之前，先用 Notifications.getNextTriggerDateAsync()
// 對同一個 trigger 設定值做一次「native 端會怎麼解讀」的乾跑，回傳結果供除錯比對：
// 如果 nextTriggerMs 是 null，代表 native 端當下就判定這個 trigger 不會觸發。
//
// triggerDate 由呼叫端算好傳入——這支函式本身不決定「多久之後」，讓正式的
// 1.5 天間隔跟除錯測試按鈕的「1～2 分鐘後」互相獨立，改其中一個不會動到另一個。
async function scheduleMorphinePatchReminderAt(triggerDate) {
  const debugInfo = { triggerDateISO: null, nextTriggerMs: null, nextTriggerISO: null, scheduledId: null };
  try {
    await cancelMorphinePatchReminder();

    debugInfo.triggerDateISO = triggerDate.toISOString();

    const triggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    };

    try {
      const nextTriggerMs = await Notifications.getNextTriggerDateAsync(triggerInput);
      debugInfo.nextTriggerMs = nextTriggerMs;
      debugInfo.nextTriggerISO = nextTriggerMs ? new Date(nextTriggerMs).toISOString() : null;
      if (nextTriggerMs === null) {
        console.warn('[Notifications] scheduleMorphinePatchReminderAt: getNextTriggerDateAsync 回傳 null——native 端判定此 trigger 不會觸發，triggerDateISO=' + debugInfo.triggerDateISO);
      }
    } catch (e) {
      console.warn('[Notifications] scheduleMorphinePatchReminderAt getNextTriggerDateAsync 失敗:', e.message);
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '換貼片提醒',
        body: '嗎啡貼布已使用 1.5 天，請記得更換新貼片。',
        sound: true,
      },
      trigger: triggerInput,
    });
    debugInfo.scheduledId = id;

    await AsyncStorage.setItem(MORPHINE_PATCH_KEY, id);
  } catch (e) {
    console.warn('[Notifications] scheduleMorphinePatchReminderAt:', e.message);
  }
  return debugInfo;
}

// ── 情境 2：嗎啡貼布換貼提醒 — 正式排程（打勾時呼叫）─────────────────────────
export async function scheduleMorphinePatchReminder() {
  const triggerDate = new Date(Date.now() + MORPHINE_PATCH_INTERVAL_MS);
  return scheduleMorphinePatchReminderAt(triggerDate);
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

// ── 情境 3：剪指甲提醒 — 固定週期（10.5 天）、不綁任何 UI 勾選框的獨立提醒 ──
// 跟每日抗凝血劑（DAILY、每天固定觸發）、嗎啡貼布（勾選才觸發、一次性）都
// 不一樣：這是「固定間隔、但間隔不是整數天」的一次性提醒，每次觸發後都要
// 往後推算下一次時間、重新排程一次——不能用 DAILY（間隔不是 1 天），也不能
// 用 seconds 觸發器往後推（累積誤差／App 沒開的時間不會走，時間點會慢慢
// 漂走，見 devlog 對嗎啡貼布 seconds 觸發器的討論）。改用 DATE 觸發器指定
// 精確日期時間，並把「下一次應該觸發的時間」存在 AsyncStorage，每次 App
// 啟動／回到前景都檢查一次是否過期、該往後推。
const NAIL_CLIP_INTERVAL_MS = 10.5 * 24 * 60 * 60 * 1000; // 10.5 天

// 從 fromDate 往後推 10.5 天，再把時間釘死在當天 22:00——用「加總毫秒數」
// 決定落在哪一天（10.5 天不是整數天，所以每次落地的星期幾會輪動），
// 但時間一律鎖定 22:00，不會被 fromDate 原本的時分秒影響。
function computeNextNailClipTime(fromDate) {
  const next = new Date(fromDate.getTime() + NAIL_CLIP_INTERVAL_MS);
  next.setHours(22, 0, 0, 0);
  return next;
}

// 排程核心（供正式呼叫與除錯測試按鈕共用）。固定 identifier，重排前先
// cancel 舊的，確保冪等性——不會因為重複呼叫疊加成好幾則通知。
async function scheduleNailClipReminderAt(triggerDate) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.cancelScheduledNotificationAsync(NAIL_CLIP_ID).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: NAIL_CLIP_ID,
      content: {
        title: '生活提醒',
        body: '該幫爸爸剪指甲了。',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch (e) {
    console.warn('[Notifications] scheduleNailClipReminderAt:', e.message);
  }
}

// ── 情境 3：剪指甲提醒 — 正式排程（App 啟動／回到前景時呼叫，idempotent）──
// - 第一次啟用（AsyncStorage 沒有存過）：從現在起算 10.5 天後的當天 22:00
// - 已存過但已過期（代表上一則應該已經發送過）：以「原訂時間」為基準往後
//   推 10.5 天，不是以「現在」往後推——避免使用者好幾天沒開 App 時，
//   間隔被拉長、22:00 這個時間點跟著漂走
// - 已存過且還沒到期：代表已經排程過，不重複排程
export async function ensureNailClipReminder() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const stored = await AsyncStorage.getItem(NAIL_CLIP_NEXT_AT_KEY);
    const storedAt = stored ? parseInt(stored, 10) : null;
    const now = Date.now();

    let nextAt;
    if (storedAt === null) {
      nextAt = computeNextNailClipTime(new Date(now)).getTime();
    } else if (storedAt <= now) {
      // App 可能隔了不只一個週期沒開（例如好幾個月），只往後推一次 10.5 天
      // 可能還是落在過去——DATE 觸發器如果排在過去的時間，iOS 會靜默不
      // 建立/不觸發、不會有任何錯誤（跟嗎啡貼布 seconds 觸發器踩過的坑
      // 是同一類問題，見上面 scheduleMorphinePatchReminderAt 的說明）。
      // 所以要一直往後推，推到真的落在未來為止，而不是只推一次。
      nextAt = storedAt;
      do {
        nextAt = computeNextNailClipTime(new Date(nextAt)).getTime();
      } while (nextAt <= now);
    } else {
      return;
    }

    await scheduleNailClipReminderAt(new Date(nextAt));
    await AsyncStorage.setItem(NAIL_CLIP_NEXT_AT_KEY, String(nextAt));
  } catch (e) {
    console.warn('[Notifications] ensureNailClipReminder:', e.message);
  }
}

