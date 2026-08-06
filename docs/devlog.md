# 健康記錄 App — 開發日誌

> 開發者：程歆雅（Xinya Cheng）
> 開發期間：2026年6月 — 2026年7月
> App 名稱：健康記錄 / Health Log
> Bundle ID：`com.sophiechenggg.healthlog`

> **2026/08 核對更正說明**：這份文件是歷史開發日誌，記錄「每個 build 做了什麼、遇到什麼
> 事故」，這種歷史敘事沒辦法單靠讀現在的程式碼重建，也不應該因為現在程式碼長得不一樣就
> 刪掉——Build 2 到 Build 32 的所有事件敘述維持原文，未經改動。本次只針對文件裡「這個機制
> 現在還存在／現在的架構是這樣」這類**對現況的描述**，逐一對照實際程式碼核對，對不上的地方
> 用（2026/08 核對更正）標註更正，不影響歷史敘事本身。`git --no-pager log --oneline --all`
> 只有 7 個 commit，資訊量遠不足以逐版核實這份日誌的細節，本次核對主要依據「現在的程式碼
> 有沒有這個東西」，查不到就標註為現況已不同，不代表否定歷史上曾經存在過。

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
| 24 | Jul 11 | Production（**白屏事故，已下架**）| mergeNew 修復 + hydration 強化 + 失敗重試佇列 + 行事曆 UI 改版，透過 `eas build` 送出後爸爸 iPad／媽媽 iPhone 全白屏，見 C-009 |
| 27 | Jul 11–12 | Production（**本機打包 + 手動簽章**）| 白屏修復：本機打包 Build 23 邏輯（不含行事曆改版），置換進乾淨殼子重新簽章送出，繞開 `eas build`，見 C-009／C-010 |
| 30 | Jul 12 | Production（**本機打包 + 手動簽章**）| 加回行事曆 UI 改版（本機打包含新功能 JS，同樣置換流程），**目前爸媽裝置上實際執行版本** |
| 31 | Jul 12 | Production（**實測失敗**）| 每日用藥前景刷新同步第一版，只監聽 AppState 轉場事件，冷啟動情境下從未被觸發，實機測試無效，見 Build 32 |
| 32 | Jul 12–18 | Production（**本機打包 + 手動簽章**）| 補上 useFocusEffect 涵蓋冷啟動 + 修正拉到資料未同步更新畫面的問題，本機驗證通過 |
| 33 | Jul 18–21 | Production（**本機打包 + 手動簽章**）| 前景刷新同步 pattern 延伸到 `appointments`（含 `note` 欄位），修正 `fetchOwnerAppointments` 真實錯誤時應 throw 而非靜默回傳空陣列 |
| 35 | ~Jul 21 | Production（**本機打包 + 手動簽章，目前爸媽裝置上實際執行版本**）| 貼布提醒間隔改為 36 小時；每日用藥 7 天歷史 Modal 加入 cloud pull 機制（`fetchDailyMedWithFallback`）；嗎啡貼布 DATE-trigger 通知路徑透過暫時測試按鈕實機確認正常發送 |

> Build 11–13 為 Development Build（用於測試，不在 TestFlight 列表中）
> Build 25–26、28–29、34：目前無對應的詳細紀錄，如之後要補上請提供內容再插入。
> Build 33、35 為概略記錄（依討論過程回填，非逐項核對過的完整記錄），細節如有出入以 Xinya 記憶或 git log 為準。

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

### Build 24｜Jul 11, 2026（上線後白屏，已下架）
**四個獨立問題的根因修復：mergeNew 復活刪除項目 / hydration 顯示時序 / 六合一同步互相覆蓋 / fire-and-forget 資料遺失**

Build 23 上線後，爸爸的 iPad 持續出現「已刪除的清單項目重新整理後又跑回來」「iPad 顯示的設定永遠跟手機不一致」「手機編輯的內容偶爾完全沒有同步到雲端」三種現象。逐一排查後確認這是四個獨立、疊加在一起的問題，不是同一個 bug 的殘留。

**問題一：`mergeNew()` 會把使用者主動刪除的預設項目復活（根本原因，優先級最高）**

`src/storage/index.js` 的 `loadSettings()`，過去每次讀取本機設定，都會用 `mergeNew(stored, defaults)` 拿現有清單跟寫死的預設值陣列（`MEDS_DEFAULT`、`SYMPTOMS_DEFAULT` 等六個）比對，只要預設值裡有一項不在本機清單中，就無條件補回去——不分辨這是「本機從沒存過」還是「使用者故意刪除過」。而且這個補值動作會直接寫回 AsyncStorage，永久污染本機快取，不只是當次畫面顯示錯誤。

診斷過程：使用者回報刪除「克利生」（藥物清單）、「脊椎僵硬」（症狀清單）、「其他」（行程類型清單）、將「林志鵬」改名為「林志芃」（醫生清單），四個清單重新整理頁面後都會讓被刪除／改掉的項目重新出現。比對發現四個「復活」的項目，剛好精準對應到六個 `*_DEFAULT` 常數陣列裡的內容，確認就是 `mergeNew` 造成的。

爸爸帳號雲端 `doctor_list` 一度同時存在「林志芃（疼痛科）」與「林志鵬（疼痛科）」兩筆，即是此 bug 的直接證據——改名操作內部是「新增新值＋刪除舊值」，刪除後的清單重新整理時被 `mergeNew` 復活了舊值，之後任一次同步又把復活的舊值一併推回雲端。

**修法**：`loadSettings()` 判斷邏輯改為「只有本機 `settings` key 完全不存在（`raw === null`，代表真正的全新裝置／首次使用）才套用預設值陣列作為起始清單；只要 key 存在（哪怕清單是空陣列），完全信任本機內容，不再拿預設值比對補值」。同時移除了「清單長度跟原本不同就寫回 AsyncStorage」的條件式寫回邏輯，改成只在版本遷移時才寫回，消除了正常讀取意外污染本機快取的路徑。

**問題二：`syncSettingsToCloud` 六合一 upsert，編輯任一清單會連帶覆蓋其他五個過期清單**

原本的同步函式每次呼叫都把當下 local state 的六個清單（症狀、藥物、過敏、醫院、行程類型、醫生）打包成單一 upsert 推上雲端。只要本機任何一個清單當下是過期的（例如受問題一影響、被 `mergeNew` 復活過），使用者編輯任何其他清單都會把那個過期清單一併覆蓋回雲端，抹掉雲端原本正確的版本。

**修法**：拆成 `syncListFieldToCloud(fieldName, listValue)`，每個欄位各自 `.update()` 單一欄位，不再用 `.upsert()` 整列覆蓋。六個 setter 各自只呼叫自己對應的欄位，互不牽連。

**問題三：登入／重新整理時，畫面會先顯示本機舊資料，雲端資料到位後才「補正」，而非等雲端確認後才顯示**

舊邏輯是 `useSettings` mount 時本機、雲端兩條非同步流程並行、互不等待，畫面先渲染本機（可能過期或被問題一污染的）資料，雲端資料回來後再覆蓋一次，中間有短暫的錯誤畫面閃現，且如果雲端請求恰好比某次「重新套用預設值」的本機寫入慢，就會重演 Build 22 的 race condition。

**修法**：改成嚴格序列——`AuthContext` 確認登入身份 → 從 Supabase 拉該帳號 settings → 存進本機 → `useSettings` 讀本機 → 顯示。新增 `isSettingsHydrated` state（非 ref，能觸發 re-render）驅動 `App.js` 的第四層畫面判斷（`isLoading` → `!session` → `session && !isSettingsHydrated`（沿用黑底 loading）→ 主畫面），畫面在雲端資料確認前完全不顯示，不會閃現任何內容。另外用獨立的 `hasHydratedFromCloudRef` guard 六個 setter：hydration 完成前呼叫的 setter 只寫本機，不推雲端，避免推送搶跑在讀取前面。加上 4 秒逾時 fallback：逾時改讀本機快取解除畫面卡死，但 `hasHydratedFromCloudRef` 保持 false，此期間的編輯仍不會誤推雲端；真正的雲端資料晚到時會自動追上、自我修復。

**問題四：所有 fire-and-forget 雲端寫入，失敗後資料靜默遺失，沒有任何重試機制**

專案一開始的設計就是這樣（見 Build 16 筆記），症狀紀錄、行程、病歷、每日用藥勾選、問診備忘五種資料的推送，失敗時只 `console.warn`，不重試、使用者無感、資料永久卡在本機。實測發現：離線編輯一筆藥物紀錄的劑量後恢復網路，這筆修改不會自動補推上雲端，需要使用者手動再操作一次才會被推送。

**修法**：新增 `src/lib/syncQueue.js`，提供 `enqueuePendingSync(entry)` 和 `flushPendingSyncQueue()`。五個 push 函式與四個 delete 函式（單筆刪除 + 病歷整年刪除）失敗時，改為把該筆操作記錄進 AsyncStorage 持久化的佇列（用資料表名＋主鍵或複合鍵去重，同一筆資料的多次失敗只保留最新一筆；同一筆資料先被更新佇列、後被刪除佇列，刪除會正確覆蓋更新），在每次 hydration 成功完成（`hasHydratedFromCloudRef.current = true` 之後）自動觸發 flush，依序重試佇列中所有項目，全程不跳出任何 Alert，符合「使用者不需要知道，只要最終真的同步成功」的需求。

**驗證方式**：這四項修法全程用 dev client 驗證，包含：模擬全新裝置（清空本機 settings，確認 hydration 四步驟＋畫面無閃現＋預設值不會被誤推雲端）、真實斷網情境（飛航模式，確認離線編輯不推送、恢復網路後 syncQueue 自動補推）、單欄位同步隔離性（編輯單一清單，SQL 逐欄比對其餘五欄完全不變）。

**⚠️ 後續（Jul 11）**：dev client 驗證通過後，正式版本另外加上了行事曆 UI 改版，透過正常 `eas build --profile production` 建置送出。上線後爆發白屏事故，詳見下方 Build 27／C-009／C-010。

---

### Build 27｜Jul 11–12, 2026（本機打包，繞開 eas build）
**白屏事故修復：改用本機打包 + 手動簽章送出**

Build 24 上線後，爸爸的 iPad、媽媽的 iPhone 打開 TestFlight App 立刻整片白屏（無延遲，非 loading 卡住），開發者自己的 dev client 完全正常、從未重現。完整排查與根本原因見 **C-009**。

排查後確認：**問題不在 Build 24 新增的功能本身**（完整退回原始碼、透過正常 `eas build` 重新建置測試，退回版本依然白屏），而是 `eas build`（EAS 雲端建置流程）本身，在這個時間點，產生的 JS bundle 跟真正能正常運作的版本，位元組層級就是不一樣——根本原因未知。

**解法（本輪起成為往後唯一送出流程，詳見 C-010）**：完全繞開 `eas build`，改用本機打包＋手動簽章。以下是實際跑過、確認有效的完整版本（folder 路徑、檔名以實際專案為準）：

**Step 1 — 本機用 Metro 打包 JS**（不經過 EAS 雲端）
```bash
cd ~/Downloads/Projects/HealthAppFresh
npx expo export:embed --platform ios --dev false \
  --bundle-output /tmp/new_bundle.jsbundle \
  --assets-dest /tmp/new_bundle_assets \
  --entry-file index.js
```

**Step 2 — 編譯成 Hermes bytecode**（`expo export:embed` 只做到 Metro 打包，不會自動編譯 bytecode，這是正式流程裡 Xcode 階段才會做的事，需手動補上）
```bash
node_modules/react-native/sdks/hermesc/osx-bin/hermesc \
  -O -emit-binary -out=/tmp/new_bundle.hbc /tmp/new_bundle.jsbundle
file /tmp/new_bundle.hbc   # 必須顯示 "Hermes JavaScript bytecode, version 96"
```
> ⚠️ 輸出路徑一定要在 `/tmp`，不要用 `~/Desktop`：Desktop 若開了 iCloud Drive 同步，會讓 hermesc 的暫存檔重新命名失敗（`No such file or directory`）。

**Step 3 — 解壓縮一份乾淨、已知能動的殼子**（原生層已驗證沒問題，可重複使用；工作資料夾直接在 `~/Downloads` 底下解壓縮，不要放 `~/Desktop`，見下方「本機打包簽章操作坑」的 iCloud 那條；路徑含空格，`cd` 一定要用雙引號整段包住）
```bash
cd ~/Downloads
rm -rf sync_test_extracted
mkdir -p sync_test_extracted
unzip -q "$HOME/Downloads/HealthApp Builds/02乾淨打包外殼/new_build.ipa" -d sync_test_extracted
ls sync_test_extracted/Payload/   # 應該看到 app.app
```

**Step 4 — 換檔案、改版本號、重新簽章**（送出前務必去 App Store Connect → TestFlight 核對目前最高 build number，版本號要比它更高，目前最高是 37，這裡假設下一版是 38）
```bash
cd ~/Downloads

cp /tmp/new_bundle.hbc sync_test_extracted/Payload/app.app/main.jsbundle
rm -rf sync_test_extracted/Payload/app.app/assets
cp -R /tmp/new_bundle_assets sync_test_extracted/Payload/app.app/assets

cp ~/Downloads/Projects/HealthAppFresh/credentials/ios/profile.mobileprovision \
  sync_test_extracted/Payload/app.app/embedded.mobileprovision

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 38" sync_test_extracted/Payload/app.app/Info.plist

xattr -cr sync_test_extracted/Payload/app.app
find sync_test_extracted/Payload/app.app -name ".DS_Store" -delete
find sync_test_extracted/Payload/app.app -name "._*" -delete
rm -rf sync_test_extracted/Payload/app.app/_CodeSignature
for fw in sync_test_extracted/Payload/app.app/Frameworks/*.framework; do
  rm -rf "$fw/_CodeSignature"
done

for fw in sync_test_extracted/Payload/app.app/Frameworks/*.framework; do
  codesign -f -s "iPhone Distribution: Xinya Cheng (Q3AB8UHDUY)" "$fw"
done
codesign -f -s "iPhone Distribution: Xinya Cheng (Q3AB8UHDUY)" \
  --entitlements "$HOME/Downloads/HealthApp Builds/02乾淨打包外殼/entitlements.plist" \
  sync_test_extracted/Payload/app.app

codesign --verify --deep --strict --verbose=4 sync_test_extracted/Payload/app.app
```
必須看到 `valid on disk` + `satisfies its Designated Requirement` 才能繼續下一步。工作資料夾在 `~/Downloads` 底下，不受 iCloud 同步干擾，正常情況一次就會過，不用像 Build 33 那次繞一輪才發現要搬家。

**Step 5 — 打包、送出到「已送出版本」歸檔**（`eas submit` 本身沒問題，只有 `eas build` 有問題，所以 submit 階段維持不變）
```bash
cd ~/Downloads/sync_test_extracted
zip -qry "$HOME/Downloads/HealthApp Builds/03已送出版本/sync_test_v38.ipa" Payload

cd ~/Downloads/Projects/HealthAppFresh
eas submit --platform ios --path \
  "$HOME/Downloads/HealthApp Builds/03已送出版本/sync_test_v38.ipa"

cd ~/Downloads
rm -rf sync_test_extracted   # 送出成功後工作資料夾可以直接刪，成品已經在「03已送出版本」了
```

本次只把「真正能動的 Build 23 邏輯」（不含行事曆改版）換進殼子，作為第一個安全網先確認白屏問題本身已解決。

---

### Build 30｜Jul 12, 2026（本機打包，加回行事曆）
**加回行事曆 UI 改版**

沿用 Build 27 建立的本機打包＋手動簽章流程，這次本機打包的 JS 內容包含行事曆 UI 改版的程式碼，同樣置換進乾淨殼子重新簽章送出。**這是目前爸媽裝置上實際在跑的版本**（在每日用藥同步這批改動送出前）。

---

### Build 31｜Jul 12, 2026（本機打包，實測失敗）
**每日用藥前景刷新同步（Phase 1 第一項資料類型）——第一版**

App 從最初設計開始就只有「本機 → 雲端」的單向 push，從未有「雲端 → 本機」的主動更新機制（詳見「已知架構限制」）。症狀：爸爸在手機上勾了藥、開了症狀紀錄，資料有推上 Supabase，但 iPad 永遠不會主動再去雲端拉一次最新版本，不管重新整理幾次都一樣。本次先針對 `daily_med_checks` 一項資料實作 Phase 1 解法：App 從背景切回前景時主動拉取雲端當下資料覆蓋本機畫面。

**檔案異動**：`DailyMedScreen.js`（主要邏輯）、`src/storage/index.js`（新增 `saveDailyMedLocalOnly`）、`src/lib/viewerData.js`（`fetchOwnerDailyMed` 錯誤處理修正）。

**核心邏輯**：
- `AppState.addEventListener('change', ...)`，用 `appStateRef` 判斷是否為「從非 active 變成 active」的瞬間，觸發時呼叫 `fetchOwnerDailyMed(ownerId, activeDate)`
- 只在 Owner 模式執行（`!isViewerMode`），Viewer 模式本來就有自己的 `useFocusEffect` 機制，不重複處理
- 拉回來的資料用新增的 `saveDailyMedLocalOnly()` 寫回本機——**特意不用**既有的 `saveDailyMed()`，因為那個函式會順便推回雲端，造成「拉下來又推上去」的無意義空轉

**順手修正一個潛在的資料覆蓋風險**：`fetchOwnerDailyMed` 原本 `if (error || !data) return {}`，把「當天雲端真的沒資料」（正常情況）跟「查詢層級錯誤，例如 RLS／連線問題」（不正常）混在一起處理，會導致查詢出錯時把本機正確資料靜默覆蓋成空的。已修正為用 `PGRST116` 錯誤碼分辨：查無資料回傳 `{}`，其他錯誤一律 `throw`，並確認三個呼叫點（前景刷新、Viewer 當日讀取、七日歷史迴圈）都有妥善的 `try/catch`。

**⚠️ 實機測試結果：裝上爸爸 iPad 後不管重新整理幾次都沒有更新畫面。** 根因見下方 Build 32：`AppState` 的 `change` 事件只會在「JS runtime 還活著、只是被暫停後醒過來」時觸發，但爸爸實際的使用間隔（數小時到一天）長到 iOS 幾乎必然已經把 App 進程默默終止，下次點開其實是冷啟動，不是喚醒——冷啟動當下沒有「之前的狀態」可以拿來比較轉換，所以這段程式碼實際上從未被觸發過。

---

### Build 32｜Jul 12–18, 2026（本機打包，實機驗證通過，App Store 送出中）
**每日用藥前景刷新同步——修正冷啟動缺口 + 修正「要關閉重開才看得到最新資料」**

**問題一：Build 31 只涵蓋「背景恢復」，沒有涵蓋冷啟動**（見上方 Build 31 測試結果）。解法：新增 `useFocusEffect`（`@react-navigation/native`），在 `DailyMedScreen` 每次取得焦點時（冷啟動後第一次進到這個 tab、從其他 tab 切回來、`AppState` 恢復）都觸發拉取，不再只依賴 `AppState` 的轉場事件。原本的拉取邏輯抽成具名函式 `refreshDailyMedFromCloud(source)`，`source` 參數記錄這次是被 `'AppState'` 還是 `'focus'` 觸發，`AppState` 監聽與 `useFocusEffect` 兩處呼叫同一支函式，不重複邏輯。

**問題二：即使 `useFocusEffect` 觸發、雲端資料確實拉到了，畫面第一次顯示的還是舊資料，要把 App 關掉重開才會顯示正確內容。** 根因：`refreshDailyMedFromCloud` 原本只把拉到的資料寫進 AsyncStorage（`saveDailyMedLocalOnly`），沒有同時更新畫面實際在渲染的 state——寫入硬碟跟畫面顯示是兩件事，只寫硬碟不會觸發重新渲染，要等下一次「初次掛載讀 AsyncStorage」才會被動撿到新值，造成「永遠慢一步」的假象。解法：`refreshDailyMedFromCloud` 拉到資料、寫入 AsyncStorage 的同時，直接呼叫畫面用來渲染的 `setChecked`（或對應 state setter）更新畫面。

**保護措施**：寫入 AsyncStorage（`saveDailyMedLocalOnly`）不論日期是否仍是使用者當下瀏覽的日期都會執行——落地寫本機快取本身沒有副作用；但更新畫面顯示（`setChecked`）**只有**日期仍對得上使用者當下的 `activeDate` 才會覆蓋，避免非同步拉取回來時使用者已經手動切到別的日期，卻被舊的拉取結果蓋掉畫面。

**除錯機制（暫時性，之後移除）**：「今日用藥」子分頁最上方加了一行小字 `syncDebugInfo`，顯示「上次同步時間／觸發來源（AppState 或 focus）／結果（成功／查無資料／錯誤訊息）」，只在 Owner 模式顯示，用來在正式環境（Console.app 看不到 production 的 `console.log`）肉眼確認同步邏輯有沒有跑、跑到什麼結果，不用再靠猜。**（2026/08 更新：已確認同步邏輯沒問題，`syncDebugInfo` 這段除錯文字已移除，見下方新增章節。）**

**打包送出流程**：沿用 Build 27 建立的本機打包 + 手動簽章流程（完整指令見 Build 27），版號設為 32。

**狀態**：本機驗證通過（自己裝置直接安裝簽章 ipa 測試，兩個問題皆已確認修復），目前 `eas submit --path` 送出中，等候 Apple 處理完成、進入 TestFlight 後讓爸爸更新測試。

---

### 下一輪修改｜2026/08（尚未打包送出，等候下次本機打包流程）

**同步（Layer 1）**
- `syncDebugInfo` 除錯文字確認移除（`CalendarScreen.js`；文件先前誤植成 `DailyMedScreen.js`，已一併修正，見上方 CLAUDE.md）
- `consult_memos`（問診備忘）補上前景刷新拉取同步，跟 `daily_med_checks` / `appointments` 對稱：
  - `saveConsultMemoLocalOnly(date, text)`（`storage/index.js`）：純寫本機，不觸發雲端推送
  - `refreshConsultMemoFromCloud(dateAtCallTime)`（`ConsultationMemo.js` 元件內，非 `cloudSync.js`——若放 `cloudSync.js` 會跟 `storage/index.js` 的既有 import 方向形成循環 import，因此改放元件層，這跟 daily-med／appointments 既有慣例一致）：`fetchOwnerConsultMemo` 拉資料 → 寫本機 → 更新畫面
  - 雙重防呆：`dateRef`（使用者是否還停留在同一天，避免非同步拉取結果蓋掉使用者已切換到的日期）+ `focusedRef`（使用者是否正在輸入中，避免拉取結果蓋掉還在 600ms autosave debounce 內、尚未推上雲端的最新按鍵內容）
  - `useFocusEffect` + `AppState` 雙觸發，僅 Owner 模式（檢視者模式本來就即時讀雲端，不需要這層）

**問診備忘 UX**
- 移除「清空」按鈕（含 `handleClear` handler、對應樣式），避免手滑誤刪整篇備忘；「儲存」按鈕不受影響
- 修正「點卡片空白處也會跳鍵盤」：`TextInput` 原本固定 `minHeight: 132` 撐滿卡片，改成用 `onContentSizeChange` 依內容高度自動調整，卡片裡文字以外的留白區域不再掛觸控事件
- 新增「＋ 新增一項」列，取代原本「點空白處新增」的隱性互動，點下去才 append 換行並 focus；移除舊的重複用途「＋ 條目」header 按鈕

**新功能：剪指甲提醒**
- 獨立通知，跟每日用藥勾選清單無關（不進 `defaults.js` / 不出現在任何勾選畫面）
- `src/lib/notifications.js` 新增 `ensureNailClipReminder()` + `scheduleNailClipReminderAt()`：10.5 天週期，固定 22:00（GMT+8），`date` 觸發器 + 冪等 identifier `reminder_nail_clip`；過期後往後遞推到真正落在未來的下一個時段，避免長時間沒開 App 導致新排程時間點仍落在過去被 iOS 靜默丟棄（沿用嗎啡貼布排查時得到的教訓）
- 掛載在 `App.js` 根層（`AppContent`），冷啟動 + `AppState` 回前景都觸發檢查
- `SettingsScreen.js` 的既有 `__DEV__` 專用除錯區塊底下加了一個暫時測試按鈕（30 秒後觸發），驗證完應移除或保留在 `__DEV__` 區塊內（不會進到正式版）

**行事曆分頁調整**
- 子分頁從三個（月曆行程／所有行程／今日用藥，舊版）精簡為兩個：**新增行程／所有行程**
- 預設開啟頁改為「所有行程」（原預設「新增行程」，爸爸反映找不到既有行程列表）
- 兩個分頁標籤文字加粗，選中/未選中狀態皆套用

**（2026/08 更新：以下「⚠️ 待確認」已核實解答）** 舊版「今日用藥」勾選清單（含刪除線、進度條）
目前的位置：**獨立的 Tab 3「每日用藥」，檔案是 `src/screens/DailyMedScreen.js`**——不在
`CalendarScreen.js` 底下，沒有被移除也沒有併入其他畫面，只是既有文件（`CLAUDE.md`／
`spec.md`）長期漏列這個檔案，才誤以為它消失了。詳見 2026/08 全面核對版 `docs/CLAUDE.md`。

**設定六個清單前景刷新同步（Layer 1 第 4 項資料類型，2026/08）**
- 對稱於 `daily_med_checks` / `appointments` / `consult_memos` 的既有 pattern，但實作位置
  不是複用「Build 21 就存在的 `refreshSettingsFromCloud`」——那支函式已經不存在於目前的
  `useSettings.js`／`initSync.js`（推測與下方「架構現況盤點」提到的 Build 23 rollback 有關，
  但無法完全確認），所以是在目前的 `useSettings.js` 裡重新加上同名的新函式，邏輯不是複用舊的
- 新增 `hydratedRef`（`useRef`，非 state，不驅動任何畫面切換）：擋前景刷新跟既有的首次
  hydration 邏輯搶跑
- `refreshSettingsFromCloud()`：拉六個清單，逐欄比對跟本機 ref 是否相同，只更新真的不同的
  欄位，寫入路徑跟既有的 `applyToState()` 一樣是純本機（`setXListRaw` + `saveSettings()`），
  不呼叫六個公開 setter（會觸發 `syncListFieldToCloud` 反推雲端）
- 觸發點：hydration 完成後，若這次是「信任本機、跳過首次雲端拉取」的分支就補打一次；另外在
  `useSettings.js` 內部掛 `AppState` 前景轉換監聽——沒有放在 `App.js` 或個別畫面，因為
  `useSettings()` 全 App 只會被 `AppProviders` 呼叫一次，效果上已經是全域層級，涵蓋
  `RecordScreen`／`LogCard`／`AppointmentSection`／`SettingsScreen` 等所有消費這六個清單的畫面
- **順手修正 `fetchOwnerSettings`（`viewerData.js`）的一個既有風險**：原本三層 fallback 全部
  失敗時會靜默回傳「六個清單全部是空陣列」，跟「使用者真的清空了六個清單」無法區分——這對
  舊的一次性 hydration（只在全新裝置上跑）沒有實際影響，但對「已經有本機資料的裝置」跑前景
  刷新來說，會讓一次網路失敗變成把本機正確資料覆蓋成空的。已改成該分支改為 `throw`，並同步
  補上三個呼叫端（`SettingsScreen.js`、`ViewerContext.js` 兩處）的 `.catch()`，失敗時保留原有
  畫面狀態，不覆蓋

**架構現況盤點（2026/08）**
`docs/CLAUDE.md`、`docs/spec.md` 累積了不少跟實際程式碼對不上的落差（部分是 Claude.ai 在
沒有程式碼讀取權限的情況下維護造成的）。逐一讀過 `src/` 全部檔案後全面重寫兩份文件，較大的
落差包含：Tab 數量搞混（每日用藥其實是獨立 Tab 3，不是設定的 Tab 3、也沒併入行事曆）、
設定頁六個清單長期只被記成三個、`syncMedListToCloud` 這個函式名稱不存在（實際是
`syncListFieldToCloud`）、`syncQueue.js`／`isSettingsHydrated`／`hasHydratedFromCloudRef`
在目前程式碼裡都不存在（見下方新增章節）、嚴重度 Slider 目前沒有對應 UI。完整差異見
2026/08 版 `docs/CLAUDE.md` 與 `docs/spec.md`，這裡不重複列出全部項目。`git --no-pager log
--oneline --all` 只有 7 個 commit，跟這份 devlog 記錄的 Build 2 到 35+ 逐版細節既對不上也
查不出矛盾，無法用來佐證或否證任何一筆歷史紀錄，本輪只更正「對現況的描述」，Build 2 到 32
的歷史事件敘述維持原文不動。

**驗證狀態**：以上除了剪指甲的排程遞推邏輯，其餘皆已 dev client 驗證 UI/邏輯正確；同步類
（consult_memos、設定六個清單 pull sync）與剪指甲的冷啟動排程邏輯仍需比照過去慣例，走一次
本機打包 + 手動簽章 + 實機測試才算數驗證，不能只靠 dev client 或程式碼審查判斷。

---

## 功能地圖（截至 Build 32）

> **（2026/08 核對更正）** 這份地圖是 Build 32 當下的快照，維持原文不動，但下列幾點截至
> 2026/08 已經不是現況，讀取時請一併對照 2026/08 版 `docs/CLAUDE.md`：
> - 「Tab 2 — 每日用藥」底下列的「月曆行程／所有行程」子分頁，現在是獨立的 Tab 2「行事曆」
>   （`CalendarScreen.js`，子分頁精簡為「新增行程／所有行程」兩個）；「今日用藥」現在是
>   獨立的 Tab 3（`DailyMedScreen.js`），不再是同一個 Tab 底下的子分頁
> - 「資料完整性保護」列的 `hasHydratedFromCloudRef guard` 與 `syncQueue.js`，目前程式碼裡
>   都不存在（`useSettings.js`／`App.js` 沒有任何畫面等待雲端確認的 gate，也搜尋不到
>   `enqueuePendingSync`／`flushPendingSyncQueue`）。推測與下方「Rollback to Build 23 logic
>   in source」那次 commit 有關（提交訊息本身也註明「unverified」），但無法完全確認這就是
>   唯一原因
> - 「推播通知」只列了抗凝血劑與嗎啡貼布兩項，目前還有牛肉精（`DAILY`，每天 12:00）與
>   剪指甲提醒（`DATE`，10.5 天週期）
> - 「Tab 3 — 設定」的六個清單／家人分享／登出仍準確，但現在是 Tab 4，不是 Tab 3

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
│   ├── 前景刷新同步（AppState 監聽 + useFocusEffect，回到前景或取得焦點時拉雲端覆蓋本機，Build 32，本機驗證通過）
│   └── [檢視者模式] 唯讀，checkbox disabled
│
├── Tab 3 — 設定
│   ├── 藥物過敏清單（CRUD）
│   ├── 藥物清單（CRUD + 雲端同步，單欄位更新）
│   ├── 症狀清單（CRUD，「其他」固定，單欄位更新）
│   ├── 醫院清單（CRUD + 雲端同步，「其他」固定，單欄位更新）
│   ├── 行程類型清單（CRUD + 雲端同步，「其他」可刪除，單欄位更新）
│   ├── 看診醫生清單（CRUD + 雲端同步，單欄位更新）
│   ├── 家人分享
│   │   ├── 產生邀請碼（6碼，48小時有效）
│   │   └── 輸入邀請碼（綁定檢視授權）
│   └── 登出
│
├── 推播通知（expo-notifications）
│   ├── 每日 10:30 AM + 10:30 PM（抗凝血劑）
│   └── 48小時換藥提醒（嗎啡貼布勾選後觸發）
│
├── 資料完整性保護
│   ├── hydration 嚴格序列（登入確認 → 拉雲端 → 存本機 → 顯示）
│   ├── hasHydratedFromCloudRef guard（拉取完成前不推雲端）
│   ├── syncQueue.js（五種資料 + 四個刪除函式的失敗自動重試佇列）
│   └── loadSettings() 只在真正首次使用時套用預設值
│
├── 部署管線
│   └── 本機打包 + hermesc 編譯 + 手動簽章（Build 27 起取代 `eas build`，見 C-009／C-010）
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

### C-005｜mergeNew() 把使用者主動刪除的預設項目復活，且永久污染本機快取
**發現時間**：Build 23 上線後，爸爸持續反映「刪除的東西重新整理又跑回來」
**症狀**：藥物清單刪除「克利生」、症狀清單刪除「脊椎僵硬」、行程類型清單刪除「其他」、醫生清單把「林志鵬」改名「林志芃」，重新整理頁面後全部復原成刪除／改名前的狀態；雲端 `doctor_list` 一度同時存在改名前後兩筆資料
**根本原因**：`loadSettings()` 內的 `mergeNew(stored, defaults)` 每次讀取都拿本機清單跟六個 `*_DEFAULT` 常數陣列比對，缺什麼就無條件補什麼，無法分辨「本機從未寫過」與「使用者故意刪除」；補值後還會直接寫回 AsyncStorage，永久覆蓋本機快取，不只是當次畫面誤顯示
**解法**：改為只有 `AsyncStorage.getItem('settings')` 回傳 `null`（代表真正首次使用）才套用預設值；只要本機曾寫過 settings，完全信任本機內容，不再拿預設值陣列比對補值；移除「長度不同就寫回」的條件式寫回邏輯，只在版本遷移時寫回
**教訓**：「補值 / 相容性 fallback」邏輯如果沒有區分「資料缺漏」與「使用者刻意操作」，會把使用者的刪除當成資料損毀來「修復」；任何會自動改寫使用者資料的邏輯，都必須明確定義觸發條件的邊界，且觸發後的寫回動作要謹慎——這是這整輪三次資料事故裡最根本的一個，且藏得最深，因為程式碼稽核只查「有沒有非 UI 呼叫 setter」抓不到，要靠比對「復活的項目剛好是預設值」這個規律性線索才找到

---

### C-006｜syncSettingsToCloud 六合一 upsert，編輯任一清單覆蓋其餘五個過期清單
**發現時間**：與 C-005 同期，兩者疊加造成連鎖污染
**症狀**：雲端爸爸的 `doctor_list` 同時存在改名前後兩個版本的醫生姓名
**根本原因**：`syncSettingsToCloud` 每次呼叫都把六個清單的 local state 打包成單一 `.upsert()`。只要其中一個清單被 C-005 復活成過期版本，使用者編輯任何其他清單觸發同步時，會把那個過期清單一併推上雲端覆蓋掉正確版本
**解法**：拆成 `syncListFieldToCloud(fieldName, listValue)`，六個 setter 各自只 `.update()` 自己對應的單一欄位，欄位之間互不牽連
**教訓**：「一次寫入多個邏輯上獨立的欄位」在分散式（本機＋雲端）系統裡是危險模式——任何一個欄位的本機狀態不可靠，都會連坐拖累其他原本正確的欄位；欄位粒度的寫入操作應該匹配欄位粒度的持久化保證

---

### C-007｜hydration 時序沒有嚴格化，畫面會閃現本機過期資料，且推送可能搶跑在雲端拉取之前
**發現時間**：Build 22（見 C-004）之後持續存在，Build 24 才徹底處理
**症狀**：iPad 開啟 App 時偶爾能看到本機舊資料先顯示一瞬間，才被雲端資料覆蓋；且不同裝置之間行為不一致（手機因本機一直沒過期而「看起來沒事」，iPad 因本機常態過期而持續把污染推回雲端）
**根本原因**：C-004 的修法只加了「本機是 fallback 預設值時不推雲端」的部分保護，沒有做到「畫面必須等雲端資料確認回來才顯示」與「推送必須等雲端拉取完成才被允許」這兩層完整的時序保證
**解法**：新增 `isSettingsHydrated`（`useState`，可驅動 re-render）與 `App.js` 第四層畫面判斷，登入後畫面等雲端 hydration 完成才切換到主畫面；`hasHydratedFromCloudRef` guard 涵蓋全部六個 setter；4 秒逾時 fallback 解除畫面卡死風險，且逾時期間仍不解除推送鎖定，雲端資料晚到時自我修復
**教訓**：「補一個 guard 擋住某個已知的錯誤觸發點」跟「重新設計整個時序，讓正確順序在架構上就是唯一可能發生的順序」是兩種不同層級的修復，前者容易漏掉尚未發現的觸發路徑，後者才能真正關閉整個問題類別

---

### C-008｜fire-and-forget 雲端寫入失敗後資料靜默遺失，無重試機制
**發現時間**：驗證 C-007 修法時意外發現（真實斷網測試）
**症狀**：離線編輯一筆症狀紀錄的用藥劑量，恢復網路後這筆修改沒有自動補推上雲端，需要使用者手動再次觸發才會同步；`symptom_logs`、`appointments`、`medical_history`、`daily_med_checks`、`consult_memos` 的推送與刪除函式全數受影響（見 Build 16 筆記，此為專案一開始的既有設計，非本輪新增問題）
**根本原因**：所有這類寫入從一開始就是 fire-and-forget，失敗只 `console.warn`，沒有任何持久化的重試機制
**解法**：新增 `src/lib/syncQueue.js`，失敗時把該筆操作（含資料表、操作類型、payload）記錄進 AsyncStorage 持久化佇列，用主鍵或複合鍵去重（同筆資料多次失敗只留最新一筆；更新與刪除用同一 key 時，後者正確覆蓋前者），每次 hydration 成功完成後自動 flush 佇列重試，全程無使用者可見的提示（符合實際需求：使用者不需要知道失敗細節，只要最終真的同步成功）
**教訓**：「fire-and-forget」對於使用者主動觸發、可以立即重試的操作或許可以接受，但對於背景資料同步（尤其是健康紀錄這種一旦遺失無法回溯的資料），必須有本機持久化的重試佇列作為最後一道防線；離線情境的測試不能只測「離線時不出錯」，還要測「恢復連線後資料真的補上了」

---

### C-009｜Build 24 白屏事故：`eas build` 雲端建置產出與本機驗證版本位元組不同，原因未知
**發現時間**：Build 24（C-005～C-008 修法 + 行事曆 UI 改版）透過 `eas build --profile production` 正式送出後，Jul 11
**症狀**：爸爸的 iPad、媽媽的 iPhone 打開 TestFlight App 的瞬間整片白屏，沒有零點幾秒的 loading 延遲；開發者自己的 dev client 完全正常，從頭到尾沒重現過
**已用實證排除的可能性**（逐一列出，避免之後重複排查同樣的方向）：
1. `react-native-worklets` missing peer dependency——Build 23（正常）與 Build 24（白屏）都缺這個依賴，不是差異點
2. 原生層級差異——直接比對兩個 ipa 的 Mach-O 執行檔字串（13,451 vs 13,453 行），唯二差異是簽章雜湊值與簽章時間戳記，證實原生完全沒變，問題 100% 在 JS 層
3. `useSettings()` 被重複呼叫——grep 全專案只有一處呼叫，排除
4. Console.app 篩選機制失效——已驗證篩選機制本身正常（清空篩選能跳出大量系統雜訊），套用關鍵字篩選是真的零結果，代表 production release 版的 `console.log` 沒有被轉送到系統 log；Crash Reports 也確認沒有任何相關紀錄，代表不是 native crash，比較像是「JS thread 卡住但沒真的崩潰」
5. Build 24 新增的功能本身（syncQueue、isSettingsHydrated、行事曆）——完整退回原始碼、重新透過正常 `eas build` 建置測試，**退回後依然白屏**，代表白屏原因不在這些新功能裡，是更早、更根本的東西
**根本原因**：正常 `eas build`（EAS 雲端建置流程）產生的 JS bundle，跟真正能正常運作的 Build 23 的 JS bundle，位元組層級是不一樣的——**原因至今未知**。不管原始碼邏輯上「看起來」多麼等於 Build 23，透過 EAS 雲端建置出來的東西就是會白屏
**解法**：完全繞開 `eas build`，改用本機 Metro 打包 + 本機 `hermesc` 編譯 + 手動置換進乾淨殼子 + 手動簽章 + `eas submit --path` 送出（詳細步驟見 Build 27）。此流程已驗證多次成功，往後所有正式版本一律採用，不再使用 `eas build`
**教訓**：原生層與 JS 層要分開驗證（Mach-O 字串比對可以快速排除原生問題，把排查範圍收斂到 JS 層）；「沒有 crash report」不代表沒問題，也可能是 JS thread hang 而非真正 crash；production release 的 Hermes build，`console.log` 不會被轉送到 iOS 系統 log，不能依賴 Console.app 除錯 production build 的 JS 層錯誤；當「退回到已知正常的原始碼、用同一套建置流程建置，結果依然重現問題」，代表問題出在建置流程本身，不在程式碼邏輯，該把懷疑對象從程式碼轉移到工具鏈

---

### C-010｜git 上的原始碼與裝置上實際運作的 app，不是同一份被驗證過的東西
**發現時間**：C-009 白屏事故排查期間，Jul 11–12
**症狀**：即使把原始碼邏輯完全退回到「看起來」跟 Build 23 一樣，透過正常 `eas build` 重新建置出來的版本依然白屏；真正能正常運作的版本，全部都是「本機打包 + 手動置換」的產物，不是任何一次 `eas build` 的直接輸出
**根本原因**：EAS 雲端建置流程本身，為什麼會產生跟本機建置不一樣的結果，根本原因未解開（曾比對過真正 Build 23 跟「透過正常 eas build 重建、從未驗證過」版本的 bytecode 字串差異，發現的差異很細碎，沒有找到像 Mach-O 比對那樣一眼能認出的兇手）
**因應**：建立「本機打包 + hermesc 編譯 + 手動簽章」為往後**唯一**的正式版本送出流程（見 Build 27），`eas build` 在正式版本上暫停使用；`git diff` 只能檢查邏輯是否合理，不能證明這份原始碼建置出來會不會動——**每次改完程式碼，都必須實際走一次本機打包流程、裝到自己手機測試過，才算數驗證**，不能只靠看程式碼邏輯就假設沒問題
**教訓**：「原始碼看起來正確」和「建置出來的產物實際能動」是兩件事，中間夾著整條建置工具鏈，工具鏈本身也可能是故障來源；當工具鏈的行為未知且不穩定時，「有沒有實機驗證過」比「程式碼邏輯有沒有審查過」更該是判斷一個版本能不能出貨的標準；如果之後要認真查 EAS 雲端建置的根因，`ver27.ipa`（未置換過的原始樣本）跟 `old_build23.ipa`（真正原廠 Build 23）是現成的比對材料

---

## 已知架構限制

### 跨裝置即時同步尚未實作

目前架構是 **offline-first + 單向 push（本機 → 雲端）**，只有登入／App 重新啟動時的一次性 hydration 會把雲端資料拉回本機，之後裝置執行期間不會再主動拉取。這代表：

- 裝置 A 編輯一筆資料並成功推上雲端後，裝置 B（同一帳號，App 保持開啟中）**不會**自動看到這筆更新，除非裝置 B 重新啟動 App（觸發新一次 hydration）
- 這不是 bug，是最初 offline-first 設計選擇的已知代價（單裝置情境下完全合理，多裝置同帳號情境下才暴露出缺口）

**評估過的解法**：

| 方案 | 優點 | 缺點 | 狀態 |
|------|------|------|------|
| App 回到前景時重新拉取 | 實作簡單，符合大多數使用情境（不太可能兩台裝置同時操作）| 仍非即時；需額外設計「避免覆蓋還沒推送成功的本機編輯」的保護，否則會重新引入 C-007 類型的問題 | **實作中**，見下方分層推進 |
| Supabase Realtime 訂閱 | 真正即時，免費（不需升級方案）| 需要在每個畫面加入訂閱邏輯，改動範圍較大 | 未開始，留待前景刷新全部資料類型都上線後再評估 |

實務上，因為主要使用情境是「爸爸一天內在單一裝置上操作為主，不同裝置間有數小時到一天的間隔」，選擇先做風險較低、實作量較小的「前景刷新」（Layer 1），Realtime 雙向即時同步（Layer 2）留待後續，避免像 C-005～C-008 那樣一次疊太多功能難以排查。

**Layer 1（前景刷新）分層推進進度**：
1. **每日用藥（daily_med_checks）**——✅ 完成（Build 31 冷啟動未觸發 → Build 32 補 useFocusEffect + 修正畫面未同步更新），**本機驗證通過**
2. **行程（appointments）**——✅ 完成（Build 33，含 `note` 欄位）
3. **問診備忘（consult_memos）**——✅ 完成（2026/08，見上方「下一輪修改」章節，額外加了 `focusedRef` 防呆避免拉取蓋掉使用者正在輸入中的內容），**尚未打包送出、待實機驗證**
4. **設定頁六個清單**——✅ 完成（2026/08，見上方「下一輪修改」章節），**尚未打包送出、待實機驗證**。原本評估要複用「Build 21 就存在的既有 hydrate 邏輯」，但實際動手時發現那支舊版 `refreshSettingsFromCloud`（連同 C-007 描述的 `hasHydratedFromCloudRef`／`isSettingsHydrated`）已經不存在於目前程式碼，因此是在目前的 `useSettings.js` 裡重新實作同名函式，不是複用舊邏輯
5. **其他資料類型（症狀紀錄、病歷）**——尚未開始

### `defaults.js` 內含真實個人健康資訊

`src/constants/defaults.js` 裡的 `MEDS_DEFAULT`、`DOCTOR_DEFAULT` 等常數，內容是爸爸真實的用藥清單與看診醫生姓名（專案初期直接把當時的真實資料寫死當作預設值），這也是 C-005 mergeNew bug 之所以「復活」的內容剛好都是真實敏感資訊的原因。如果之後要將此 repo 公開（例如作品集用途），這些內容必須先替換成去識別化的範例資料，目前僅限 private repo 內部使用。