# 健康記錄 App — 完整規格書（2026/08 全面核對版）

> 本次全面重寫：直接讀取實際程式碼庫作為唯一權威來源，反映**目前實際上線的行為**，
> 不是最初設計時的規格。原規格書中已經不存在於程式碼裡的功能（例如「嚴重程度 Slider」、
> 「每日用藥 Tab 底下的月曆行程／所有行程子分頁」）一律以現況為準，不保留舊規格內容。
> 架構層面的說明（技術棧、資料模型、雲端同步邏輯）與 `docs/CLAUDE.md` 重複的地方，此處
> 只列與畫面規格直接相關的摘要，完整版見 `docs/CLAUDE.md`。

## 1. 專案概覽

### 定位
肺癌病患（ChengJui Hsi）的家庭健康追蹤 App。核心使用情境：
- 病患在日常生活中記錄症狀、用藥、回診行程
- 就診時能快速回顧症狀時間序列、自行服藥、醫生診斷，方便與醫師溝通
- 家人可透過邀請碼授權，以唯讀模式即時查看所有健康紀錄

### 使用者角色
| 角色 | 說明 | 對應帳號 |
|------|------|---------|
| Owner（擁有者）| 病患本人，可完整讀寫所有資料 | ChengJui Hsi（`423e495b-434a-48a7-8ab2-c48ce93c7917`）|
| Viewer（檢視者）| 家人，透過邀請碼授權，唯讀模式 | 程歆雅、程偉綸等 |

---

## 2. 技術規格摘要

完整版本號、依賴清單見 `docs/CLAUDE.md`「技術棧」。重點：
- React Native `0.81.5` + Expo `~54.0.0`，Bundle ID `com.sophiechenggg.healthlog`
- Supabase 為雲端後端，Apple Sign In 為唯一登入方式
- 正式版本部署走**本機打包 + 手動簽章**，`eas build` 停用於正式版本（詳見 `docs/CLAUDE.md`「更新與打包流程」）
- `@react-native-community/slider`、`react-native-reanimated`、`react-native-gesture-handler`
  已安裝但目前程式碼沒有實際使用

### 環境設定
```
# .env（不得 commit）
EXPO_PUBLIC_SUPABASE_URL=https://npizltqgwfcrldmzsyyx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

---

## 3. 資料架構摘要

完整 AsyncStorage key／Supabase 資料表欄位／camelCase↔snake_case 對應表見
`docs/CLAUDE.md`「資料模型」，此處不重複列出。與畫面規格直接相關的重點：

- Settings（本機 `"settings"` key、Supabase `profiles` 表）是**六個**清單：`symptomList` /
  `medList` / `allergyList` / `hospitalList` / `visitTypeList` / `doctorList`，不是三個
- `SymptomLog` 有 `severity`（1–10）與 `reliefSeverity`（0–10）兩個數值欄位，但**目前所有
  畫面都沒有可調整這兩個數值的 UI**——`severity` 送出時固定寫死 `5`；`reliefSeverity` 只在
  `LogCard.js` 顯示（`log.reliefSeverity !== null` 時渲染文字），沒有找到任何寫入
  `reliefSeverity` 的互動路徑
- `Appointment.type` 的完整選項是 `VISIT_TYPE_DEFAULT`：門診／抽血／MRI／CT／**骨掃描**／
  X光／慢簽／復健／其他（九項，含骨掃描）

### 前景刷新拉取同步（Pull Sync）現況

App 從最初設計就只有「本機 → 雲端」的單向 push，沒有「雲端 → 本機」的主動更新機制。裝置 A
編輯資料並成功推上雲端後，裝置 B（同帳號、App 保持開啟中）不會自動看到更新，除非重新啟動
App 觸發一次登入時的 hydration（僅限 settings 六個清單以外的資料類型；settings 六個清單連
「重新啟動 App 就會拉最新版」都不成立，見下方）。

正在分資料類型逐步補上「App 前景化時主動拉一次」的機制（`AppState` 前景轉換 + 進入畫面
`useFocusEffect` 雙觸發，只在 Owner 模式執行）：

| 資料類型 | 狀態 |
|---------|------|
| daily_med_checks（每日用藥）| 完成，本機驗證通過 |
| appointments（行程）| 完成 |
| consult_memos（問診備忘）| 完成，尚未打包送出實機驗證 |
| settings 六個清單 | 完成，尚未打包送出實機驗證 |
| symptom_logs（症狀紀錄）、medical_history（病歷）| 尚未開始——這兩類資料目前仍是「重開 App
才會拉最新版」，App 開著期間不會自動更新 |

完整實作細節（各資料類型對應的 `*LocalOnly()` 寫入函式、拉取函式、掛載位置）見
`docs/CLAUDE.md`「雲端同步邏輯」。

---

## 4. 應用程式架構摘要

### 4-1. 進入點與 Provider 層級

```
index.js
  import 'react-native-get-random-values'   ← 必須最頂端
  import 'react-native-url-polyfill/auto'   ← Supabase 需要
  registerRootComponent(App)

App.js
  SafeAreaProvider
    AuthProvider              ← session / signInWithApple / signOut
      ViewerProvider          ← viewableOwners / activeOwner / isViewerMode / ownerSettings
        AppProviders          ← SettingsContext（六個清單）+ LogsContext + MedicalHistoryContext
          AppContent
            isLoading → 黑底 View（避免閃爍）
            !session  → LoginScreen
            session   → NavigationContainer + Tab.Navigator（5 個 Tab）+ IdentitySwitcher
            （AppContent 這層另外掛了剪指甲提醒的 AppState 監聽，跟畫面顯示邏輯無關）
```

**沒有任何「等 settings 六個清單雲端資料確認回來才顯示畫面」的 gate**——舊規格描述的
`isSettingsHydrated` 機制目前不存在，`useSettings.js` 掛載後立刻用本機資料渲染畫面，雲端
資料是否需要補值是之後才非同步確認的事。

### 4-2. Context 清單

| Context | 檔案 | 管理內容 |
|---------|------|---------|
| AuthContext | `src/context/AuthContext.js` | session, user, isLoading, signInWithApple, signOut |
| ViewerContext | `src/context/ViewerContext.js` | viewableOwners, activeOwner, setActiveOwner, isViewerMode, ownerSettings, refreshOwnerSettings |
| SettingsContext | `src/context.js`（透過 `useSettings()` hook）| symptomList, medList, allergyList, hospitalList, visitTypeList, doctorList + 六個 setter |
| LogsContext | `src/context.js` | logs, logsReady, addLog, updateLog, deleteLog |
| MedicalHistoryContext | `src/context.js` | medicalHistory, medReady + CRUD |

完整資料夾結構見 `docs/CLAUDE.md`「資料夾結構」（此處不重複列出，避免兩份文件互相漂移）。

---

## 5. 畫面規格

### 5-1. 登入畫面（LoginScreen）
- 顯示時機：`session === null`
- 畫面中央：App 名稱「健康記錄」「私人醫案手帳」副標 + 「以 Apple 帳號登入」提示
- 按鈕：`AppleAuthentication.AppleAuthenticationButton`（buttonStyle: BLACK），登入中顯示 `ActivityIndicator`
- 失敗時顯示錯誤文字（使用者主動取消登入，`ERR_REQUEST_CANCELED`，不顯示錯誤）
- 風格：民國墨帳，深墨底色，標楷體

### 5-2. Tab 0 — 記錄症狀（RecordScreen）

**擁有者模式：**
- 症狀多選（`SymptomMultiPicker`，取值自 `symptomList`）；選「其他」時顯示自由輸入欄
- 開始時間：依當下時間自動判斷「上午（9:00）／中午（12:00）／下午（15:00）」代表時刻，按「調整」可手動改日期與時段（沒有精確到分鐘的時間輸入）
- 自行服藥多選（取值自 `medList`，`allowOther`）
- 備註欄：多行 `TextInput`，focus 時上方出現「完成」按鈕收鍵盤
- 送出按鈕「記錄」：未選症狀時 disabled；送出後清空表單重置為預設狀態
- 送出的 log 沒有嚴重度輸入 UI，`severity` 固定為 `5`；`endTime`／`doctorDiagnosis`／`doctorMed`／`reliefSeverity`／`reliefNote` 皆為 `null`（這些欄位由 Tab 1 的補填功能事後填寫）

**檢視者模式：**
- 顯示「閱」字印章 + 「目前為查看模式」+「無法在查看他人記錄時新增症狀紀錄」+「請在上方切換回『查看自己』」三行文字，不顯示任何表單欄位

### 5-3. Tab 1 — 歷史紀錄（HistoryScreen）

子分頁：**症狀紀錄 / 病　　歷**（只有 2 個，「分享」是「病歷」子分頁內的按鈕，不是獨立子分頁）

**症狀紀錄：**
- 頂部篩選列：「篩選症狀」下拉（列出曾出現過的所有症狀）+ 「歷史」開關
- 判定規則：有 `doctorDiagnosis` 或 `doctorMed` 任一有值即視為「已解決／歷史紀錄」，預設隱藏，
  除非篩選了特定症狀或開啟「歷史」開關才會顯示
- 按日期分組（降冪），每組有日期分隔線（`DateGroupHeader`）
- 每張 `LogCard` 分上下兩區：
  - 上：症狀名、起訖時間、自行服藥／醫生診斷／醫生用藥／緩解狀況（有值才顯示對應色塊）
  - 下：「補填醫生診斷・確認用藥」或「編輯補充資料」按鈕 → 展開 inline 補填表單
- 補填表單欄位：醫生診斷、醫生確認用藥（至少填一項才能儲存，除非展開了「修改原始症狀記錄」）；
  展開「修改原始症狀記錄」後可另外改症狀、開始時間、自行服藥
- **過敏藥物模糊比對警示**：儲存時若「醫生確認用藥」文字模糊匹配到 `allergyList` 裡任一項目
  （逐字比對＋Levenshtein 編輯距離容錯：長度 3–8 容錯 1 個字元、9 以上容錯 2 個字元），跳出
  「過敏藥物警示」Alert，需使用者選擇「確認儲存」才會真的存檔，選「返回編輯」則取消
- 刪除記錄需二次確認（Alert）

**病歷：**
- 頂部：新增年份輸入框（限制 1900–2200）+ 新增按鈕
- 按年份降冪分組，每年可展開/收合；可新增/編輯/刪除個別記錄（月份 + 內容文字），也可刪除整年（連帶刪除底下所有記錄，需二次確認）
- 「分享」按鈕：把整份病歷格式化成純文字，呼叫 `Share.share()` 叫出系統分享選單

**檢視者模式：**
- 頂部橫幅：「● 目前查看：{name} 的紀錄」
- 隱藏所有新增/編輯/刪除按鈕，`LogCard` 與 `MedicalHistoryView` 皆 `readOnly`
- 資料來源：`fetchOwnerLogs` / `fetchOwnerMedicalHistory`，進入此 Tab 時（`useFocusEffect`）重新拉一次

### 5-4. Tab 2 — 行事曆（CalendarScreen）

子分頁：**新增行程 / 所有行程**（舊規格描述的三分頁「月曆行程／所有行程／今日用藥」結構已不存在）

- **預設開啟頁為「所有行程」**（2026/08 起；原預設「新增行程」，爸爸反映找不到既有行程列表）
- 兩個分頁標籤文字皆為粗體（`fontWeight: '700'`），選中/未選中狀態都套用

**新增行程模式：**
- 月曆（`CalendarView`）：有行程的日期標小點，點年月標題可開 Picker Modal 快速跳頁
- 點日期進入詳情頁：返回按鈕 + 「今日」快捷按鈕 + 該日行程列表（`AppointmentSection`，
  `timeOnly` 模式，表單只需選時間不需選日期）+ 問診備忘（`ConsultationMemo`）

**所有行程模式：**
- 依日期排列所有行程（未來優先，`showPast` 開關切到過去優先降冪）
- 頂部類型／醫院雙篩選下拉 + 「歷史」開關（含過去日期）
- 點行程卡片進入詳情頁（完整表單，含日期時間 + 醫院 + 類型 + 醫生 + 備註 + 問診備忘）

**行程表單欄位：**
- 日期時間：非 `timeOnly` 時先選日期（native date-only picker）再選時間；`timeOnly` 時只選
  時間。兩種情況下的「時間」一律走自訂 24 小時制 Picker（`00~23 時` + `00,05,10,…,55 分`，
  分鐘只能是 5 的倍數），不使用 native 的 12/24 小時制顯示（那個是跟裝置系統設定走，無法保證
  一定顯示 24 小時制）
- 醫院：下拉選單（`hospitalList`），選「其他」時出現自訂輸入框
- 行程類型：下拉選單（`visitTypeList`），預設「門診」
- 看診醫生：只有行程類型為「門診」時才顯示（`doctorList`），可留空
- 備註：單行 `TextInput`

**問診備忘（ConsultationMemo）：**
- 綁定日期，一天一筆（`consultMemo_YYYY-MM-DD`），同一天多筆行程共用同一份備忘
- 內容變更後 600ms debounce 自動存檔（不是即時逐字存檔）
- Enter 換行時自動補上「• 」條列符號
- **「清空」按鈕已移除**（2026/08，避免手滑誤刪整篇備忘），只保留「儲存」（自動存檔，無需手動按鈕）
- **點文字內容才會 focus 跳出鍵盤**：`TextInput` 高度依內容自動調整（`onContentSizeChange`），
  卡片裡文字以外的留白區域是純背景 View，點下去不會觸發 focus（2026/08 修正，原本整張卡片
  都會觸發）
- 新增一行用卡片下方「＋　新增一項」列（原本 header 的「＋ 條目」按鈕已移除，功能合併到這裡）
- 有內容且未 focus 時顯示字數統計

**檢視者模式：**
- 隱藏「+ 新增」行程按鈕，行程表單 `readOnly`，問診備忘唯讀

### 5-5. Tab 3 — 每日用藥（DailyMedScreen）

> 舊規格把這個功能寫在「Tab 2 每日用藥」底下、與行事曆合併成一個 Tab；實際上這是獨立的
> 第 4 個 Tab（第 5 個是設定），檔案是 `DailyMedScreen.js`，沒有月曆行程、所有行程這兩個
> 子分頁——那兩個現在是 Tab 2 行事曆的內容。這個 Tab 只有單一畫面，沒有子分頁。

- 日期標題：固定顯示今日（這個畫面沒有切換日期的 UI）
- 進度卡：已服 X / 總計 N，進度條（刻度 tick + 硃砂色填色），全部勾完顯示「今日用藥已全部確認」banner
- 藥物清單：勾選框 + 藥名（`medList` 全部項目），勾選後文字加刪除線、狀態框變實心硃砂紅「服」字
- 勾選「嗎啡貼布」會排程 36 小時後的換貼提醒推播；取消勾選則取消該筆排程
- 「歷史」按鈕：開啟近 7 日用藥紀錄 Modal，可切換「依日期」／「依藥物」兩種檢視模式

**檢視者模式：**
- 唯讀，checkbox disabled，隱藏歷史以外的互動
- 分母清單來源：`fetchOwnerMedList(ownerId)`（`profiles.med_list`），若為空則 fallback 成
  `fetchOwnerAllMedKeys(ownerId)`（該 owner 所有歷史勾選記錄裡出現過的藥名聯集）

### 5-6. Tab 4 — 設定（SettingsScreen）

> 舊規格寫「三個 section」，實際是**六個**清單編輯區塊。

**六個可編輯清單**（皆為：列表顯示 + 各項可編輯/刪除 + 底部輸入框與新增按鈕）：
1. 藥物過敏清單（`allergyList`）
2. 藥物清單（`medList`）
3. 症狀清單（`symptomList`，「其他」固定在末尾，顯示「固定項目」樣式、不可刪除）
4. 醫院清單（`hospitalList`，「其他」固定不可刪除）
5. 行程類型清單（`visitTypeList`，「其他」可刪除）
6. 看診醫生清單（`doctorList`）

每個清單變更後各自呼叫 `syncListFieldToCloud(fieldName, list)`，只更新 Supabase `profiles`
表對應的單一欄位，不會連帶覆蓋其他五個欄位。

**家人分享：**
- 產生邀請碼：6 碼大寫英數（排除 0/O/1/I），有效期 48 小時，`INSERT` 進 `invite_codes`
  （欄位：`owner_id`／`code`／`expires_at`）
- 成功後以硃砂大字顯示邀請碼 + 分享按鈕（`Share.share()`）
- 可重新產生（覆蓋顯示，不會撤銷舊碼）
- 輸入邀請碼：輸入框（`autoCapitalize="characters"`，限 6 字）+ 綁定按鈕
- 呼叫 `supabase.rpc('redeem_invite_code', { invite_code })`，失敗時 Alert 顯示錯誤訊息

**`__DEV__` 專用除錯區塊**（正式版本不會出現，`!isViewerMode && __DEV__` 才渲染）：
- 「同步設定到雲端」：逐欄呼叫 `syncListFieldToCloud`，Alert 顯示結果
- 「清除 `localDataInitialized` flag」：目前清除的 AsyncStorage key 名稱與 `initSync.js`
  實際使用中的 flag（`localDataInitialized_v4`）不一致，如實記錄現況

**登出：**
- 按鈕 + Alert 確認（「確定要登出嗎？」）
- 呼叫 `supabase.auth.signOut()`

**檢視者模式：**
- 隱藏家人分享整個區塊與 `__DEV__` 區塊
- 六個清單皆唯讀，資料來源是 `fetchOwnerSettings(activeOwner.id)` 直接讀雲端（不經過
  `SettingsContext`，也就是不經過本機快取，每次切換 owner 都重新拉一次）

---

## 6. 家人共享系統

### 6-1. 邀請碼流程
1. Owner 在設定頁面點「產生邀請碼」
2. 系統產生 6 碼大寫英數字串，`INSERT` 進 `invite_codes` 表，有效期 48 小時
3. Owner 透過系統分享選單把邀請碼傳給家人
4. 家人打開 App，登入後進設定，輸入邀請碼按「綁定」
5. App 呼叫 `supabase.rpc('redeem_invite_code', { invite_code })`
6. 資料庫函式驗證（存在、未過期、未使用、非自己邀自己——驗證邏輯在 RPC 內部，client 端
   程式碼看不到，無法從前端核實細節），寫入 `viewer_access`
7. 成功後 Alert 顯示結果

### 6-2. 身份切換（IdentitySwitcher）
- 顯示條件：`viewableOwners.length > 0`
- 位置：AppHeader 下方、Tab.Navigator 上方
- 內容：「查看自己」按鈕 + 各 owner 姓名按鈕
- 樣式：active 狀態用硃砂色底色

### 6-3. 檢視者資料來源（viewerData.js）

完整函式清單見 `docs/CLAUDE.md`「雲端同步邏輯」→「`viewerData.js` 函式清單」，此處不重複。

### 6-4. RLS 規則摘要
- 所有表 RLS 開啟
- Owner：對自己資料全權限（SELECT / INSERT / UPDATE / DELETE）
- Viewer：只能 SELECT，條件是 `viewer_access` 表中有對應的 `accepted` 授權
- `redeem_invite_code` 函式為 `SECURITY DEFINER`，繞過 RLS 寫入 `viewer_access`

---

## 7. 設計規範

### 7-1. 設計方向：「民國醫案墨帳」
像一本有溫度的私人醫案手帳。深墨封面、宣紙頁、硃砂印記、金色裝飾線。
不要現代感、不要紫色、不要 AI 美學。

### 7-2. 字型
- iOS：`STKaiti`（標楷體）
- Android：`serif`
- 全程統一使用，不混用其他字型

### 7-3. 色彩系統
**唯一來源：`src/constants/colors.js`，不得在其他檔案硬寫色碼。**

| 角色 | 說明 |
|------|------|
| `colors.bg` | 宣紙暖米（頁面背景）|
| `colors.header` / `colors.headerDeep` / `colors.headerMid` | 深墨色漸層（Header、Tab Bar）|
| `colors.cinnabar` | 硃砂紅（CTA 按鈕、印記、active 狀態）|
| `colors.gold` / `colors.goldLight` / `colors.goldFaint` | 舊金（裝飾線、邊框、inactive Tab）|
| `TYPE_COLORS`（行程類型）| 門診＝硃砂／抽血＝靛／MRI＝苔綠／CT＝褐／骨掃描＝灰藍／X光＝舊金／慢簽＝橄欖／復健・其他＝muted |

> 舊規格提到的「嚴重度 1–3 青瓷 / 4–6 琥珀 / 7–10 緋色」分級用色，目前程式碼裡沒有對應的
> UI 在使用（`severity` 沒有輸入介面，見上方第 3 節），`colors.js` 裡確實有
> `textSelfMed`／`textDiagnosis`／`textDoctorMed`／`textRelief` 這組語意色，但用途是
> `LogCard.js` 裡不同欄位類型的標籤色，不是嚴重度分級。

### 7-4. Tab 圖示
單字楷書漢字置於小方框（印章樣式），共 5 個：
- Tab 0：記
- Tab 1：史
- Tab 2：曆
- Tab 3：藥
- Tab 4：設

---

## 8. 開發流程

完整打包/簽章步驟、EAS 額度、TestFlight 測試人員清單見 `docs/CLAUDE.md`「更新與打包流程」，
此處不重複列出以避免兩份文件漂移。重點提醒：

- 正式版本一律**本機打包 + 手動簽章**，`eas build --profile production` 停用
- Development Build（`eas build --profile development`）不受影響，日常開發照常使用
- 任何程式碼改動都必須實際走過一次本機打包流程、裝到實機測試過，才算數驗證——`git diff`
  只能檢查邏輯合不合理，不能證明建置出來的東西會不會動（見 `docs/devlog.md` C-009、C-010）

---

## 9. 已知現況與限制（如實記錄，不代表判斷是否需要修復）

### 9-1. 爸爸的雙帳號歷史
爸爸在 Supabase 有兩個 UUID：
- `d6dce0d7...`：開發測試期間用 Xinya 的 Apple ID 登入產生，**已廢棄**
- `423e495b...`：爸爸真實 Apple ID 登入後產生，**這是正確帳號**

所有資料已於 2026/07/01 用 SQL UPDATE 搬移到 `423e495b...`。未來不要再用 `d6dce0d7...`。

### 9-2. 嚴重度（severity / reliefSeverity）沒有輸入 UI
資料模型裡保留這兩個欄位，`RecordScreen.js` 送出時 `severity` 固定寫死 `5`，
`reliefSeverity` 全專案搜尋不到任何寫入路徑，畫面上只有顯示邏輯（`log.reliefSeverity !==
null` 才渲染），沒有編輯邏輯。已安裝的 `@react-native-community/slider` 套件目前沒有被
任何檔案 import。

### 9-3. 雲端寫入沒有失敗重試機制
`cloudSync.js` 的所有 push / delete 函式都是 fire-and-forget，失敗只 `console.warn`。
目前程式碼庫裡搜尋不到任何重試佇列（`syncQueue.js`、`enqueuePendingSync` 等）。離線編輯後
恢復網路，除非使用者剛好再次觸發同一筆資料的寫入操作，否則不會自動補推上雲端。

### 9-4. 前景刷新拉取同步尚未覆蓋全部資料類型
見上方第 3 節「前景刷新拉取同步（Pull Sync）現況」，`symptom_logs`（症狀紀錄）與
`medical_history`（病歷）目前仍只在登入／App 重新啟動時的一次性 hydration 才會拉最新版，
App 開著期間裝置之間互相看不到彼此的更新。

### 9-5. SafeAreaView 警告
Metro log 常見 `SafeAreaView has been deprecated` 警告，這是 Expo SDK 54 底層的已知問題，不影響功能。

### 9-6. eas submit 可能卡住
EAS Submit 有時會在 `waiting for an available submitter` 卡住超過 15 分鐘，這是 EAS 雲端佇列問題，不是程式碼問題。改用 Transporter 可完全繞過此問題。

### 9-7. eas build 雲端建置在正式版本上不可靠（2026/07/11 起停用）
完整排查過程見 `docs/devlog.md` C-009、C-010，摘要見 `docs/CLAUDE.md`「更新與打包流程」。

### 9-8. `invite_codes` 的 `used_by` / `used_at` 欄位無法從 client 端核實
`SettingsScreen.js` 產生邀請碼時只 `insert` 了 `owner_id`／`code`／`expires_at` 三欄，核銷相關
欄位（若存在）是在 `redeem_invite_code` RPC 函式內部設定，這份規格書沒有管道查看該函式的
SQL 定義。
