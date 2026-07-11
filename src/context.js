import React, { createContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  deleteSymptomLogFromCloud,
  pushMedicalHistoryToCloud,
  deleteMedicalHistoryFromCloud,
  deleteMedHistoryYearFromCloud,
} from './lib/cloudSync';
import {
  loadLogs, saveLogs, loadMedicalHistory, saveMedicalHistory,
} from './storage';
import useSettings from './hooks/useSettings';

export const SettingsContext = createContext({});
export const LogsContext = createContext({});
export const MedicalHistoryContext = createContext({});

const sortYearsDesc = (arr) => [...arr].sort((a, b) => b.year - a.year);
const sortRecordsDesc = (recs) => [...recs].sort((a, b) => b.month - a.month);

export function AppProviders({ children }) {
  const settings = useSettings();

  const [logs, setLogsRaw] = useState([]);
  const [logsReady, setLogsReady] = useState(false);

  useEffect(() => {
    loadLogs().then((l) => {
      setLogsRaw(l);
      setLogsReady(true);
    });
  }, []);

  const addLog = useCallback((entry) => {
    setLogsRaw((prev) => {
      const next = [entry, ...prev];
      saveLogs(next, entry);
      return next;
    });
  }, []);

  const updateLog = useCallback((id, patch) => {
    setLogsRaw((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      const updated = next.find((l) => l.id === id);
      saveLogs(next, updated);
      return next;
    });
  }, []);

  const deleteLog = useCallback((id) => {
    setLogsRaw((prev) => {
      const next = prev.filter((l) => l.id !== id);
      saveLogs(next);
      deleteSymptomLogFromCloud(id);
      return next;
    });
  }, []);

  // ── 病歷 ────────────────────────────────────────────────────────────────
  const [medicalHistory, setMedRaw] = useState([]);
  const [medReady, setMedReady] = useState(false);

  useEffect(() => {
    loadMedicalHistory().then((m) => {
      setMedRaw(sortYearsDesc(m));
      setMedReady(true);
    });
  }, []);

  // 新增年份（已存在則不重複）
  const addMedYear = useCallback((year) => {
    setMedRaw((prev) => {
      if (prev.some((g) => g.year === year)) return prev;
      const next = sortYearsDesc([...prev, { year, records: [] }]);
      saveMedicalHistory(next);
      return next;
    });
  }, []);

  // 在指定年份新增一筆記錄（月份 + 文字）
  const addMedRecord = useCallback((year, month, text) => {
    const newRecord = { id: uuidv4(), month, text };
    setMedRaw((prev) => {
      const next = prev.map((g) => (
        g.year === year
          ? { ...g, records: sortRecordsDesc([...g.records, newRecord]) }
          : g
      ));
      saveMedicalHistory(next);
      pushMedicalHistoryToCloud(newRecord, year);
      return next;
    });
  }, []);

  // 更新單筆記錄（月份 or 文字）
  const updateMedRecord = useCallback((year, id, patch) => {
    setMedRaw((prev) => {
      const next = prev.map((g) => (
        g.year === year
          ? { ...g, records: sortRecordsDesc(g.records.map((r) => (r.id === id ? { ...r, ...patch } : r))) }
          : g
      ));
      const updated = next.find((g) => g.year === year)?.records.find((r) => r.id === id);
      if (updated) pushMedicalHistoryToCloud(updated, year);
      saveMedicalHistory(next);
      return next;
    });
  }, []);

  // 刪除單筆記錄
  const deleteMedRecord = useCallback((year, id) => {
    setMedRaw((prev) => {
      const next = prev.map((g) => (
        g.year === year ? { ...g, records: g.records.filter((r) => r.id !== id) } : g
      ));
      saveMedicalHistory(next);
      deleteMedicalHistoryFromCloud(id);
      return next;
    });
  }, []);

  // 刪除整個年份（含底下所有記錄）
  const deleteMedYear = useCallback((year) => {
    setMedRaw((prev) => {
      const next = prev.filter((g) => g.year !== year);
      saveMedicalHistory(next);
      deleteMedHistoryYearFromCloud(year);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      <LogsContext.Provider value={{ logs, addLog, updateLog, deleteLog, logsReady }}>
        <MedicalHistoryContext.Provider value={{
          medicalHistory, medReady,
          addMedYear, addMedRecord, updateMedRecord, deleteMedRecord, deleteMedYear,
        }}>
          {children}
        </MedicalHistoryContext.Provider>
      </LogsContext.Provider>
    </SettingsContext.Provider>
  );
}
