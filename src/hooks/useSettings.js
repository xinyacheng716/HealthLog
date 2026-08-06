import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { loadSettings, saveSettings } from '../storage';
import { syncListFieldToCloud } from '../lib/cloudSync';
import { fetchOwnerSettings } from '../lib/viewerData';
import { useAuth } from '../context/AuthContext';
import {
  SYMPTOMS_DEFAULT, MEDS_DEFAULT, ALLERGY_DEFAULT,
  HOSPITAL_DEFAULT, VISIT_TYPE_DEFAULT, DOCTOR_DEFAULT,
} from '../constants/defaults';

// 依序比較兩個字串陣列是否完全相同——這六個清單是有序清單（例如牛肉精
// 會被放在最前面），順序也算數，不能只比對集合內容。
function sameList(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export default function useSettings() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [symptomList, setSymptomListRaw] = useState([]);
  const [medList, setMedListRaw] = useState([]);
  const [allergyList, setAllergyListRaw] = useState([]);
  const [hospitalList, setHospitalListRaw] = useState([]);
  const [visitTypeList, setVisitTypeListRaw] = useState([]);
  const [doctorList, setDoctorListRaw] = useState([]);

  const symptomRef = useRef([]);
  const medRef = useRef([]);
  const allergyRef = useRef([]);
  const hospitalRef = useRef([]);
  const visitTypeRef = useRef([]);
  const doctorRef = useRef([]);

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

  // 是否已經完成過一次 hydration（不論是「信任本機」或「首次雲端拉取」）。
  // 前景刷新（refreshSettingsFromCloud）只在 hydration 完成之後才有意義去
  // 比較「雲端 vs 本機目前值」，避免跟下面 mount effect 的首次拉取邏輯搶跑。
  const hydratedRef = useRef(false);

  // 前景刷新：從雲端重新拉取六個清單，只更新「真的跟本機不同」的欄位，
  // 逐欄寫入畫面 state + refs + 本機 AsyncStorage——比照 C-006 的教訓，不要
  // 打包成一次全覆蓋。直接走跟 applyToState 一樣的純本機路徑（setXListRaw +
  // saveSettings），絕對不能呼叫六個公開 setter（setSymptomList 等）：那六個
  // setter 內部會呼叫 syncListFieldToCloud 推回雲端，用在這裡會把剛拉回來的
  // 雲端資料立刻反推回去，重新製造 C-004 那類「本機值搶跑推上雲端」問題。
  // 已知風險（這次先不處理，比照 CalendarScreen 的 refreshAppointmentsFromCloud
  // 對同一類問題的處理方式）：如果使用者剛編輯完某一個清單、setXList 觸發的
  // syncListFieldToCloud 還沒推上雲端成功，這時剛好觸發這支函式，會用還沒
  // 包含那次編輯的雲端舊值覆蓋掉本機剛編輯的那個欄位。範圍已經比整批覆蓋小
  // （只有真的跟本機不同的那個欄位會被覆蓋，其餘欄位不受影響），且需要「編輯
  // 後立刻背景切前景」這麼窄的時間窗才會發生。
  async function refreshSettingsFromCloud() {
    if (!userId || !hydratedRef.current) return;
    try {
      const cloud = await fetchOwnerSettings(userId);
      const patch = {};
      if (!sameList(cloud.symptomList, symptomRef.current))     patch.symptomList = cloud.symptomList;
      if (!sameList(cloud.medList, medRef.current))             patch.medList = cloud.medList;
      if (!sameList(cloud.allergyList, allergyRef.current))     patch.allergyList = cloud.allergyList;
      if (!sameList(cloud.hospitalList, hospitalRef.current))   patch.hospitalList = cloud.hospitalList;
      if (!sameList(cloud.visitTypeList, visitTypeRef.current)) patch.visitTypeList = cloud.visitTypeList;
      if (!sameList(cloud.doctorList, doctorRef.current))       patch.doctorList = cloud.doctorList;

      if (Object.keys(patch).length === 0) return;

      if ('symptomList' in patch)   { symptomRef.current = patch.symptomList; setSymptomListRaw(patch.symptomList); }
      if ('medList' in patch)       { medRef.current = patch.medList; setMedListRaw(patch.medList); }
      if ('allergyList' in patch)   { allergyRef.current = patch.allergyList; setAllergyListRaw(patch.allergyList); }
      if ('hospitalList' in patch)  { hospitalRef.current = patch.hospitalList; setHospitalListRaw(patch.hospitalList); }
      if ('visitTypeList' in patch) { visitTypeRef.current = patch.visitTypeList; setVisitTypeListRaw(patch.visitTypeList); }
      if ('doctorList' in patch)    { doctorRef.current = patch.doctorList; setDoctorListRaw(patch.doctorList); }

      // 本機 AsyncStorage 落地一次，用目前完整六個 ref 值（含沒變動的欄位）
      // 寫入——saveSettings 本身純本機寫入，不會推雲端，跟 syncListFieldToCloud
      // 是完全分開的兩條路。
      await saveSettings({
        symptomList: symptomRef.current, medList: medRef.current, allergyList: allergyRef.current,
        hospitalList: hospitalRef.current, visitTypeList: visitTypeRef.current, doctorList: doctorRef.current,
      });
    } catch (e) {
      console.warn('[useSettings] refreshSettingsFromCloud failed, keeping local state:', e.message);
    }
  }

  useEffect(() => {
    (async () => {
      const local = await loadSettings();
      applyToState(local);

      // 本機沒有任何資料（全新裝置、首次使用）才去抓雲端資料當初始值；
      // 本機已有資料（含使用者刻意清空的空陣列）一律信任本機，不用雲端覆蓋。
      if (!local.hasLocalData && userId) {
        try {
          const cloud = await fetchOwnerSettings(userId);
          const merged = {
            symptomList: cloud.symptomList.length > 0 ? cloud.symptomList : SYMPTOMS_DEFAULT,
            medList: cloud.medList.length > 0 ? cloud.medList : MEDS_DEFAULT,
            allergyList: cloud.allergyList.length > 0 ? cloud.allergyList : ALLERGY_DEFAULT,
            hospitalList: cloud.hospitalList.length > 0 ? cloud.hospitalList : HOSPITAL_DEFAULT,
            visitTypeList: cloud.visitTypeList.length > 0 ? cloud.visitTypeList : VISIT_TYPE_DEFAULT,
            doctorList: cloud.doctorList.length > 0 ? cloud.doctorList : DOCTOR_DEFAULT,
          };
          await saveSettings(merged);
          applyToState(merged);
        } catch (e) {
          console.warn('[useSettings] cloud fetch failed, keeping local defaults:', e.message);
        }
      }

      hydratedRef.current = true;

      // 已經有本機資料的裝置（不是全新裝置）：上面那段「首次拉取」被跳過，
      // 這次冷啟動完全沒有機會跟雲端核對過，另一台裝置這段時間推上雲端的
      // 變動要等到下一次前景刷新才會被撿到。這裡額外補一次同一套刷新邏輯，
      // 讓冷啟動／重新登入也能立刻撿到——概念上對應每日用藥／行程／問診
      // 備忘用 useFocusEffect 涵蓋冷啟動的做法，只是這裡沒有 navigation
      // focus 可以掛（AppProviders 在 NavigationContainer 外層），改成
      // hydration 一結束就補打一次。
      if (local.hasLocalData && userId) {
        refreshSettingsFromCloud();
      }
    })();
  }, [userId]);

  // App 從背景切回前景時，同樣重新拉取一次，避免多裝置間、App 保持開啟期間
  // 六個清單彼此看不到對方更新（比照 CalendarScreen / ConsultationMemo 的
  // AppState 前景刷新模式）。這裡掛在 useSettings 本身（全域唯一一份實例，
  // 由 AppProviders 在整個 App 生命週期內只 mount 一次），而不是掛在
  // SettingsScreen 的 focus 上——hospitalList/visitTypeList/doctorList 也被
  // AppointmentSection 用、symptomList/medList/allergyList 也被記錄症狀畫面
  // 用，掛在單一畫面的 focus 只會更新那個畫面剛好有打開的情況。
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const cameToForeground = appStateRef.current !== 'active' && nextAppState === 'active';
      appStateRef.current = nextAppState;
      if (!cameToForeground) return;
      refreshSettingsFromCloud();
    });
    return () => subscription.remove();
  }, [userId]);

  function setSymptomList(updater) {
    setSymptomListRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      symptomRef.current = next;
      saveSettings({
        symptomList: next, medList: medRef.current, allergyList: allergyRef.current,
        hospitalList: hospitalRef.current, visitTypeList: visitTypeRef.current, doctorList: doctorRef.current,
      });
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
  };
}
