import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { enqueuePendingSync } from './syncQueue';

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
    console.warn('[cloudSync] pushSymptomLogToCloud failed, enqueueing for retry:', e.message);
    // payload 只有在拿到 session 之後才會建立；沒有 session 就不算是「失敗」，不需要排隊。
    if (payload) {
      await enqueuePendingSync({
        id: log.id,
        table: 'symptom_logs',
        operation: 'upsert',
        payload,
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] pushMedicalHistoryToCloud failed, enqueueing for retry:', e.message);
    if (payload) {
      await enqueuePendingSync({
        id: record.id,
        table: 'medical_history',
        operation: 'upsert',
        payload,
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] deleteMedicalHistoryFromCloud failed, enqueueing for retry:', e.message);
    // 同一個 id 之前如果被 pushMedicalHistoryToCloud 排過 upsert，
    // 這裡用同一個 table:id 去重鍵蓋掉，佇列裡不會同時留著互相矛盾的兩筆。
    if (ownerId) {
      await enqueuePendingSync({
        id,
        table: 'medical_history',
        operation: 'delete',
        payload: { id, owner_id: ownerId },
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] deleteMedHistoryYearFromCloud failed, enqueueing for retry:', e.message);
    if (ownerId) {
      // 整年刪除沒有單一 row id，用 owner_id:year 當去重鍵；
      // operation 標記為 'delete_year'，flushOne 用批次 .eq('owner_id',...).eq('year',...) 處理，
      // 不是單筆 .eq('id', ...)。
      await enqueuePendingSync({
        id: `${ownerId}:${year}`,
        table: 'medical_history',
        operation: 'delete_year',
        payload: { owner_id: ownerId, year },
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] deleteSymptomLogFromCloud failed, enqueueing for retry:', e.message);
    if (ownerId) {
      await enqueuePendingSync({
        id,
        table: 'symptom_logs',
        operation: 'delete',
        payload: { id, owner_id: ownerId },
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] deleteAppointmentFromCloud failed, enqueueing for retry:', e.message);
    if (ownerId) {
      await enqueuePendingSync({
        id,
        table: 'appointments',
        operation: 'delete',
        payload: { id, owner_id: ownerId },
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] pushAppointmentToCloud failed, enqueueing for retry:', e.message);
    if (payload) {
      await enqueuePendingSync({
        id: appt.id,
        table: 'appointments',
        operation: 'upsert',
        payload,
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] pushConsultMemoToCloud failed, enqueueing for retry:', e.message);
    // 沒有 date 一定沒有 ownerId（連 session 都沒拿到），不算失敗、不用排隊。
    if (ownerId) {
      // 用 owner_id:date 當去重鍵——同一天先寫了備忘、離線失敗排進佇列，
      // 之後又清空該天備忘（也失敗），會用「刪除」蓋掉佇列裡先前的「新增／更新」，
      // 不會兩筆都留著造成之後補推順序錯亂。
      await enqueuePendingSync({
        id: `${ownerId}:${date}`,
        table: 'consult_memos',
        operation: content ? 'upsert' : 'delete',
        payload: content
          ? { owner_id: ownerId, memo_date: date, content }
          : { owner_id: ownerId, memo_date: date },
        onConflict: content ? 'owner_id,memo_date' : undefined,
        createdAt: Date.now(),
      });
    }
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
    console.warn('[cloudSync] pushDailyMedCheckToCloud failed, enqueueing for retry:', e.message);
    if (payload) {
      // daily_med_checks 沒有單一 id 欄位，用 owner_id:check_date 當去重鍵——
      // 同一天多次打勾失敗，佇列裡只保留最新一次的 checked 內容。
      await enqueuePendingSync({
        id: `${payload.owner_id}:${payload.check_date}`,
        table: 'daily_med_checks',
        operation: 'upsert',
        payload,
        onConflict: 'owner_id,check_date',
        createdAt: Date.now(),
      });
    }
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
