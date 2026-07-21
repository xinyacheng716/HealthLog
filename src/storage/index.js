import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import {
  SYMPTOMS_DEFAULT, MEDS_DEFAULT, ALLERGY_DEFAULT, SETTINGS_VERSION, REMOVED_ITEMS,
  MEDICAL_HISTORY_DEFAULT, HOSPITAL_DEFAULT, VISIT_TYPE_DEFAULT, DOCTOR_DEFAULT,
} from '../constants/defaults';
import {
  pushSymptomLogToCloud,
  pushDailyMedCheckToCloud,
  pushAppointmentToCloud,
  pushConsultMemoToCloud,
} from '../lib/cloudSync';

const KEYS = {
  settings: 'settings',
  logs: 'logs',
  dailyMed: (date) => `dailyMed_${date}`,
  medicalHistory: 'medicalHistory',
};

const REMOVED_SET = new Set(REMOVED_ITEMS);

// 遷移時移除指定的廢棄項目（保留使用者自行新增的其他項目）。
// 這是唯一允許「自動修改本機清單內容」的地方，且受版本號嚴格把關——
// 只在 storedVersion < SETTINGS_VERSION 時執行一次，不是每次讀取都做。
function pruneRemoved(list) {
  return list.filter((item) => !REMOVED_SET.has(item));
}

// '其他' 是症狀／醫院清單 UI 上固定、不可刪除的結構性標記（用來觸發畫面上
// 「新增症狀」「新增醫院」那個鎖定列），不是使用者可以刪除的一般清單內容，
// 所以永遠確保它存在且排在最後。這跟下面「不再自動補回被刪除的預設項目」
// 是兩件事，互不衝突。
function withOtherLast(list) {
  return [...list.filter((x) => x !== '其他'), '其他'];
}

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.settings);

    // 本機從未存過 settings（全新裝置、首次使用）：只有這個情況才用預設值
    // 當起始清單。不在這裡寫回 AsyncStorage——由呼叫端（例如 useSettings 的
    // 雲端 hydration）決定何時真正落地首次資料。
    if (raw === null) {
      return {
        symptomList: SYMPTOMS_DEFAULT,
        medList: MEDS_DEFAULT,
        allergyList: ALLERGY_DEFAULT,
        hospitalList: HOSPITAL_DEFAULT,
        visitTypeList: VISIT_TYPE_DEFAULT,
        doctorList: DOCTOR_DEFAULT,
        hasLocalData: false,
      };
    }

    const parsed = JSON.parse(raw);
    const storedVersion = typeof parsed.version === 'number' ? parsed.version : 0;
    const migrating = storedVersion < SETTINGS_VERSION;

    // 本機已經存過 settings（不管內容是什麼，包含空陣列）：完全信任本機內容，
    // 不再拿預設值陣列去比對、補值——使用者的刪除是有意義的，不是資料缺漏。
    let symptomList   = Array.isArray(parsed.symptomList)   ? parsed.symptomList   : SYMPTOMS_DEFAULT;
    let medList       = Array.isArray(parsed.medList)       ? parsed.medList       : MEDS_DEFAULT;
    let allergyList   = Array.isArray(parsed.allergyList)   ? parsed.allergyList   : ALLERGY_DEFAULT;
    let hospitalList  = Array.isArray(parsed.hospitalList)  ? parsed.hospitalList  : HOSPITAL_DEFAULT;
    let visitTypeList = Array.isArray(parsed.visitTypeList) ? parsed.visitTypeList : VISIT_TYPE_DEFAULT;
    let doctorList    = Array.isArray(parsed.doctorList)    ? parsed.doctorList    : DOCTOR_DEFAULT;

    // 版本遷移：精準移除指定的廢棄項目（保留使用者自行新增的其他項目）
    if (migrating) {
      symptomList = pruneRemoved(symptomList);
      medList     = pruneRemoved(medList);
      allergyList = pruneRemoved(allergyList);
    }

    symptomList  = withOtherLast(symptomList);
    hospitalList = withOtherLast(hospitalList);

    // 只有版本遷移真的動到內容時才需要回寫；平常讀取不再因為「清單長度跟
    // 預設值不同」而觸發不必要的寫回——那正是舊版 bug（把使用者刪除的
    // 預設項目自動復活、還永久寫回 AsyncStorage）的來源。
    if (migrating) {
      await saveSettings({ symptomList, medList, allergyList, hospitalList, visitTypeList, doctorList });
    }

    return {
      symptomList, medList, allergyList, hospitalList, visitTypeList, doctorList,
      hasLocalData: true,
    };
  } catch {}
  return {
    symptomList: SYMPTOMS_DEFAULT,
    medList: MEDS_DEFAULT,
    allergyList: ALLERGY_DEFAULT,
    hospitalList: HOSPITAL_DEFAULT,
    visitTypeList: VISIT_TYPE_DEFAULT,
    doctorList: DOCTOR_DEFAULT,
    hasLocalData: false,
  };
}

export async function saveSettings(settings) {
  try {
    // 每次寫入都標記目前版本，遷移後就不會重複觸發。
    await AsyncStorage.setItem(
      KEYS.settings,
      JSON.stringify({ ...settings, version: SETTINGS_VERSION }),
    );
  } catch {}
}

// 病歷：只有在 key 完全不存在（從未寫入）時才帶入預設資料；
// 一旦使用者有任何資料（含空陣列）就不再覆蓋。
export async function loadMedicalHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.medicalHistory);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } else {
      // 首次啟動：帶入預設並補上 uuid，寫回 AsyncStorage
      const seeded = MEDICAL_HISTORY_DEFAULT.map((group) => ({
        year: group.year,
        records: group.records.map((r) => ({ id: uuidv4(), ...r })),
      }));
      await saveMedicalHistory(seeded);
      return seeded;
    }
  } catch {}
  return [];
}

export async function saveMedicalHistory(history) {
  try {
    await AsyncStorage.setItem(KEYS.medicalHistory, JSON.stringify(history));
  } catch {}
}

export async function loadLogs() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.logs);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function saveLogs(logs, newLog = null) {
  try {
    await AsyncStorage.setItem(KEYS.logs, JSON.stringify(logs));
    if (newLog) pushSymptomLogToCloud(newLog);
  } catch {}
}

export async function loadDailyMed(date) {
  try {
    const raw = await AsyncStorage.getItem(KEYS.dailyMed(date));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { date, checked: {} };
}

export async function saveDailyMed(date, checked) {
  try {
    await AsyncStorage.setItem(KEYS.dailyMed(date), JSON.stringify({ date, checked }));
    pushDailyMedCheckToCloud({ date, checked });
  } catch {}
}

// 只寫本機、不推雲端——給「剛從雲端拉回資料、要落地存本機」的情境用，
// 避免拉下來又立刻推回去的空轉請求。
export async function saveDailyMedLocalOnly(date, checked) {
  try {
    await AsyncStorage.setItem(KEYS.dailyMed(date), JSON.stringify({ date, checked }));
  } catch {}
}

export async function loadAppointments() {
  try {
    const raw = await AsyncStorage.getItem('appointments');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function saveAppointments(list, newAppointment = null) {
  try {
    await AsyncStorage.setItem('appointments', JSON.stringify(list));
    if (newAppointment) pushAppointmentToCloud(newAppointment);
  } catch {}
}

// 只寫本機、不推雲端——給「剛從雲端拉回資料、要落地存本機」的情境用，
// 避免拉下來又立刻推回去的空轉請求。
export async function saveAppointmentsLocalOnly(list) {
  try {
    await AsyncStorage.setItem('appointments', JSON.stringify(list));
  } catch {}
}

export async function loadConsultMemo(date) {
  try {
    return (await AsyncStorage.getItem(`consultMemo_${date}`)) || '';
  } catch {}
  return '';
}

export async function saveConsultMemo(date, text) {
  try {
    if (text) {
      await AsyncStorage.setItem(`consultMemo_${date}`, text);
    } else {
      await AsyncStorage.removeItem(`consultMemo_${date}`);
    }
    pushConsultMemoToCloud(date, text);
  } catch {}
}

// Returns a Set<"YYYY-MM-DD"> of dates that have at least one checked item
export async function loadMarkedDates() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const medKeys = allKeys.filter((k) => k.startsWith('dailyMed_'));
    if (medKeys.length === 0) return new Set();
    const pairs = await AsyncStorage.multiGet(medKeys);
    const marked = new Set();
    for (const [key, value] of pairs) {
      if (!value) continue;
      try {
        const data = JSON.parse(value);
        if (Object.values(data.checked || {}).some(Boolean)) {
          marked.add(key.replace('dailyMed_', ''));
        }
      } catch {}
    }
    return marked;
  } catch {}
  return new Set();
}
