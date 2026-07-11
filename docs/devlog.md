# 健康記錄 App — 開發日誌

> 開發者：程歆雅（Xinya Cheng）
> 開發期間：2026年6月 — 2026年7月
> App 名稱：健康記錄 / Health Log
> Bundle ID：`com.sophiechenggg.healthlog`

---

## 版本總覽

| Build # | 日期 | 類型 | 主要功能 |
|---------|------|------|---------|
| 2 | Jun 8 | Production | 初始版本，四 Tab 基本架構 |
| 3 | Jun 8 | Production | 基礎 UI 優化 |
| 5 | Jun 20 | Production | 症狀紀錄、歷史紀錄、每日用藥、設定完整功能 |
| 7 | Jun 20 | Production | UI 調整、SafeArea 修正 |
| 10 | Jun 21 | Production | Apple Sign In（測試按鈕版）+ Supabase 連線 |
| 14 | Jun 24 | Production | AuthContext 正式登入流程 + LoginScreen |
| 15 | Jun 24 | Production | 清除測試按鈕 + 每日用藥 UI 重構（所有行程 + 篩選器）|
| 16 | Jul 1 | Production | Phase 4–6 完整功能（雲端同步 + 家人共享 + 檢視者模式）|
| 17 | Jul 4 | Production（誤觸）| 與 Build 18 功能相同，因未指定 --profile 而產生 |
| 18 | Jul 4 | Production | 推播通知 + 歷史 Modal + 設定頁可編輯清單 |
| 19 | Jul 9 | Production | 多裝置同步初版（initSync v2）+ syncSettingsToCloud fallback 修正 |
| 20 | Jul 9 | Production | initSync settings 安全保護邏輯調整（v3）|
| 21 | Jul 9 | Production | initSync settings 獨立拉取，不受 logs 保護跳過（v3）|
| 22 | Jul 9 | Production | hasLocalData guard（觸發 race condition，資料被蓋掉，見 C-004）|
| 23 | Jul 9 | Production | 修正 race condition，Supabase 資料手動還原，flag v4 |

> Build 11–13 為 Development Build（用於測試，不在 TestFlight 列表中）

---

## 各版本功能詳述

---

### Build 2–3｜Jun 8, 2026
**初始版本建立**

- 建立 React Native + Expo 專案（SDK 54）
- 四 Tab 導覽架構：記錄症狀 / 歷史紀錄 / 每日用藥 / 設定
- Header 設計：「民國醫案墨帳」風格，深墨漸層 + 金色裝飾線 + 標楷體
- Tab icon：單字楷書漢字於印章方框（記 / 史 / 藥 / 調）
- 宣紙暖米背景色，硃砂紅 CTA

---

### Build 5｜Jun 20, 2026 1:20 AM
**核心功能完整實作（本機版）**

**Tab 0 — 記錄症狀**
- 症狀多選下拉（支援「其他」自由輸入）
- 嚴重程度 Slider（1–10，標示輕微 / 中度 / 嚴重）
- 開始時間自動帶入當前時間，可手動編輯
- 自行服藥多選
- 送出按鈕「記錄」（未選症狀時 disabled）

**Tab 1 — 歷史紀錄**
- 子分頁：症狀紀錄 / 病歷 / 分享
- 症狀紀錄按日期分組（降冪），LogCard 支援 inline 補填（結束時間、醫生診斷、醫生用藥、緩解程度、備註）
- 病歷按年份分組，每筆有月份 + 內容，可新增年份 + 個別記錄
- 分享：`Share.share()` 匯出病歷純文字

**Tab 2 — 每日用藥（初版）**
- 月曆行程：月曆標記有行程日期，點日期查看當日行程 + 問診備忘
- 今日行程：列出當日行程
- 今日用藥：勾選框列出今日所有藥物，勾選後加刪除線，進度條顯示完成比例

**Tab 3 — 設定**
- 三個可編輯清單：藥物過敏 / 藥物清單 / 症狀清單
- 各清單支援新增、編輯、刪除
- 「其他」固定在症狀清單末尾，不可刪除

**資料層**
- 全部存在本機 AsyncStorage
- 使用 `uuid` v4 產生每筆紀錄 ID

---

### Build 7｜Jun 20, 2026 10:14 PM
**UI 修正**

- 修正 SafeAreaView 與瀏海遮擋問題
- 調整各畫面 padding 與安全區域

---

### Build 10｜Jun 21, 2026
**Supabase 連線 + Apple Sign In（測試版）**

**基礎建設（Phase 0）**
- 安裝 `@supabase/supabase-js`、`react-native-url-polyfill`
- 建立 `src/lib/supabase.js`，以 AsyncStorage 持久化 session
- `.env` 管理 Supabase URL 和 Publishable Key

**Supabase 資料表（Phase 1）**
建立七張表：
- `profiles`（使用者個人資料，含 `med_list`、`symptom_list`、`allergy_list` jsonb）
- `symptom_logs`（症狀紀錄）
- `daily_med_checks`（每日用藥勾選）
- `viewer_access`（家人授權關係）
- `invite_codes`（邀請碼）
- 全部開啟 Row Level Security
- 建立 `redeem_invite_code` SECURITY DEFINER 函式
- 建立 `handle_new_user` trigger（新使用者自動建立 profile）

**Apple Sign In（Phase 2）**
- 安裝 `expo-apple-authentication`
- 在 `app.json` 加入 `usesAppleSignIn: true`
- 串接 `signInWithIdToken` 到 Supabase Auth
- 第一次登入時把 Apple fullName 存進 `profiles`
- 此版本為測試版：Apple 登入是一個浮動的測試按鈕，成功後顯示「登入成功 ✅ 已儲存姓名：程歆雅」，尚未整合進正式導覽流程

---

### Build 14｜Jun 24, 2026 11:33 AM
**正式登入流程整合（Phase 2 完整版）**

- 新增 `src/context/AuthContext.js`（session / signInWithApple / signOut）
- 新增 `src/screens/LoginScreen.js`（民國墨帳風格，Apple 登入按鈕）
- `App.js` 加入三層判斷：`isLoading` → 黑底 View / `!session` → LoginScreen / `session` → 主畫面
- 移除 Build 10 的測試按鈕
- 登入後 session 持久化，重開 App 直接進主畫面不需重新登入

---

### Build 15｜Jun 24, 2026 12:42 PM
**每日用藥 UI 重構 + 清理**

- 子分頁從「月曆行程 / 今日行程 / 今日用藥」改為「月曆行程 / 所有行程 / 今日用藥」
- 所有行程：依日期降冪列出全部醫院行程，頂部雙篩選器（類型 + 醫院）
- 點行程進入詳情頁（時間、醫院、醫生 + 問診備忘）
- 清除 Build 10 殘留的 Supabase 連線測試 log

---

### Build 16｜Jul 1, 2026
**雲端同步 + 家人共享 + 檢視者模式（Phase 4–6 完整版）**

**Phase 4 — 本機資料同步雲端**

新增 `src/lib/cloudSync.js`，所有本機寫入操作附帶 fire-and-forget 雲端同步：

| 資料類型 | 同步操作 |
|---------|---------|
| 症狀紀錄 | 新增 / 更新 / 刪除 |
| 每日用藥勾選 | 勾選 / 取消 |
| 醫院行程 | 新增 / 更新 / 刪除 |
| 問診備忘 | 儲存 / 清空 |
| 病歷 | 新增 / 更新 / 刪除 / 整年刪除 |
| 設定清單 | med_list / symptom_list / allergy_list |

新增三張資料表：`appointments`、`medical_history`、`consult_memos`

補遷移機制：四個獨立 migration flag，登入時觸發 `runSupplementalMigrations()`，logs + dailyMed 初次搬遷，appointments / medical_history / consult_memos 各自獨立補遷移。

**Phase 5 — 邀請碼系統**

設定頁面新增「家人分享」區塊：
- 產生邀請碼：6碼大寫英數（排除 0/O/1/I），有效期 48 小時
- 成功後以硃砂大字顯示，旁邊分享按鈕呼叫 `Share.share()`
- 輸入邀請碼欄位（`autoCapitalize="characters"`）+ 綁定按鈕
- 後端：`supabase.rpc('redeem_invite_code')` 呼叫 Phase 1 建立的資料庫函式

**Phase 6 — 檢視者模式**

新增 `src/context/ViewerContext.js` 和 `src/lib/viewerData.js`：

身份切換列（IdentitySwitcher）：位置在 AppHeader 下方，有被授權查看的 owner 才出現，active 狀態硃砂色底色。

各畫面檢視者行為：
- 記錄症狀：顯示「閱」字印章 + 查看模式提示
- 歷史紀錄：頂部橫幅標示查看對象，隱藏所有 CRUD 按鈕
- 每日用藥：從 Supabase 讀 owner 資料，checkbox disabled，隱藏新增
- 設定：隱藏家人分享區塊，所有清單唯讀

設定頁面底部加入登出按鈕（帶 Alert 確認）。

---

### Build 17｜Jul 4, 2026（誤觸）
**與 Build 18 功能相同**

因未指定 `--profile`（預設走 production）誤觸，消耗一次 build 額度但功能與 Build 18 完全相同。從此確立規則：測試用 `--profile development`，正式版用 `--profile production`，不能省略。

---

### Build 18｜Jul 4, 2026
**推播通知 + 歷史 Modal 增強 + 設定頁可編輯清單**

**推播通知（expo-notifications）**

每日抗凝血劑提醒：10:30 AM + 10:30 PM（GMT+8），`calendar` 觸發器，固定 identifier 確保冪等性，重複排程不會疊加。

嗎啡貼布 48 小時換藥提醒：勾選時排程，取消勾選時取消，重新勾選先取消舊的再重排。`seconds` 觸發器（48 × 3600），identifier 含日期確保唯一。

**歷史紀錄 Modal 增強**

近七日用藥紀錄 Modal 新增「依藥物」檢視模式，切換按鈕「依日期」↔「依藥物」，依藥物模式以藥名為主軸展開每筆服藥日期，日期標籤昨天 / 前天 / M月D日。

**設定頁可編輯清單擴充**

新增三個可編輯下拉清單，同步 Supabase `profiles` 表，接入 `AppointmentSection.js` 下拉選單取代硬寫常數：

| 清單 | 對應欄位 | 特殊規則 |
|------|---------|---------|
| 醫院清單 | `hospital_list` | 「其他」固定項目不可刪除 |
| 行程類型清單 | `visit_type_list` | 「其他」可刪除 |
| 看診醫生清單 | `doctor_list` | 無固定項目 |

---

### Build 19｜Jul 9, 2026
**多裝置同步初版（initSync）+ syncSettingsToCloud fallback 修正**

App 原本是 offline-first 設計，只有「本機 → 雲端」的 push 同步，新裝置（iPad）登入後 AsyncStorage 是空的，無法顯示任何資料。

**新增 `src/lib/initSync.js`（flag: `localDataInitialized_v2`）**

新裝置第一次登入時，從 Supabase 把所有資料拉回本機 AsyncStorage：
- `logs`（症狀紀錄）+ `normalizeLogForLocal()` 格式轉換
- `appointments`（醫院行程）
- `medicalHistory`（病歷）
- `settings`（六個清單）
- 最近 90 天的 `dailyMed_YYYY-MM-DD` / `consultMemo_YYYY-MM-DD`

初版安全保護設計（後來發現有缺陷，見 C-004）：本機 logs 或 settings 已有資料就跳過 initSync。此邏輯對 logs 正確，對 settings 錯誤——settings 每次變動都推雲端，雲端永遠是最新版，不應跳過。

**修正 syncSettingsToCloud 靜默降級 bug（見 C-002）**：移除三層 fallback，改成單一 upsert。

**修正症狀紀錄格式（normalizeLogForLocal，見 C-003）**：`fetchOwnerLogs` 回傳「、」分隔字串和 ISO 時間，但本機預期 `symptoms[]` 陣列和 `"YYYY/MM/DD HH:MM"` 格式。

結果：iPad 症狀紀錄正常，但藥物清單仍顯示 12 種（settings 保護邏輯有誤）。

---

### Build 20｜Jul 9, 2026
**initSync settings 邏輯調整（v3）**

嘗試修正 settings 在 initSync 中被錯誤跳過的問題。Flag 升至 `localDataInitialized_v3`，但藥物清單在 iPad 上仍未正確顯示。

---

### Build 21｜Jul 9, 2026
**initSync settings 獨立拉取**

明確將 settings 的拉取邏輯獨立：`refreshSettingsFromCloud(userId)` 永遠第一個執行，不受 flag 保護跳過；logs / appointments / medicalHistory 仍有本機資料保護。Flag: `localDataInitialized_v3`。

iPad 症狀紀錄正常，藥物清單仍顯示 12 種，根本原因尚未找到。

---

### Build 22｜Jul 9, 2026（造成嚴重資料損毀，見 C-004）
**引入 hasLocalData guard，觸發 race condition**

- `useSettings.js` 加入 `if (s.hasLocalData)` guard
- `loadSettings()` 新增 `hasLocalData: true/false` 回傳值
- Flag 升至 `localDataInitialized_v4`

更新後 Supabase 上爸爸的 `med_list` 被覆蓋成 12 種預設藥物，viewer mode 顯示 12 種。根本原因是 `useSettings` 的 effect 和 `initSync` 的網路請求之間存在 race condition（詳見 C-004）。

---

### Build 23｜Jul 9, 2026
**修正 race condition + 還原 Supabase 資料**

手動 SQL 把 Supabase 爸爸的 `med_list`（15種）、`symptom_list`（12種）、`visit_type_list`（9種）、`doctor_list`（6種）還原回正確值。

`loadSettings()` 回傳 `hasLocalData: true/false`，`useSettings` 的 `syncSettingsToCloud` 只有在 `hasLocalData === true` 時才執行，fallback 預設值永遠不推雲端。Flag 維持 `localDataInitialized_v4`。

---

## 功能地圖（截至 Build 23）

```
健康記錄 App
├── 認證
│   ├── Apple Sign In（Face ID）
│   ├── LoginScreen（墨帳風格）
│   └── 登出（Alert 確認）
│
├── Tab 0 — 記錄症狀
│   ├── 症狀多選 + 自由輸入
│   ├── 嚴重程度 Slider（1–10）
│   ├── 開始時間（自動帶入，可編輯）
│   ├── 自行服藥多選
│   └── [檢視者模式] 唯讀提示
│
├── Tab 1 — 歷史紀錄
│   ├── 症狀紀錄（按日期分組）
│   │   ├── LogCard（症狀 / 嚴重度 / 時間 / 自行服藥）
│   │   ├── Inline 補填（醫診 / 緩解狀況）
│   │   └── 近七日用藥 Modal（依日期 / 依藥物 切換）
│   ├── 病歷（按年份分組）
│   │   └── 新增 / 編輯 / 刪除記錄 + 整年刪除
│   ├── 分享（Share.share() 匯出純文字）
│   └── [檢視者模式] 查看橫幅 + 全部唯讀
│
├── Tab 2 — 每日用藥
│   ├── 月曆行程（月曆 + 小點標記 + 日期詳情）
│   ├── 所有行程（降冪列表 + 類型/醫院篩選）
│   │   └── 行程詳情（時間 / 類型 / 醫院 / 醫生 / 備註 / 問診備忘）
│   ├── 今日用藥（進度條 + 勾選框）
│   └── [檢視者模式] 唯讀，checkbox disabled
│
├── Tab 3 — 設定
│   ├── 藥物過敏清單（CRUD）
│   ├── 藥物清單（CRUD + 雲端同步）
│   ├── 症狀清單（CRUD，「其他」固定）
│   ├── 醫院清單（CRUD + 雲端同步，「其他」固定）
│   ├── 行程類型清單（CRUD + 雲端同步）
│   ├── 看診醫生清單（CRUD + 雲端同步）
│   ├── 家人分享
│   │   ├── 產生邀請碼（6碼，48小時有效）
│   │   └── 輸入邀請碼（綁定檢視授權）
│   └── 登出
│
├── 推播通知（expo-notifications）
│   ├── 每日 10:30 AM + 10:30 PM（抗凝血劑）
│   └── 48小時換藥提醒（嗎啡貼布勾選後觸發）
│
└── 雲端後端（Supabase）
    ├── 資料表：profiles / symptom_logs / daily_med_checks /
    │          appointments / medical_history / consult_memos /
    │          viewer_access / invite_codes
    ├── RLS：Owner 全權限，Viewer 唯讀
    └── 家人共享：邀請碼授權 → 檢視者模式
```

---

## 挑戰紀錄

### C-001｜RLS 漏洞：medical_history viewer 無法讀取
**發現時間**：Build 16 後
**症狀**：切換到 ChengJui Hsi 閱覽模式，病歷顯示空白，但 Supabase 表裡有 15 筆資料
**根本原因**：`medical_history` 的 RLS policy 只允許 `owner_id = auth.uid()`，沒有開放給 viewer 讀取
**解法**：補寫 `viewers_can_read_medical_history` policy，允許 `viewer_access` 表中有 `accepted` 授權的使用者讀取
**教訓**：每次新增資料表，都要確認同時設定 owner policy 和 viewer policy，不能只設其中一個

---

### C-002｜syncSettingsToCloud 三層 fallback 靜默降級
**發現時間**：Build 19 開發期間
**症狀**：爸爸手機有 15 種藥，但 Supabase 的 `med_list` 只有 12 種；`hospital_list`、`visit_type_list`、`doctor_list` 也沒有同步
**根本原因**：`syncSettingsToCloud` 的三層 fallback 設計（六欄 → 三欄 → 只有 med_list），本來是為了相容「新欄位還沒建好」的過渡期，但副作用是任何網路錯誤都會靜默降級，三個新欄位長期沒有同步，且完全沒有錯誤提示
**解法**：移除 fallback，改成單一 upsert，讓錯誤浮出來
**教訓**：過渡期的相容機制要設定明確的退場條件，不能無限期保留；靜默失敗比顯式報錯更危險

---

### C-003｜initSync 格式轉換錯誤導致症狀紀錄空白
**發現時間**：Build 19 之後（iPad 首次登入）
**症狀**：iPad 登入後症狀紀錄空白，但 Supabase 有資料
**根本原因**：`fetchOwnerLogs` 回傳的 `symptom` 是「、」分隔字串、`start_time` 是 ISO timestamptz，但 initSync 把這個格式直接存進 AsyncStorage，LogsContext 預期的是 `symptoms[]` 陣列和 `"YYYY/MM/DD HH:MM"` 格式
**解法**：新增 `normalizeLogForLocal()` 在存入 AsyncStorage 前統一格式轉換
**教訓**：雲端格式（snake_case、ISO 時間）和本機格式（camelCase、自訂時間字串）是兩套系統，任何方向的資料流都需要明確的格式轉換層

---

### C-004｜useSettings 與 initSync race condition 導致 Supabase 資料被預設值覆蓋
**發現時間**：Build 22 更新後
**症狀**：Supabase 裡爸爸的 `med_list` 從 15 種被覆蓋成 12 種（剛好等於 `MEDS_DEFAULT` 的長度），viewer mode 顯示 12 種藥
**根本原因**：兩個非同步流程沒有互相等待：
1. `AppProviders` 掛載時 `useSettings` 的 `useEffect` 立刻執行 `loadSettings()`
2. 本機沒有 `settings` key 時，`loadSettings()` 同步回傳 `MEDS_DEFAULT`（12 種）
3. `useSettings` 緊接著把這 12 種推上 Supabase，幾乎即時完成
4. `initSync` 的 `refreshSettingsFromCloud` 是網路請求，幾乎總是比步驟 3 慢
5. 錯誤的 12 種預設值搶先覆蓋了 Supabase 上正確的 15 種

**解法**：`loadSettings()` 新增 `hasLocalData: true/false`，`useSettings` 的 `syncSettingsToCloud` 加上 `if (s.hasLocalData)` guard，fallback 預設值永遠不推雲端；手動 SQL 還原爸爸的正確資料
**教訓**：App 啟動時有多條非同步流程並行，不能假設執行順序。任何「讀本機 → 推雲端」的操作，都需要先確認本機資料是真實的使用者資料，不是程式碼寫死的預設值。靜默的 fire-and-forget 推送在 race condition 下會造成難以追蹤的資料損毀

---

### C-009｜Build 24 白屏無法單點修復，整批退回 Build 23 行為
**發現時間**：Build 24 之後
**症狀**：部分裝置更新到 Build 24 後開啟 App 卡在純色畫面（白屏／深墨色屏），永遠進不了主畫面
**根本原因（第一輪誤判）**：一開始認為問題出在 `App.js` 的 `AppContent()` 多加的第三層閘道 `if (!isSettingsHydrated)`——只要 `useSettings.js` 裡「向 Supabase 拉 settings → 存 AsyncStorage → setState」這條非同步序列卡住、且 4 秒 timeout 也沒能觸發 fallback，`isSettingsHydrated` 就永遠停在 `false`，畫面因此永久卡住。
**第一次嘗試的解法（失敗）**：只移除「用 `isSettingsHydrated` 阻擋主畫面渲染」這個閘道本身，其餘 hydration 邏輯（`hasHydratedFromCloudRef`、cloud-first fetch、`syncQueue.js` 重試佇列等）維持不動。結果驗證後發現兩個問題：
1. **白屏依然發生**——代表真正的根本原因在更早的地方（很可能是 `AuthContext.js` 冷啟動時 `supabase.auth.getSession().then()` 與 `onAuthStateChange` 幾乎同時觸發、或某個 await 本身掛住），不是這層渲染閘道造成的，移除它治標不治本。
2. **引入新的資料遺失風險**——畫面提早出現後，使用者能在 `hasHydratedFromCloudRef.current` 還是 `false` 的視窗內操作（例如刪除清單項目），但這段期間 setter 會刻意跳過同步雲端；等雲端資料稍後回來，又把使用者剛剛做的本機變更蓋掉，導致「刪除後又復活」的問題重新出現。
**最終決定**：不再嘗試修補 hybrid 狀態，而是把 Build 24 新增的東西整批移除，回到乾淨的 Build 23 行為：
- `useSettings.js`：移除 `isSettingsHydrated`、`hasHydratedFromCloudRef` 與 cloud-first hydration `useEffect`；改回「本機沒資料（`hasLocalData === false`）才拉雲端當初始值」，六個清單的 setter 不再檢查任何 hydrated flag，本機一改就直接 fire-and-forget 推雲端
- 刪除 `src/lib/syncQueue.js`，`cloudSync.js` 移除所有 `enqueuePendingSync`/`flushPendingSyncQueue` 呼叫，失敗改回單純 `console.warn`
- 刪除 `CalendarScreen.js`，「月曆行程」「所有行程」搬回 `DailyMedScreen.js` 當子分頁，移除 `App.js` 裡獨立的「行事曆」Tab
- `initSync.js` 的 `LOCAL_DATA_INIT_FLAG` 改回 `localDataInitialized_v4`
**教訓**：白屏這類「完全進不去 App」的問題，在根本原因還沒確認前，不要只移除表面症狀的那一層防護——移除閘道前必須先驗證閘道本身就是唯一成因，否則很容易在原本問題沒解決的情況下，還把閘道原本附帶的保護（例如同步時機的安全 guard）一併拆掉，反而多造成一個資料遺失的新問題。C-005／C-006／C-008 和行事曆 UI 之後會另外、獨立地重新設計與測試，這次不在退回範圍內一併處理。

---

### C-010｜爸媽裝置白屏問題最終解決，但解法是 binary patch，不是原始碼修復
**發現時間**：C-009 退回之後
**症狀**：爸媽的裝置持續白屏，即使已經照 C-009 把 `src/` 底下完整退回乾淨的 Build 23 邏輯，直接用這份原始碼透過 `eas build` 建置測試，實際上**仍然是白屏**。
**最終解法**：不是原始碼修復。做法是在 `~/Desktop/build23-restore` 資料夾裡，手動把 Build 23 ipa（已驗證在爸媽裝置上正常運作）解開後的 `main.jsbundle` 與 `assets` 資料夾，直接置換進一個全新簽署的殼子（原本是 Build 27 build 出來的殼子）裡，取代殼子原本的 `main.jsbundle`／`assets`，再用 `codesign` 手動重新簽章，之後上傳 TestFlight。整個修復過程完全發生在原始碼與一般 build 流程之外，沒有經過 `src/` 的任何一行程式碼，也沒有經過 EAS 的正常 build pipeline。
**⚠️ 重要警示**：目前 `src/` 底下的原始碼狀態，是 C-009「完整退回 Build 23 邏輯」那次的重建版本（重新用現有原始碼手動重寫 `useSettings.js`／`cloudSync.js`／`App.js` 等，模擬 Build 23 的行為），**不是**直接從 Build 23 ipa 反解出來的原始碼，兩者不保證等價。這份重建版本本身**尚未被驗證能重現這次的修復結果**——目前手上唯一被證實「爸媽裝置不會白屏」的產物，是那個被 binary patch 過的 ipa，不是這份原始碼建置出來的 build。換句話說，`src/` 目前的狀態只是「看起來邏輯上應該等於 Build 23」，不是「已驗證等於能修好白屏的版本」。
**待辦**：
- 真正的白屏根本原因仍然未知。懷疑與 `AuthContext.js` 冷啟動時 `supabase.auth.getSession().then()` 與 `onAuthStateChange` 幾乎同時觸發、可能導致 `initializeAndMigrate()` 被重複呼叫有關，但**未證實**，需要實機重現 log 才能定位。
- 下次要重新挑戰 C-005／C-006／C-008 或行事曆功能之前，必須先解決「原始碼與實際運作版本不一致」這個落差——具體來說：需要先想辦法用目前 `src/` 這份原始碼透過正常 `eas build` 流程建置一次，實機驗證是否還會白屏。在這件事確認之前，不能假設 `src/` 目前的狀態是可信的基準點，也不能直接在這份原始碼上疊加新功能。
**教訓**：當「binary patch／手動置換」被拿來當作救急手段解決緊急問題時，一定要在文件裡明確記錄「這個修復繞過了原始碼」，否則之後任何人（包含自己）看到 App 已經正常運作，很容易誤以為目前的原始碼就是那個正常運作版本的真實來源，進而在一個未經驗證的基準點上繼續開發。