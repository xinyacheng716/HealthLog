import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// 共用的「失敗重試佇列」——cloudSync.js 裡 fire-and-forget 的寫入函式，
// 推送失敗時不再只是 console.warn，而是把這筆操作記下來，等下次
// flushPendingSyncQueue() 被呼叫時再補推一次。使用者不需要知道，
// 只要最終真的有同步成功即可，不做任何畫面提示。

const QUEUE_KEY = 'pendingSyncQueue';

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[syncQueue] failed to read queue, treating as empty:', e.message);
    return [];
  }
}

async function writeQueue(queue) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[syncQueue] failed to write queue:', e.message);
  }
}

// entry: { id, table, operation: 'upsert'|'delete'|'delete_year', payload, createdAt, onConflict? }
// id 是這筆待同步操作的去重鍵（例如該筆紀錄本身的 uuid，或是像
// daily_med_checks／consult_memos 這種沒有單一 id 欄位的表，用
// `owner_id:date` 這種組合鍵；medical_history 整年批次刪除則用
// `owner_id:year`）。同一個 table+id 只保留最新一筆，避免同一筆資料
// 寫入失敗多次時佇列裡累積出多筆重複記錄——也讓「先 upsert 排隊、
// 後來又 delete」這種前後矛盾的操作，正確變成只留最後一筆（delete 蓋掉
// upsert，反之亦然），不會兩筆都殘留。
export async function enqueuePendingSync(entry) {
  const queue = await readQueue();
  const dedupeKey = `${entry.table}:${entry.id}`;
  const next = [
    ...queue.filter((e) => `${e.table}:${e.id}` !== dedupeKey),
    entry,
  ];
  await writeQueue(next);
  console.log('[syncQueue] enqueued', dedupeKey, '— queue length now', next.length);
}

async function flushOne(entry) {
  try {
    const { table, operation, payload, onConflict } = entry;

    if (operation === 'upsert') {
      const { error } = await supabase
        .from(table)
        .upsert(payload, onConflict ? { onConflict } : undefined);
      if (error) {
        console.warn('[syncQueue] retry upsert failed for', table, entry.id, error.message);
        return false;
      }
      return true;
    }

    if (operation === 'delete') {
      // 單筆刪除：payload 帶的是某一筆 row 的 id（+ owner_id）
      let query = supabase.from(table).delete();
      for (const [key, value] of Object.entries(payload)) {
        query = query.eq(key, value);
      }
      const { error } = await query;
      if (error) {
        console.warn('[syncQueue] retry delete failed for', table, entry.id, error.message);
        return false;
      }
      return true;
    }

    if (operation === 'delete_year') {
      // 整年批次刪除：沒有單一 row id，用 owner_id + year 篩選整批刪除
      // （目前只有 medical_history 會用到這個 operation）
      const { owner_id, year } = payload;
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('owner_id', owner_id)
        .eq('year', year);
      if (error) {
        console.warn('[syncQueue] retry delete_year failed for', table, entry.id, error.message);
        return false;
      }
      return true;
    }

    console.warn('[syncQueue] unknown operation, dropping entry:', operation, entry.id);
    return true; // 丟掉無法辨識的操作，避免卡住佇列
  } catch (e) {
    console.warn('[syncQueue] retry exception for', entry.table, entry.id, e.message);
    return false;
  }
}

// 依序把佇列裡所有項目推上雲端。成功的移除，失敗的保留在佇列裡等下次再試。
export async function flushPendingSyncQueue() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('[syncQueue] flush skipped, no session');
    return;
  }

  const queue = await readQueue();
  if (queue.length === 0) {
    console.log('[syncQueue] flush skipped, queue empty');
    return;
  }

  console.log('[syncQueue] flushing', queue.length, 'pending item(s)');
  const remaining = [];
  let successCount = 0;
  let failCount = 0;

  for (const entry of queue) {
    const ok = await flushOne(entry);
    if (ok) successCount++;
    else { failCount++; remaining.push(entry); }
  }

  await writeQueue(remaining);
  console.log(`[syncQueue] flush done: ${successCount} succeeded, ${failCount} still pending`);
}
