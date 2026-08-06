import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { fetchOwnerSettings } from '../lib/viewerData';

const EMPTY_SETTINGS = {
  medList: [], symptomList: [], allergyList: [],
  hospitalList: [], visitTypeList: [], doctorList: [],
};

const ViewerContext = createContext({
  viewableOwners: [],
  activeOwner: null,
  isViewerMode: false,
  ownerSettings: EMPTY_SETTINGS,
  setActiveOwner: () => {},
  refreshOwnerSettings: async () => {},
});

export function ViewerProvider({ children }) {
  const { session } = useAuth();
  const [viewableOwners, setViewableOwners] = useState([]);
  const [activeOwner, setActiveOwner] = useState(null);
  const [ownerSettings, setOwnerSettings] = useState(EMPTY_SETTINGS);

  useEffect(() => {
    if (!session) {
      setViewableOwners([]);
      setActiveOwner(null);
      return;
    }
    loadViewableOwners(session.user.id);
  }, [session]);

  useEffect(() => {
    if (!activeOwner) {
      setOwnerSettings(EMPTY_SETTINGS);
      return;
    }
    fetchOwnerSettings(activeOwner.id)
      .then(setOwnerSettings)
      .catch((e) => {
        console.warn('[ViewerContext] 讀取檢視者設定失敗，保留原有畫面狀態:', e.message);
      });
  }, [activeOwner?.id]);

  const refreshOwnerSettings = useCallback(async () => {
    if (!activeOwner) return;
    try {
      const settings = await fetchOwnerSettings(activeOwner.id);
      setOwnerSettings(settings);
    } catch (e) {
      console.warn('[ViewerContext] refreshOwnerSettings 失敗，保留原有畫面狀態:', e.message);
    }
  }, [activeOwner?.id]);

  async function loadViewableOwners(userId) {
    try {
      const { data: access, error: e1 } = await supabase
        .from('viewer_access')
        .select('owner_id')
        .eq('viewer_id', userId)
        .eq('status', 'accepted');

      if (e1 || !access?.length) {
        setViewableOwners([]);
        return;
      }

      const ownerIds = access.map((a) => a.owner_id);
      const { data: profiles, error: e2 } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ownerIds);

      if (e2 || !profiles) {
        setViewableOwners([]);
        return;
      }

      setViewableOwners(profiles.map((p) => ({ id: p.id, full_name: p.full_name || '未命名' })));
    } catch (e) {
      console.warn('[ViewerContext]', e.message);
    }
  }

  return (
    <ViewerContext.Provider value={{
      viewableOwners,
      activeOwner,
      isViewerMode: activeOwner !== null,
      ownerSettings,
      setActiveOwner,
      refreshOwnerSettings,
    }}>
      {children}
    </ViewerContext.Provider>
  );
}

export function useViewer() {
  return useContext(ViewerContext);
}
