import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// "2026/06/21 21:03" → "2026-06-21T21:03:00"
function toISO(s) {
  if (!s) return null;
  return s.replace(/\//g, '-').replace(' ', 'T') + ':00';
}

export async function pushSymptomLogToCloud(log) {
  let payload;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    payload = {
      id: log.id,
      owner_id: session.user.id,
      symptom: Array.isArray(log.symptoms) && log.symptoms.length > 0
        ? log.symptoms.join('、')
        : (log.symptom ?? null),
      severity: log.severity,
      start_time: toISO(log.startTime),
      self_med: Array.isArray(log.selfMeds) && log.selfMeds.length > 0
        ? log.selfMeds.join('、')
        : (log.selfMed ?? null),
      note: log.note ?? null,
      end_time: toISO(log.endTime),
      doctor_diagnosis: log.doctorDiagnosis ?? null,
      doctor_med: log.doctorMed ?? null,
      relief_severity: log.reliefSeverity ?? null,
      relief_note: log.reliefNote ?? null,
    };

    console.log('[cloudSync] payload to upsert:', JSON.stringify(payload));

    const { error } = await supabase.from('symptom_logs').upsert(payload);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.warn('[cloudSync] pushSymptomLogToCloud failed:', e.message);
  }
}

export async function pushMedicalHistoryToCloud(record, year) {
  let payload;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    payload = {
      id: record.id,
      owner_id: session.user.id,
      year,
      month: record.month,
      content: record.text,
    };
    console.log('[cloudSync] medical_history payload:', JSON.stringify(payload));
    const { error } = await supabase.from('medical_history').upsert(payload);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.warn('[cloudSync] pushMedicalHistoryToCloud failed:', e.message);
  }
}

export async function deleteMedicalHistoryFromCloud(id) {
  let ownerId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    ownerId = session.user.id;
    const { error } = await supabase
      .from('medical_history')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId);
    if (error) throw new Error(error.message);
    console.log('[cloudSync] medical_history record deleted:', id);
  } catch (e) {
    console.warn('[cloudSync] deleteMedicalHistoryFromCloud failed:', e.message);
  }
}

export async function deleteMedHistoryYearFromCloud(year) {
  let ownerId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    ownerId = session.user.id;
    const { error } = await supabase
      .from('medical_history')
      .delete()
      .eq('owner_id', ownerId)
      .eq('year', year);
    if (error) throw new Error(error.message);
    console.log('[cloudSync] medical_history year deleted:', year);
  } catch (e) {
    console.warn('[cloudSync] deleteMedHistoryYearFromCloud failed:', e.message);
  }
}

export async function deleteSymptomLogFromCloud(id) {
  let ownerId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    ownerId = session.user.id;
    const { error } = await supabase
      .from('symptom_logs')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId);
    if (error) throw new Error(error.message);
    console.log('[cloudSync] symptom_log deleted from cloud:', id);
  } catch (e) {
    console.warn('[cloudSync] deleteSymptomLogFromCloud failed:', e.message);
  }
}

export async function deleteAppointmentFromCloud(id) {
  let ownerId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    ownerId = session.user.id;
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId);
    if (error) throw new Error(error.message);
    console.log('[cloudSync] appointment deleted from cloud:', id);
  } catch (e) {
    console.warn('[cloudSync] deleteAppointmentFromCloud failed:', e.message);
  }
}

export async function pushAppointmentToCloud(appt) {
  let payload;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    payload = {
      id: appt.id,
      owner_id: session.user.id,
      appt_time: toISO(appt.dateTime),
      hospital: appt.hospital,
      type: appt.type ?? null,
      doctor: appt.doctor ?? null,
      note: appt.note ?? null,
    };

    console.log('[cloudSync] appointment payload:', JSON.stringify(payload));

    const { error } = await supabase.from('appointments').upsert(payload);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.warn('[cloudSync] pushAppointmentToCloud failed:', e.message);
  }
}

export async function pushConsultMemoToCloud(date, content) {
  let ownerId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    ownerId = session.user.id;

    console.log('[cloudSync] consult_memo payload:', JSON.stringify({ date, content }));

    if (!content) {
      const { error } = await supabase
        .from('consult_memos')
        .delete()
        .eq('owner_id', ownerId)
        .eq('memo_date', date);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('consult_memos')
        .upsert(
          { owner_id: ownerId, memo_date: date, content },
          { onConflict: 'owner_id,memo_date' },
        );
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    console.warn('[cloudSync] pushConsultMemoToCloud failed:', e.message);
  }
}

export async function pushDailyMedCheckToCloud(check) {
  let payload;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    payload = { owner_id: session.user.id, check_date: check.date, checked: check.checked };
    const { error } = await supabase
      .from('daily_med_checks')
      .upsert(payload, { onConflict: 'owner_id,check_date' });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.warn('[cloudSync] pushDailyMedCheckToCloud failed:', e.message);
  }
}

export async function migrateLocalDataToCloud() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Migrate symptom logs
    const logsRaw = await AsyncStorage.getItem('logs');
    if (logsRaw) {
      const logs = JSON.parse(logsRaw);
      for (const log of logs) {
        await pushSymptomLogToCloud(log);
      }
    }

    // Migrate daily med checks
    const allKeys = await AsyncStorage.getAllKeys();
    const medKeys = allKeys.filter((k) => k.startsWith('dailyMed_'));
    if (medKeys.length > 0) {
      const pairs = await AsyncStorage.multiGet(medKeys);
      for (const [, value] of pairs) {
        if (!value) continue;
        try {
          await pushDailyMedCheckToCloud(JSON.parse(value));
        } catch {}
      }
    }

    console.log('[cloudSync] migration complete');
  } catch (e) {
    console.warn('[cloudSync] migrateLocalDataToCloud failed:', e.message);
  }
}

export async function migrateAppointmentsToCloud() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const raw = await AsyncStorage.getItem('appointments');
    if (!raw) return;
    const appts = JSON.parse(raw);
    for (const appt of appts) {
      await pushAppointmentToCloud(appt);
    }
    console.log('[cloudSync] appointments migration complete:', appts.length, 'records');
  } catch (e) {
    console.warn('[cloudSync] migrateAppointmentsToCloud failed:', e.message);
  }
}

export async function migrateMedHistoryToCloud() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const raw = await AsyncStorage.getItem('medicalHistory');
    if (!raw) return;
    const history = JSON.parse(raw);
    let count = 0;
    for (const group of history) {
      for (const record of (group.records || [])) {
        await pushMedicalHistoryToCloud(record, group.year);
        count++;
      }
    }
    console.log('[cloudSync] medicalHistory migration complete:', count, 'records');
  } catch (e) {
    console.warn('[cloudSync] migrateMedHistoryToCloud failed:', e.message);
  }
}

export async function migrateConsultMemosToCloud() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const allKeys = await AsyncStorage.getAllKeys();
    const memoKeys = allKeys.filter((k) => k.startsWith('consultMemo_'));
    if (memoKeys.length === 0) return;

    const pairs = await AsyncStorage.multiGet(memoKeys);
    let count = 0;
    for (const [key, value] of pairs) {
      if (!value) continue;
      const date = key.replace('consultMemo_', '');
      await pushConsultMemoToCloud(date, value);
      count++;
    }
    console.log('[cloudSync] consultMemos migration complete:', count, 'records');
  } catch (e) {
    console.warn('[cloudSync] migrateConsultMemosToCloud failed:', e.message);
  }
}

// 只更新單一欄位，不用 upsert 整列 —— 這樣任何一個清單被觸發同步，
// 都不會連帶覆蓋雲端上其他五個欄位目前的值。
export async function syncListFieldToCloud(fieldName, listValue) {
  // fieldName: 'symptom_list' | 'med_list' | 'allergy_list' |
  //            'hospital_list' | 'visit_type_list' | 'doctor_list'
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[cloudSync] syncListFieldToCloud skipped, no session');
      return { success: false, error: 'no session' };
    }
    const { data, error } = await supabase
      .from('profiles')
      .update({ [fieldName]: listValue })
      .eq('id', session.user.id)
      .select();
    if (error) {
      console.log('[cloudSync] syncListFieldToCloud error', fieldName, error);
      return { success: false, error };
    }
    console.log('[cloudSync] syncListFieldToCloud success', fieldName);
    return { success: true, data };
  } catch (e) {
    console.log('[cloudSync] syncListFieldToCloud exception', fieldName, e);
    return { success: false, error: e };
  }
}
