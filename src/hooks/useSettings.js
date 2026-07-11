import { useState, useEffect, useRef } from 'react';
import { loadSettings, saveSettings } from '../storage';
import { syncListFieldToCloud } from '../lib/cloudSync';
import { fetchOwnerSettings } from '../lib/viewerData';
import { flushPendingSyncQueue } from '../lib/syncQueue';
import { useAuth } from '../context/AuthContext';
import {
  SYMPTOMS_DEFAULT, MEDS_DEFAULT, ALLERGY_DEFAULT,
  HOSPITAL_DEFAULT, VISIT_TYPE_DEFAULT, DOCTOR_DEFAULT,
} from '../constants/defaults';

// 嚴格序列：1. 確認登入身份 → 2. 向 Supabase 拉 settings → 3. 存進本機 AsyncStorage
// → 4. setState。這整段跑完之前，isSettingsHydrated 都是 false，App.js 會一直顯示
// loading 畫面，不會提前把本機（可能是空值或預設值）渲染出來。
const CLOUD_FETCH_TIMEOUT_MS = 4000;

export default function useSettings() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [symptomList, setSymptomListRaw] = useState([]);
  const [medList, setMedListRaw] = useState([]);
  const [allergyList, setAllergyListRaw] = useState([]);
  const [hospitalList, setHospitalListRaw] = useState([]);
  const [visitTypeList, setVisitTypeListRaw] = useState([]);
  const [doctorList, setDoctorListRaw] = useState([]);
  const [isSettingsHydrated, setIsSettingsHydrated] = useState(false);

  const symptomRef = useRef([]);
  const medRef = useRef([]);
  const allergyRef = useRef([]);
  const hospitalRef = useRef([]);
  const visitTypeRef = useRef([]);
  const doctorRef = useRef([]);

  // 雲端 hydrate 是否已「用真正的雲端資料」完成過。完成前，六個 setter 一律只能寫
  // 本機（state + AsyncStorage），絕對不能呼叫 syncListFieldToCloud —— 否則會用
  // 「還沒被雲端覆蓋過的資料（含離線 fallback 讀到的本機快取）」把雲端正確的資料蓋掉。
  // 注意這跟 isSettingsHydrated 是兩件事：離線 fallback 會讓畫面顯示（isSettingsHydrated
  // = true），但 hasHydratedFromCloudRef 仍是 false，直到真的跟雲端對過資料為止。
  const hasHydratedFromCloudRef = useRef(false);
  const hydratedUserIdRef = useRef(null);

  function applyToState(s) {
    symptomRef.current = s.symptomList;
    medRef.current = s.medList;
    allergyRef.current = s.allergyList;
    hospitalRef.current = s.hospitalList;
    visitTypeRef.current = s.visitTypeList;
    doctorRef.current = s.doctorList;
    setSymptomListRaw(s.symptomList);
    setMedListRaw(s.medList);
    setAllergyListRaw(s.allergyList);
    setHospitalListRaw(s.hospitalList);
    setVisitTypeListRaw(s.visitTypeList);
    setDoctorListRaw(s.doctorList);
  }

  // 唯一的資料來源流程：不再有「本機優先墊底」的第二條路徑，
  // 避免尚未確認的本機資料搶先讓畫面渲染出來。
  useEffect(() => {
    if (!userId) {
      console.log('[settings-hydration] no userId, reset hydrated=false');
      setIsSettingsHydrated(false);
      hasHydratedFromCloudRef.current = false;
      hydratedUserIdRef.current = null;
      return;
    }
    if (hydratedUserIdRef.current === userId) return;

    let cancelled = false;
    let settled = false; // 雲端或 fallback 其中一個先跑完，就算 settled

    hasHydratedFromCloudRef.current = false;
    setIsSettingsHydrated(false);
    console.log(`[settings-hydration] 1. auth confirmed uid=${userId}`);

    const applyFallback = async (reason) => {
      if (cancelled || settled) return;
      settled = true;
      console.log(`[useSettings] cloud fetch ${reason}, falling back to local cache`);
      try {
        const local = await loadSettings();
        if (cancelled) return;
        applyToState(local);
      } catch (e) {
        console.warn('[useSettings] local fallback load failed:', e.message);
      } finally {
        if (!cancelled) setIsSettingsHydrated(true);
      }
    };

    const timeoutId = setTimeout(() => applyFallback('timeout'), CLOUD_FETCH_TIMEOUT_MS);

    (async () => {
      try {
        const cloud = await fetchOwnerSettings(userId);
        console.log('[settings-hydration] 2. fetched from supabase');
        if (cancelled) return;

        const merged = {
          symptomList: cloud.symptomList.length > 0 ? cloud.symptomList : SYMPTOMS_DEFAULT,
          medList: cloud.medList.length > 0 ? cloud.medList : MEDS_DEFAULT,
          allergyList: cloud.allergyList.length > 0 ? cloud.allergyList : ALLERGY_DEFAULT,
          hospitalList: cloud.hospitalList.length > 0 ? cloud.hospitalList : HOSPITAL_DEFAULT,
          visitTypeList: cloud.visitTypeList.length > 0 ? cloud.visitTypeList : VISIT_TYPE_DEFAULT,
          doctorList: cloud.doctorList.length > 0 ? cloud.doctorList : DOCTOR_DEFAULT,
        };

        await saveSettings(merged);
        console.log('[settings-hydration] 3. saved to AsyncStorage');
        if (cancelled) return;

        applyToState(merged);
        hydratedUserIdRef.current = userId;
        hasHydratedFromCloudRef.current = true;
        settled = true;
        clearTimeout(timeoutId);
        setIsSettingsHydrated(true);
        console.log('[settings-hydration] 4. state updated, hydrated=true');

        // hydration 真正跟雲端對過資料之後，順便補推任何先前離線/失敗時
        // 排進 pendingSyncQueue 的症狀紀錄／行程／病歷／每日用藥／問診備忘。
        // 不用等待、不需要畫面提示——flushPendingSyncQueue 內部自己記 log。
        // 之後如果實作「App 回到前景」偵測（AppState 'active'），那個時機點
        // 也應該呼叫一次 flushPendingSyncQueue()，這裡先只接上 app 啟動這個點。
        flushPendingSyncQueue();
      } catch (e) {
        clearTimeout(timeoutId);
        console.warn('[useSettings] cloud fetch failed:', e.message);
        applyFallback('error');
      }
    })();

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [userId]);

  function setSymptomList(updater) {
    setSymptomListRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      symptomRef.current = next;
      saveSettings({
        symptomList: next, medList: medRef.current, allergyList: allergyRef.current,
        hospitalList: hospitalRef.current, visitTypeList: visitTypeRef.current, doctorList: doctorRef.current,
      });
      if (!hasHydratedFromCloudRef.current) {
        console.log('[useSettings] setSymptomList called, hydrated=false, skip sync');
        return next;
      }
      console.log('[useSettings] setSymptomList called, hydrated=true, syncing symptom_list to cloud');
      syncListFieldToCloud('symptom_list', next);
      return next;
    });
  }

  function setMedList(updater) {
    setMedListRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      medRef.current = next;
      saveSettings({
        symptomList: symptomRef.current, medList: next, allergyList: allergyRef.current,
        hospitalList: hospitalRef.current, visitTypeList: visitTypeRef.current, doctorList: doctorRef.current,
      });
      if (!hasHydratedFromCloudRef.current) {
        console.log('[useSettings] setMedList called, hydrated=false, skip sync');
        return next;
      }
      console.log('[useSettings] setMedList called, hydrated=true, syncing med_list to cloud');
      syncListFieldToCloud('med_list', next);
      return next;
    });
  }

  function setAllergyList(updater) {
    setAllergyListRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      allergyRef.current = next;
      saveSettings({
        symptomList: symptomRef.current, medList: medRef.current, allergyList: next,
        hospitalList: hospitalRef.current, visitTypeList: visitTypeRef.current, doctorList: doctorRef.current,
      });
      if (!hasHydratedFromCloudRef.current) {
        console.log('[useSettings] setAllergyList called, hydrated=false, skip sync');
        return next;
      }
      console.log('[useSettings] setAllergyList called, hydrated=true, syncing allergy_list to cloud');
      syncListFieldToCloud('allergy_list', next);
      return next;
    });
  }

  function setHospitalList(updater) {
    setHospitalListRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      hospitalRef.current = next;
      saveSettings({
        symptomList: symptomRef.current, medList: medRef.current, allergyList: allergyRef.current,
        hospitalList: next, visitTypeList: visitTypeRef.current, doctorList: doctorRef.current,
      });
      if (!hasHydratedFromCloudRef.current) {
        console.log('[useSettings] setHospitalList called, hydrated=false, skip sync');
        return next;
      }
      console.log('[useSettings] setHospitalList called, hydrated=true, syncing hospital_list to cloud');
      syncListFieldToCloud('hospital_list', next);
      return next;
    });
  }

  function setVisitTypeList(updater) {
    setVisitTypeListRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      visitTypeRef.current = next;
      saveSettings({
        symptomList: symptomRef.current, medList: medRef.current, allergyList: allergyRef.current,
        hospitalList: hospitalRef.current, visitTypeList: next, doctorList: doctorRef.current,
      });
      if (!hasHydratedFromCloudRef.current) {
        console.log('[useSettings] setVisitTypeList called, hydrated=false, skip sync');
        return next;
      }
      console.log('[useSettings] setVisitTypeList called, hydrated=true, syncing visit_type_list to cloud');
      syncListFieldToCloud('visit_type_list', next);
      return next;
    });
  }

  function setDoctorList(updater) {
    setDoctorListRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      doctorRef.current = next;
      saveSettings({
        symptomList: symptomRef.current, medList: medRef.current, allergyList: allergyRef.current,
        hospitalList: hospitalRef.current, visitTypeList: visitTypeRef.current, doctorList: next,
      });
      if (!hasHydratedFromCloudRef.current) {
        console.log('[useSettings] setDoctorList called, hydrated=false, skip sync');
        return next;
      }
      console.log('[useSettings] setDoctorList called, hydrated=true, syncing doctor_list to cloud');
      syncListFieldToCloud('doctor_list', next);
      return next;
    });
  }

  return {
    symptomList, setSymptomList,
    medList, setMedList,
    allergyList, setAllergyList,
    hospitalList, setHospitalList,
    visitTypeList, setVisitTypeList,
    doctorList, setDoctorList,
    isSettingsHydrated,
  };
}
