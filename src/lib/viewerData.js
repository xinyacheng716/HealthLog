import { supabase } from './supabase';

// "2026-06-21T21:03:00+00:00" → "2026/06/21 21:03"
function fromISO(s) {
  if (!s) return null;
  return s.slice(0, 16).replace('T', ' ').replace(/-/g, '/');
}

export async function fetchOwnerLogs(ownerId) {
  const { data, error } = await supabase
    .from('symptom_logs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('start_time', { ascending: false });

  console.log('[viewerData] fetchOwnerLogs raw data for', ownerId, ':', JSON.stringify(data));
  if (error) { console.warn('[viewerData] logs:', error.message); return []; }

  const mapped = (data || []).map((row) => ({
    id: row.id,
    symptoms: row.symptom ? row.symptom.split('、') : [],
    symptom: row.symptom,
    severity: row.severity,
    startTime: fromISO(row.start_time),
    selfMeds: row.self_med ? row.self_med.split('、') : [],
    selfMed: row.self_med,
    note: row.note,
    endTime: fromISO(row.end_time),
    doctorDiagnosis: row.doctor_diagnosis,
    doctorMed: row.doctor_med,
    reliefSeverity: row.relief_severity,
    reliefNote: row.relief_note,
  }));
  console.log('[viewerData] fetchOwnerLogs mapped result:', JSON.stringify(mapped));
  return mapped;
}

export async function fetchOwnerMedicalHistory(ownerId) {
  try {
    console.log('[viewerData] fetching medical_history for ownerId:', ownerId);
    const { data, error } = await supabase
      .from('medical_history')
      .select('id, year, month, content')
      .eq('owner_id', ownerId)
      .order('year', { ascending: false });

    if (error) { console.warn('[viewerData] medHistory error:', error.message); return []; }
    console.log('[viewerData] medical_history raw:', JSON.stringify(data));
    if (!data || data.length === 0) { return []; }

    const groups = [];
    for (const row of data) {
      let group = groups.find((g) => g.year === row.year);
      if (!group) {
        group = { year: row.year, records: [] };
        groups.push(group);
      }
      // content (Supabase column) → text (component field)
      group.records.push({ id: row.id, month: row.month, text: row.content });
    }
    for (const g of groups) {
      g.records.sort((a, b) => b.month - a.month);
    }
    return groups;
  } catch (e) {
    console.warn('[viewerData] fetchOwnerMedicalHistory threw:', e.message);
    return [];
  }
}

export async function fetchOwnerAppointments(ownerId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('owner_id', ownerId)
    .order('appt_time', { ascending: false });

  if (error) { console.warn('[viewerData] appts:', error.message); return []; }

  return (data || []).map((row) => ({
    id: row.id,
    dateTime: fromISO(row.appt_time),
    hospital: row.hospital,
    type: row.type,
    doctor: row.doctor,
    note: row.note,
  }));
}

export async function fetchOwnerDailyMed(ownerId, date) {
  const { data, error } = await supabase
    .from('daily_med_checks')
    .select('checked')
    .eq('owner_id', ownerId)
    .eq('check_date', date)
    .single();

  if (error || !data) return {};
  return data.checked || {};
}

export async function fetchOwnerMedList(ownerId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('med_list')
    .eq('id', ownerId)
    .single();
  if (error) { console.warn('[viewerData] med_list:', error.message); return []; }
  return Array.isArray(data?.med_list) ? data.med_list : [];
}

// Collect all unique med keys across ALL daily_med_checks for the owner.
// Used as fallback denominator when profiles.med_list is null/empty.
export async function fetchOwnerAllMedKeys(ownerId) {
  try {
    const { data, error } = await supabase
      .from('daily_med_checks')
      .select('checked')
      .eq('owner_id', ownerId);
    if (error || !data) { console.warn('[viewerData] allMedKeys:', error?.message); return []; }
    const keys = new Set();
    for (const row of data) {
      if (row.checked && typeof row.checked === 'object') {
        Object.keys(row.checked).forEach((k) => keys.add(k));
      }
    }
    return [...keys];
  } catch (e) {
    console.warn('[viewerData] fetchOwnerAllMedKeys threw:', e.message);
    return [];
  }
}

export async function fetchOwnerSettings(ownerId) {
  // Try full query (requires hospital_list + visit_type_list + doctor_list columns to exist)
  const { data, error } = await supabase
    .from('profiles')
    .select('med_list, symptom_list, allergy_list, hospital_list, visit_type_list, doctor_list')
    .eq('id', ownerId)
    .single();

  console.log('[viewerData] fetchOwnerSettings raw profiles row for', ownerId, ':', JSON.stringify(data), 'error:', error?.message);

  if (!error && data) {
    return {
      medList: Array.isArray(data.med_list) ? data.med_list : [],
      symptomList: Array.isArray(data.symptom_list) ? data.symptom_list : [],
      allergyList: Array.isArray(data.allergy_list) ? data.allergy_list : [],
      hospitalList: Array.isArray(data.hospital_list) ? data.hospital_list : [],
      visitTypeList: Array.isArray(data.visit_type_list) ? data.visit_type_list : [],
      doctorList: Array.isArray(data.doctor_list) ? data.doctor_list : [],
    };
  }

  // Fall back to symptom_list + med_list + allergy_list (new columns not yet added via SQL)
  const { data: d1, error: e1 } = await supabase
    .from('profiles')
    .select('med_list, symptom_list, allergy_list')
    .eq('id', ownerId)
    .single();

  if (!e1 && d1) {
    return {
      medList: Array.isArray(d1.med_list) ? d1.med_list : [],
      symptomList: Array.isArray(d1.symptom_list) ? d1.symptom_list : [],
      allergyList: Array.isArray(d1.allergy_list) ? d1.allergy_list : [],
      hospitalList: [],
      visitTypeList: [],
      doctorList: [],
    };
  }

  // Fall back to med_list only
  const { data: d2, error: e2 } = await supabase
    .from('profiles')
    .select('med_list')
    .eq('id', ownerId)
    .single();

  if (e2 || !d2) {
    console.warn('[viewerData] fetchOwnerSettings fallback:', e2?.message);
    return {
      medList: [], symptomList: [], allergyList: [],
      hospitalList: [], visitTypeList: [], doctorList: [],
    };
  }
  return {
    medList: Array.isArray(d2.med_list) ? d2.med_list : [],
    symptomList: [],
    allergyList: [],
    hospitalList: [],
    visitTypeList: [],
    doctorList: [],
  };
}

export async function fetchOwnerConsultMemo(ownerId, date) {
  const { data, error } = await supabase
    .from('consult_memos')
    .select('content')
    .eq('owner_id', ownerId)
    .eq('memo_date', date)
    .single();

  if (error || !data) return '';
  return data.content || '';
}

// 用於新裝置初始化：只拉最近 sinceDate（含）之後的每日用藥打勾記錄
export async function fetchOwnerDailyMedChecksSince(ownerId, sinceDate) {
  const { data, error } = await supabase
    .from('daily_med_checks')
    .select('check_date, checked')
    .eq('owner_id', ownerId)
    .gte('check_date', sinceDate);

  if (error) { console.warn('[viewerData] dailyMedChecksSince:', error.message); return []; }
  return data || [];
}

// 用於新裝置初始化：只拉最近 sinceDate（含）之後的問診備忘
export async function fetchOwnerConsultMemosSince(ownerId, sinceDate) {
  const { data, error } = await supabase
    .from('consult_memos')
    .select('memo_date, content')
    .eq('owner_id', ownerId)
    .gte('memo_date', sinceDate);

  if (error) { console.warn('[viewerData] consultMemosSince:', error.message); return []; }
  return data || [];
}
