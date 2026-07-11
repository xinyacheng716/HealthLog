import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchOwnerLogs,
  fetchOwnerAppointments,
  fetchOwnerMedicalHistory,
  fetchOwnerDailyMedChecksSince,
  fetchOwnerConsultMemosSince,
} from './viewerData';

const LOCAL_DATA_INIT_FLAG = 'localDataInitialized_v5';
const RECENT_DAYS = 90;

function daysAgoDateString(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// "2026-06-21T21:03:00+00:00" → "2026/06/21 21:03"；已經是本機格式（含 "/"）就原樣回傳
function toLocalTimeFormat(s) {
  if (!s) return null;
  if (s.includes('/')) return s;
  return s.slice(0, 16).replace('T', ' ').replace(/-/g, '/');
}

// 確保每筆 log 存進本機前是 LogsContext 預期的格式：
// symptoms/selfMeds 為陣列（而非「、」分隔字串），startTime/endTime 為 "YYYY/MM/DD HH:MM"
function normalizeLogForLocal(log) {
  const symptoms = Array.isArray(log.symptoms) && log.symptoms.length > 0
    ? log.symptoms
    : (typeof log.symptom === 'string' && log.symptom ? log.symptom.split('、') : []);
  const selfMeds = Array.isArray(log.selfMeds) && log.selfMeds.length > 0
    ? log.selfMeds
    : (typeof log.selfMed === 'string' && log.selfMed ? log.selfMed.split('、') : []);

  return {
    ...log,
    symptoms,
    selfMeds,
    startTime: toLocalTimeFormat(log.startTime),
    endTime: toLocalTimeFormat(log.endTime),
  };
}

// 注意：settings 六個清單（symptomList/medList/...）不在這支檔案處理。
// 那六個清單的雲端拉取+覆蓋本機 state 由 useSettings.js 自己負責（每次登入都做，
// 不受下方的 LOCAL_DATA_INIT_FLAG 一次性 gate 影響）。原本這裡也會把它們寫回
// AsyncStorage，但那只會覆蓋 AsyncStorage、不會同步更新 useSettings 已經 mount
// 的 React state，兩邊各自為政會造成畫面顯示跟實際雲端資料不一致的 race condition。

// 新裝置登入首次初始化：把 Supabase 上該帳號的資料整批拉回 AsyncStorage。
// logs / appointments / medicalHistory / dailyMed / consultMemo 是病患自己輸入、
// 可能還沒同步上雲的資料，本機已有資料的裝置（既有裝置在此功能上線後第一次登入）
// 不會被雲端覆蓋，只會直接標記完成。
export async function initializeLocalDataFromCloudIfNeeded(userId) {
  if (!userId) return;
  try {
    const done = await AsyncStorage.getItem(LOCAL_DATA_INIT_FLAG);
    if (done) return;

    const existingLogs = await AsyncStorage.getItem('logs');
    if (existingLogs) {
      await AsyncStorage.setItem(LOCAL_DATA_INIT_FLAG, 'true');
      console.log('[initSync] local logs already exist — skipped pulling logs/appointments/medicalHistory/dailyMed/consultMemo');
      return;
    }

    console.log('[initSync] calling fetchOwnerLogs for userId:', userId);
    const rawLogs = await fetchOwnerLogs(userId);
    const logs = rawLogs.map(normalizeLogForLocal);
    console.log('[initSync] fetchOwnerLogs returned', logs.length, 'logs, normalized for local storage:', JSON.stringify(logs));

    const appointments = await fetchOwnerAppointments(userId);
    const medicalHistory = await fetchOwnerMedicalHistory(userId);

    await AsyncStorage.setItem('logs', JSON.stringify(logs));
    await AsyncStorage.setItem('appointments', JSON.stringify(appointments));
    await AsyncStorage.setItem('medicalHistory', JSON.stringify(medicalHistory));

    const since = daysAgoDateString(RECENT_DAYS);

    const dailyMedChecks = await fetchOwnerDailyMedChecksSince(userId, since);
    for (const row of dailyMedChecks) {
      await AsyncStorage.setItem(
        `dailyMed_${row.check_date}`,
        JSON.stringify({ date: row.check_date, checked: row.checked || {} }),
      );
    }

    const consultMemos = await fetchOwnerConsultMemosSince(userId, since);
    for (const row of consultMemos) {
      if (row.content) {
        await AsyncStorage.setItem(`consultMemo_${row.memo_date}`, row.content);
      }
    }

    await AsyncStorage.setItem(LOCAL_DATA_INIT_FLAG, 'true');
    console.log('[initSync] local data initialized from cloud:', {
      logs: logs.length,
      appointments: appointments.length,
      medicalHistoryYears: medicalHistory.length,
      dailyMedChecks: dailyMedChecks.length,
      consultMemos: consultMemos.length,
    });
  } catch (e) {
    console.warn('[initSync] initializeLocalDataFromCloudIfNeeded failed:', e.message);
  }
}
