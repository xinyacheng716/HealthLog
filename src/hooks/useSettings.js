import { useState, useEffect, useRef } from 'react';
import { loadSettings, saveSettings } from '../storage';
import { syncListFieldToCloud } from '../lib/cloudSync';
import { fetchOwnerSettings } from '../lib/viewerData';
import { useAuth } from '../context/AuthContext';
import {
  SYMPTOMS_DEFAULT, MEDS_DEFAULT, ALLERGY_DEFAULT,
  HOSPITAL_DEFAULT, VISIT_TYPE_DEFAULT, DOCTOR_DEFAULT,
} from '../constants/defaults';

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
    })();
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
