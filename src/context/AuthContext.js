import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import {
  migrateLocalDataToCloud,
  migrateAppointmentsToCloud,
  migrateMedHistoryToCloud,
  migrateConsultMemosToCloud,
} from '../lib/cloudSync';
import { initializeLocalDataFromCloudIfNeeded } from '../lib/initSync';

const MIGRATION_FLAG = 'cloudMigrationDone';
const APPT_MIGRATION_FLAG = 'appointmentsMigrationDone';
const MED_HISTORY_MIGRATION_FLAG = 'medHistoryMigrationDone';
const CONSULT_MEMO_MIGRATION_FLAG = 'consultMemoMigrationDone';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function runMigrationIfNeeded(s) {
    if (!s) return;
    const done = await AsyncStorage.getItem(MIGRATION_FLAG);
    if (done) return;
    migrateLocalDataToCloud().then(() => AsyncStorage.setItem(MIGRATION_FLAG, 'true'));
  }

  async function runSupplementalMigrations(s) {
    if (!s) return;

    const apptDone = await AsyncStorage.getItem(APPT_MIGRATION_FLAG);
    if (!apptDone) {
      migrateAppointmentsToCloud().then(() =>
        AsyncStorage.setItem(APPT_MIGRATION_FLAG, 'true'),
      );
    }

    const medHistDone = await AsyncStorage.getItem(MED_HISTORY_MIGRATION_FLAG);
    if (!medHistDone) {
      migrateMedHistoryToCloud().then(() =>
        AsyncStorage.setItem(MED_HISTORY_MIGRATION_FLAG, 'true'),
      );
    }

    const consultDone = await AsyncStorage.getItem(CONSULT_MEMO_MIGRATION_FLAG);
    if (!consultDone) {
      migrateConsultMemosToCloud().then(() =>
        AsyncStorage.setItem(CONSULT_MEMO_MIGRATION_FLAG, 'true'),
      );
    }
  }

  async function initializeAndMigrate(s) {
    if (!s) return;
    // 雲端 → 本機初始化必須先跑，新裝置才有資料可看；
    // 之後的（本機 → 雲端）migration 才不會在空的本機資料上誤判。
    await initializeLocalDataFromCloudIfNeeded(s.user.id);
    runMigrationIfNeeded(s);
    runSupplementalMigrations(s);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsLoading(false);
      initializeAndMigrate(s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') {
        initializeAndMigrate(s);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function signInWithApple() {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('沒有拿到 identityToken');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;

    if (credential.fullName && (credential.fullName.givenName || credential.fullName.familyName)) {
      const fullName = `${credential.fullName.familyName ?? ''}${credential.fullName.givenName ?? ''}`.trim();
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isLoading, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
