@AGENTS.md

# 健康記錄 App — CLAUDE.md（2026/08 全面核對版）

> 本次全面重寫：直接讀取實際程式碼庫作為唯一權威來源，不採信舊版文件內容。
> 舊版文件（`docs/CLAUDE.md`、`docs/spec.md`）與實際程式碼有相當多落差（Tab 數量、
> 檔案清單、函式簽名、資料模型欄位等），細節不在此列出，如需要可對照 git 歷史。
> `docs/devlog.md`（開發日誌）性質不同，未整份重寫，只更正其中對「現況」的錯誤描述，
> 歷史事件敘述維持原文，見該檔案開頭的更新說明。

## 專案背景

這是一個為**肺癌病患（ChengJui Hsi，爸爸）**設計的家庭健康追蹤 App。
主要使用情境：記錄症狀發作、回診行程、每日用藥狀況，並讓家人以唯讀模式即時查看。

- **擁有者（Owner）**：ChengJui Hsi（爸爸），Supabase UUID：`423e495b-434a-48a7-8ab2-c48ce93c7917`
- **開發者 / 檢視者**：程歆雅（Xinya），Supabase UUID：`d6dce0d7-9f3e-44d1-bc3b-efbb6f3e9290`
- 介面語言：繁體中文（zh-TW）全程
- 資料同時存在本機（AsyncStorage）與雲端（Supabase），offline-first 設計

完整規格見 `docs/spec.md`。

---

## 技術棧

實際套件版本以 `package.json` 為準：

| 項目 | 版本／套件 |
|------|-----------|
| Framework | React Native `0.81.5` + Expo `~54.0.0`，React `19.1.0` |
| Navigation | `@react-navigation/native` `^7.0.0` + `@react-navigation/bottom-tabs` `^7.2.0` |
| 本機 Storage | `@react-native-async-storage/async-storage` `2.2.0` |
| 雲端後端 | Supabase `@supabase/supabase-js` `^2.108.2`（URL：`https://npizltqgwfcrldmzsyyx.supabase.co`）|
| 認證 | Apple Sign In（`expo-apple-authentication` `~8.0.8` + `signInWithIdToken`）|
| 通知 | `expo-notifications` `~0.32.17` |
| UUID | `uuid` `^14.0.0`（ESM-only）+ `react-native-get-random-values` `~1.11.0` |
| 日期時間選擇 | `@react-native-community/datetimepicker` `8.4.4` |
| 下拉選單 | `@react-native-picker/picker` `2.11.1` |
| 漸層 | `expo-linear-gradient` `~15.0.8` |
| 目標平台 | iOS（TestFlight 內部測試），`app.json` 有 `android` 區塊但未見實機測試紀錄 |
| 部署 | **本機打包 + 手動簽章**（`eas build` 目前停用於正式版本，見下方「更新與打包流程」）|
| App Bundle ID | `com.sophiechenggg.healthlog`｜Team ID：`Q3AB8UHDUY`｜slug：`health-log` |

**已安裝但目前程式碼裡沒有實際使用**（`grep` 全 `src/` 找不到任何引用，僅存在於 `package.json`）：
- `@react-native-community/slider`：舊文件描述「嚴重程度 Slider」，但 `RecordScreen.js` 與 `LogCard.js` 目前都沒有 Slider UI，`severity` 欄位在送出時直接寫死 `5`（見下方「已知現況」）
- `react-native-reanimated`：`babel.config.js` 有掛 `react-native-reanimated/plugin`，但 `src/` 底下沒有任何 `Animated.*` 或 `react-native-reanimated` 的 import
- `react-native-gesture-handler`：同樣沒有任何 import
- `react-native-web`：Expo 預設帶入，未見任何 web 專屬程式碼

> 在動任何 Expo API 之前，先查 https://docs.expo.dev/versions/v54.0.0/ 確認正確用法。

---

## Tab 結構（對照 `App.js` 的 `TABS` 陣列）

```js
const TABS = [
  { name: '記錄症狀', char: '記', idx: 0 },  // RecordScreen.js
  { name: '歷史紀錄', char: '史', idx: 1 },  // HistoryScreen.js
  { name: '行事曆',   char: '曆', idx: 2 },  // CalendarScreen.js
  { name: '每日用藥', char: '藥', idx: 3 },  // DailyMedScreen.js
  { name: '設定',    char: '設', idx: 4 },  // SettingsScreen.js
];
```

**共 5 個 Tab**（舊版文件曾誤植為 4 個，且把「每日用藥」與「設定」的編號搞混——每日用藥是
Tab 3，設定是 Tab 4，不是舊文件寫的「Tab 3 設定」）。

### Tab 0 — 記錄症狀（`RecordScreen.js`）
- 症狀多選（`SymptomMultiPicker`，取值自 `symptomList`）；選「其他」時顯示自由輸入欄
- 開始時間：`PeriodTimeField`，依當下時間自動判斷「上午／中午／下午」代表時刻，可按「調整」手動改日期＋時段
- 自行服藥多選（取值自 `medList`，`allowOther`）
- 備註欄（多行 `TextInput`，focus 時顯示「完成」按鈕收鍵盤）
- 送出按鈕「記錄」：未選症狀時 disabled
- **送出的 log 物件裡 `severity` 直接寫死為 `5`，畫面上沒有任何可調整嚴重度的 UI**（見下方「已知現況」）
- **檢視者模式**：顯示「閱」字印章 + 「目前為查看模式」+「無法在查看他人記錄時新增症狀紀錄」+「請在上方切換回『查看自己』」

### Tab 1 — 歷史紀錄（`HistoryScreen.js`）
- 子分頁：**症狀紀錄 / 病　　歷**（只有 2 個子分頁；「分享」不是子分頁，是「病歷」子分頁內的一顆按鈕）
- **症狀紀錄**：
  - 頂部有「篩選症狀」下拉 + 「歷史」開關（`historyOnly`）
  - 有醫生診斷或醫生確認用藥任一有值即視為「歷史紀錄」，預設隱藏，除非篩選了症狀或開啟「歷史」開關
  - 按日期分組（降冪），每張 `LogCard` 含補填功能（inline 展開，`EditForm`）
  - 補填欄位：醫生診斷、醫生確認用藥（皆為必填其一才能儲存）；`showOriginal` 展開後還能修改症狀、開始時間、自行服藥
  - **過敏藥物警示**：儲存時若「醫生確認用藥」文字模糊比對到 `allergyList` 裡的任一項目（`levenshtein` 編輯距離，短字串用子字串比對），會跳 Alert「過敏藥物警示」要求確認後才儲存
- **病歷**：按年份分組（降冪），可新增年份、新增/編輯/刪除個別記錄、刪除整年；分享按鈕呼叫 `Share.share()` 匯出純文字
- **檢視者模式**：頂部顯示「● 目前查看：{name} 的紀錄」橫幅，隱藏所有編輯/刪除按鈕

### Tab 2 — 行事曆（`CalendarScreen.js`）
- 子分頁：**新增行程 / 所有行程**（`mode` state，`'calendar'` = 新增行程、`'schedule'` = 所有行程）
- **預設開啟頁為「所有行程」**（`useState('schedule')`，2026/08 起；原預設「新增行程」，爸爸反映找不到既有行程列表）
- 兩個分頁標籤文字皆為 `fontWeight: '700'`，選中/未選中狀態都套用（2026/08）
- **新增行程模式**：`CalendarView`（月曆，有行程日期標小點）+ 點日期進入詳情頁（`AppointmentSection` `timeOnly` + `ConsultationMemo`）
- **所有行程模式**：依日期排列所有醫院行程，頂部類型／醫院雙篩選 + 「歷史」開關（含過去日期）；點行程進入詳情頁（完整表單 + `ConsultationMemo`）
- **行程類型選項**（`VISIT_TYPE_DEFAULT`，可在設定頁編輯）：門診／抽血／MRI／CT／**骨掃描**／X光／慢簽／復健／其他
- **醫院選項**（`HOSPITAL_DEFAULT`，可在設定頁編輯）：國泰醫院／台大醫院／北醫醫院／超越診所／其他（可自訂輸入）
- **看診醫生選項**（`DOCTOR_DEFAULT`，可在設定頁編輯，只有行程類型為「門診」才顯示此欄）：蔡俊明／蔡欣熹（神經內科）／吳彥雯（心臟科）／林志鵬（疼痛科）／徐紹剛（復健科）
- **問診備忘**（`ConsultationMemo.js`）：綁定日期（一天一筆），詳情頁可編輯
  - 「清空」按鈕已移除（2026/08，避免手滑誤刪整篇備忘），只保留「儲存」（自動 debounce 600ms 存檔）
  - `TextInput` 高度依內容自動調整（`onContentSizeChange`），點文字內容才會 focus 跳鍵盤，點卡片其餘留白區域不會（2026/08）
  - 新增一行改用明確的「＋　新增一項」列（原本 header 的「＋ 條目」按鈕已移除，改成內容下方這顆）
- **檢視者模式**：隱藏新增按鈕，勾選框 disabled，問診備忘唯讀

### Tab 3 — 每日用藥（`DailyMedScreen.js`）
> 舊版文件把這個 Tab 完全漏掉，且曾經誤以為它併入了行事曆頁——實際上它是獨立的第 4 個
> Tab（畫面 icon「藥」），檔案是 `DailyMedScreen.js`。

- 日期標題（固定為今日，這個畫面沒有日期切換 UI）+ 「歷史」按鈕
- 進度卡：已服 X / 總計 N，進度條（tick 刻度 + 硃砂色填色），全部勾完顯示「今日用藥已全部確認」banner
- 藥物清單：勾選框 + 藥名，勾選後文字加刪除線、狀態框變實心硃砂紅「服」字
- 勾選「嗎啡貼布」會排程 36 小時後的換貼提醒（`scheduleMorphinePatchReminder`），取消勾選則 `cancelMorphinePatchReminder`
- 「歷史」按鈕開啟 Modal：近 7 日用藥紀錄，可切換「依日期」／「依藥物」兩種檢視模式
- **檢視者模式**：唯讀，checkbox disabled，隱藏歷史按鈕以外的互動；分母來自 `fetchOwnerMedList(ownerId)` / `fetchOwnerAllMedKeys(ownerId)` 的聯集 fallback

### Tab 4 — 設定（`SettingsScreen.js`）
- **六個可編輯清單區塊**（舊版文件寫「三個 section」，實際是六個）：
  1. 藥物過敏清單（`allergyList`）
  2. 藥物清單（`medList`）
  3. 症狀清單（`symptomList`，「其他」固定在末尾不可刪除）
  4. 醫院清單（`hospitalList`，「其他」固定不可刪除）
  5. 行程類型清單（`visitTypeList`，「其他」可刪除）
  6. 看診醫生清單（`doctorList`）
- 各自可新增、編輯、刪除；變更即時同步雲端（各自呼叫 `syncListFieldToCloud(fieldName, list)`，見下方「雲端同步邏輯」）
- **家人分享區塊**：產生邀請碼（6 碼大寫英數，排除 0/O/1/I，有效期 48 小時，`INSERT` 進 `invite_codes`）+ 輸入邀請碼綁定（`supabase.rpc('redeem_invite_code', ...)`）
- **登出按鈕**：帶確認 Alert
- **`__DEV__` 專用除錯區塊**（`!isViewerMode && __DEV__` 才顯示，正式版本不會出現）：
  - 「同步設定到雲端」：逐欄呼叫 `syncListFieldToCloud`，除錯用
  - 「清除 `localDataInitialized` flag」：實際清除的是舊版 flag key（現行 flag 是 `localDataInitialized_v4`，見下方），這顆按鈕目前清除的 key 名稱與實際使用中的 flag 不一致，如實記錄現況，是否需要調整由 Xinya 判斷
- **檢視者模式**：隱藏家人分享區塊與 `__DEV__` 區塊，六個清單皆唯讀（`fetchOwnerSettings(activeOwner.id)` 直接讀雲端，不經過 `SettingsContext`）

---

## 資料模型

### 本機 AsyncStorage

```ts
// SymptomLog（key: "logs"）
{
  id: string               // uuid
  symptoms: string[]       // 多選症狀陣列（新格式）
  symptom: string          // 單一症狀字串（舊格式，兼容）
  severity: number         // 目前送出時固定為 5，畫面無 UI 可調整
  startTime: string        // "YYYY/MM/DD HH:MM"
  selfMeds: string[]       // 自行服藥陣列（新格式）
  selfMed: string          // （舊格式，兼容）
  note: string | null
  endTime: string | null
  doctorDiagnosis: string | null
  doctorMed: string | null
  reliefSeverity: number | null  // 0–10，同樣沒有編輯 UI（僅顯示，見補填表單）
  reliefNote: string | null
}

// Settings（key: "settings"）—— 六個清單，不是三個
{
  symptomList: string[]
  medList: string[]
  allergyList: string[]
  hospitalList: string[]
  visitTypeList: string[]
  doctorList: string[]
  version: number          // SETTINGS_VERSION，目前為 3
}

// DailyMedCheck（key: "dailyMed_YYYY-MM-DD"）
{
  date: string
  checked: Record<string, boolean>
}

// Appointment（key: "appointments"）
{
  id: string
  dateTime: string        // "YYYY/MM/DD HH:MM"
  hospital: string
  type: string             // 見 VISIT_TYPE_DEFAULT，含「骨掃描」
  doctor: string | null    // 只有 type==='門診' 才有值
  note: string | null
}

// MedicalHistory（key: "medicalHistory"）
[{
  year: number
  records: [{ id: string, month: number, text: string }]
}]

// ConsultMemo（key: "consultMemo_YYYY-MM-DD"）
string  // 純文字，空內容時 removeItem

// nextNailClipReminderAt（時間戳字串，2026/08 新增，見推播通知章節）
```

### Supabase 資料表

以下欄位皆從 client 端程式碼（`.select()` / `.insert()` / `.update()` 呼叫）核實：

```sql
profiles          -- id, full_name, med_list(jsonb), symptom_list(jsonb), allergy_list(jsonb),
                  --   hospital_list(jsonb), visit_type_list(jsonb), doctor_list(jsonb)
                  --   （舊版文件漏了後三個欄位）
symptom_logs      -- id, owner_id, symptom, severity, start_time, self_med, note,
                  --   end_time, doctor_diagnosis, doctor_med, relief_severity, relief_note
daily_med_checks  -- owner_id, check_date, checked(jsonb)  [PK: (owner_id, check_date)]
appointments      -- id, owner_id, appt_time(timestamptz), hospital, type, doctor, note
medical_history   -- id, owner_id, year, month, content
consult_memos     -- owner_id, memo_date(date), content  [PK: (owner_id, memo_date)]
viewer_access     -- owner_id, viewer_id, status('accepted'|'revoked')
invite_codes      -- owner_id, code, expires_at  （client 端 insert 只帶這三欄）
```

**`invite_codes` 的 `used_by`／`used_at`（若存在）無法從 client 端核實**：`SettingsScreen.js`
的 `handleGenerateInvite()` 只 `insert` 了 `owner_id`／`code`／`expires_at` 三欄；核銷邏輯在
`redeem_invite_code` 這支 Postgres RPC 函式內部執行，client 端程式碼看不到它的 SQL 定義，若
這兩欄確實存在，也是在該函式內部被設定的，需要直接查 Supabase 端才能確認。

### camelCase ↔ snake_case 對應（`cloudSync.js` / `viewerData.js`）

| 本機欄位 | Supabase 欄位 |
|---------|--------------|
| symptoms[] | symptom（join 成「、」分隔字串）|
| selfMeds[] | self_med（join 成「、」分隔字串）|
| startTime | start_time（轉 ISO 格式）|
| endTime | end_time |
| doctorDiagnosis | doctor_diagnosis |
| doctorMed | doctor_med |
| reliefSeverity | relief_severity |
| reliefNote | relief_note |
| dateTime（行程）| appt_time（轉 ISO 格式）|
| text（病歷）| content |
| symptomList | symptom_list |
| medList | med_list |
| allergyList | allergy_list |
| hospitalList | hospital_list |
| visitTypeList | visit_type_list |
| doctorList | doctor_list |

---

## 資料夾結構

以下與 `src/` 底下實際存在的檔案逐一核對，完全一致（2026/08）：

```
HealthAppFresh/
├── App.js                      # 入口：AuthProvider > ViewerProvider > AppProviders > AppContent
│                               # AppContent：isLoading → LoginScreen → NavigationContainer
│                               # 也在此層掛剪指甲提醒的 AppState 監聽（見推播通知章節）
├── app.json                    # usesAppleSignIn: true, plugins 含 expo-notifications
├── eas.json                    # build profiles: development / preview / production
├── babel.config.js             # 含 react-native-reanimated/plugin（見上方技術棧的「未使用」清單）
├── index.js                    # import 'react-native-get-random-values'
│                               # import 'react-native-url-polyfill/auto'
├── .env                        # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
├── src/
│   ├── constants/
│   │   ├── colors.js           # 色彩系統（唯一色值來源），含 TYPE_COLORS、cardShadow、headerShadow
│   │   └── defaults.js         # SYMPTOMS_DEFAULT / MEDS_DEFAULT / ALLERGY_DEFAULT /
│   │                           #   HOSPITAL_DEFAULT / VISIT_TYPE_DEFAULT / DOCTOR_DEFAULT /
│   │                           #   MEDICAL_HISTORY_DEFAULT / SETTINGS_VERSION / REMOVED_ITEMS / BEEF_ESSENCE
│   ├── storage/
│   │   └── index.js            # AsyncStorage 讀寫封裝；save* 系列附帶雲端同步，
│   │                           #   saveXxxLocalOnly 系列不附帶（見「雲端同步邏輯」）
│   ├── lib/
│   │   ├── supabase.js         # Supabase client（AsyncStorage session 持久化）
│   │   ├── cloudSync.js        # 本機 → 雲端同步函式（push/delete/migrate）
│   │   ├── viewerData.js       # 雲端 → 本機讀取函式（fetchOwner*）
│   │   ├── initSync.js         # 新裝置首次登入的整批初始化（不含 settings 六個清單，見下方）
│   │   └── notifications.js    # 推播通知排程（抗凝血劑、牛肉精、嗎啡貼布、剪指甲）
│   ├── hooks/
│   │   └── useSettings.js      # 六個清單 state + hydration + 前景刷新（見「雲端同步邏輯」）
│   ├── context/
│   │   ├── AuthContext.js      # session, user, isLoading, signInWithApple, signOut
│   │   └── ViewerContext.js    # viewableOwners, activeOwner, isViewerMode, ownerSettings, refreshOwnerSettings
│   ├── context.js              # SettingsContext（= useSettings() 回傳值）+ LogsContext + MedicalHistoryContext
│   ├── screens/
│   │   ├── LoginScreen.js      # Apple 登入畫面（民國墨帳風格）
│   │   ├── RecordScreen.js     # Tab 0
│   │   ├── HistoryScreen.js    # Tab 1（支援 viewerMode）
│   │   ├── CalendarScreen.js   # Tab 2 行事曆（新增行程／所有行程，支援 viewerMode）
│   │   ├── DailyMedScreen.js   # Tab 3 每日用藥（支援 viewerMode）—— 舊版文件完全沒列這個檔案
│   │   └── SettingsScreen.js   # Tab 4（家人分享、登出、__DEV__ 除錯區塊，支援 viewerMode）
│   └── components/
│       ├── Section.js              # 標題列裝飾元件
│       ├── AppPicker.js            # 單選下拉（iOS Modal picker / Android 原生 picker）
│       ├── SymptomMultiPicker.js   # 多選 Modal（症狀／自行服藥共用，支援「其他」自由輸入）
│       ├── DateGroupHeader.js      # 日期分組標題線
│       ├── DateTimeField.js        # 完整日期時間 / 純時間欄位（也匯出 parseDate/formatDate 供其他元件用）
│       ├── PeriodTimeField.js      # 「上午/中午/下午」時段選擇（記錄症狀用）
│       ├── CalendarView.js         # 月曆格線元件（含年月 Picker Modal）
│       ├── LogCard.js              # 症狀紀錄卡片，readOnly prop；含過敏藥物模糊比對警示
│       ├── AppointmentSection.js   # 行程表單 + 列表，讀 SettingsContext 的醫院/類型/醫生清單
│       ├── MedicalHistoryView.js   # 病歷，readOnly + externalData prop
│       └── ConsultationMemo.js     # 問診備忘，readOnly + ownerId prop
└── assets/
```

> `SeverityBadge.js` **不存在**（舊版文件曾列出這個檔案，實際 `src/components/` 底下沒有這個檔案，
> 嚴重度目前只以文字/色塊顯示在 `LogCard.js` 的 `FieldTag` 裡，不是獨立元件）。

---

## 雲端同步邏輯

### `cloudSync.js` 函式清單（本機 → 雲端）

| 函式 | 方向 | 對應資料表 |
|------|------|-----------|
| `pushSymptomLogToCloud(log)` | upsert | symptom_logs |
| `deleteSymptomLogFromCloud(id)` | delete | symptom_logs |
| `pushDailyMedCheckToCloud(check)` | upsert（`onConflict: 'owner_id,check_date'`）| daily_med_checks |
| `pushAppointmentToCloud(appt)` | upsert | appointments |
| `deleteAppointmentFromCloud(id)` | delete | appointments |
| `pushConsultMemoToCloud(date, content)` | upsert（`onConflict: 'owner_id,memo_date'`）/ 空內容時 delete | consult_memos |
| `pushMedicalHistoryToCloud(record, year)` | upsert | medical_history |
| `deleteMedicalHistoryFromCloud(id)` | delete | medical_history |
| `deleteMedHistoryYearFromCloud(year)` | delete（依 year 篩選）| medical_history |
| `syncListFieldToCloud(fieldName, listValue)` | update 單一欄位 | profiles |
| `migrateLocalDataToCloud()` | 一次性搬遷（logs + dailyMed）| 同上 |
| `migrateAppointmentsToCloud()` | 補遷移 | appointments |
| `migrateMedHistoryToCloud()` | 補遷移 | medical_history |
| `migrateConsultMemosToCloud()` | 補遷移 | consult_memos |

> **舊版文件寫的 `syncMedListToCloud(medList)` 這個函式名稱不存在。** 實際函式是
> `syncListFieldToCloud(fieldName, listValue)`——通用版本，六個清單（`symptom_list` /
> `med_list` / `allergy_list` / `hospital_list` / `visit_type_list` / `doctor_list`）
> 共用同一支函式各自獨立呼叫，只 `.update()` 單一欄位，不會用 `.upsert()` 整列覆蓋。

**現況記錄（如實描述，不代表判斷是否需要修復）**：以上所有 push / delete 函式都是
fire-and-forget，失敗時只 `console.warn`，程式碼裡沒有找到任何失敗重試佇列或持久化重試機制
（`enqueuePendingSync` / `flushPendingSyncQueue` / `src/lib/syncQueue.js` 在目前程式碼庫裡完全
搜尋不到）。

### `viewerData.js` 函式清單（雲端 → 本機讀取）

| 函式 | 來源表 | 備註 |
|------|--------|------|
| `fetchOwnerLogs(ownerId)` | symptom_logs | camelCase 轉換 |
| `fetchOwnerMedicalHistory(ownerId)` | medical_history | 巢狀年份結構 |
| `fetchOwnerAppointments(ownerId)` | appointments | 查詢錯誤會 `throw`，不會跟「無資料」混淆 |
| `fetchOwnerDailyMed(ownerId, date)` | daily_med_checks | `PGRST116`（查無資料）視為正常空狀態，其餘錯誤 `throw` |
| `fetchOwnerMedList(ownerId)` | profiles.med_list | |
| `fetchOwnerAllMedKeys(ownerId)` | daily_med_checks | 該 owner 所有歷史勾選記錄裡出現過的藥名聯集，viewer 模式分母 fallback 用 |
| `fetchOwnerSettings(ownerId)` | profiles（六欄）| 三層 fallback（因應欄位可能還沒建好的過渡期）；2026/08 起最終失敗會 `throw`，不再靜默回傳全空物件（見下方前景刷新章節） |
| `fetchOwnerConsultMemo(ownerId, date)` | consult_memos | 查無資料或錯誤都回傳 `''` |
| `fetchOwnerDailyMedChecksSince(ownerId, sinceDate)` | daily_med_checks | 供 `initSync.js` 新裝置初始化用 |
| `fetchOwnerConsultMemosSince(ownerId, sinceDate)` | consult_memos | 同上 |

> 舊版文件提過的 `fetchOwnerMarkedDates(ownerId)` **不存在**於目前程式碼。

### Migration flags（AsyncStorage）
- `cloudMigrationDone`：logs + dailyMed 初次搬遷
- `appointmentsMigrationDone`：appointments 補遷移
- `medHistoryMigrationDone`：medical_history 補遷移
- `consultMemoMigrationDone`：consult_memos 補遷移
- `localDataInitialized_v4`：`initSync.js` 的新裝置整批初始化 gate（不含 settings 六個清單）

登入後（`SIGNED_IN` 事件，`AuthContext.js`）依序執行 `initializeLocalDataFromCloudIfNeeded()` →
`runMigrationIfNeeded()` → `runSupplementalMigrations()`，各 flag 獨立檢查。

### `initSync.js`（新裝置首次登入初始化）

匯出單一函式 `initializeLocalDataFromCloudIfNeeded(userId)`：
- 用 `localDataInitialized_v4` flag 做一次性 gate，flag 存在就整支跳過
- 若本機已有 `logs`（判斷「這台裝置本來就有資料」的依據），直接標記完成、不拉任何東西
- 全新裝置才依序拉：`fetchOwnerLogs` → `fetchOwnerAppointments` → `fetchOwnerMedicalHistory`，
  外加最近 90 天的 `fetchOwnerDailyMedChecksSince` / `fetchOwnerConsultMemosSince`
- **明確不處理 settings 六個清單**——這六個清單的雲端拉取＋覆蓋 React state 完全由
  `useSettings.js` 自己負責（見下方），檔案內註解說明原因：如果 `initSync.js` 也寫回
  AsyncStorage，只會覆蓋硬碟、不會同步更新 `useSettings` 已經 mount 的 React state，
  兩邊各自為政會造成畫面顯示跟實際雲端資料不一致

### `useSettings.js`（settings 六個清單的 hydration + 前景刷新）

- 掛載時 `loadSettings()` 讀本機（本機優先，通常很快）→ 立刻 `applyToState()` 讓畫面渲染；
  **沒有任何「等雲端資料確認回來才顯示」的畫面 gate**，`isSettingsHydrated` 這個 state 目前
  不存在，`App.js` 的畫面切換判斷只跟 auth session 有沒有解析完成有關，跟 settings 是否
  hydrate 完全無關
- 只有 `!local.hasLocalData && userId`（真正全新裝置，AsyncStorage 完全沒存過 `settings`）
  才會額外打一次 `fetchOwnerSettings` 補值；本機已有資料（含使用者刻意清空的空陣列）一律
  信任本機，不用雲端覆蓋
- **前景刷新（Pull Sync，2026/08 新增）**：`refreshSettingsFromCloud()`，用 `hydratedRef`
  （`useRef`，不是 state，不驅動任何畫面切換）擋跟首次 hydration 搶跑；從雲端拉六個清單，
  逐欄比對跟本機 ref 是否相同，只有真的不同的欄位才寫入畫面 state + AsyncStorage，不會
  無條件覆蓋全部六個欄位；寫入路徑跟 `applyToState()` 一樣是純本機（`setXListRaw` +
  `saveSettings()`），不會呼叫六個公開 setter（那六個 setter 內部會呼叫
  `syncListFieldToCloud` 推回雲端）
- 觸發時機：hydration 完成後，若這次是「信任本機」分支（不是全新裝置）就補打一次
  `refreshSettingsFromCloud()`；另外掛了 `AppState` 前景轉換監聽（`useSettings.js` 內部，
  不在 `App.js`）——因為 `useSettings()` 全 App 只會被 `AppProviders` 呼叫一次，效果上已經是
  全域層級，涵蓋所有消費這六個清單的畫面（`RecordScreen` / `LogCard` / `AppointmentSection`
  / `SettingsScreen` 等），不限定於設定頁本身
- **已知風險（如實記錄，未特別處理）**：如果使用者剛編輯完某個清單、`syncListFieldToCloud`
  還沒推上雲端成功，這時剛好觸發前景刷新，會用還沒包含那次編輯的雲端舊值覆蓋掉本機剛編輯
  的那個欄位——範圍限於真的跟本機不同的那個欄位，不影響其餘欄位

### 前景刷新拉取同步（Pull Sync）現況總表

| 資料類型 | 本機寫入（LocalOnly，不觸發雲端推送）| 拉取＋更新畫面 | 觸發點 | 狀態 |
|---------|-----------------------------------|--------------|--------|------|
| daily_med_checks | `saveDailyMedLocalOnly()` | `refreshDailyMedFromCloud()`（`DailyMedScreen.js`）| useFocusEffect + AppState | 完成，本機驗證通過 |
| appointments | `saveAppointmentsLocalOnly()` | `refreshAppointmentsFromCloud()`（`CalendarScreen.js`）| useFocusEffect + AppState | 完成 |
| consult_memos | `saveConsultMemoLocalOnly()`（`storage/index.js`）| `refreshConsultMemoFromCloud()`（`ConsultationMemo.js` 元件內）| useFocusEffect + AppState，`dateRef`／`focusedRef` 雙重防呆 | 完成，尚未打包送出實機驗證 |
| settings 六個清單 | 直接 `setXListRaw` + `saveSettings()`（無獨立 LocalOnly 函式，沿用 hydration 既有的 `applyToState` 寫入路徑）| `refreshSettingsFromCloud()`（`useSettings.js` 內）| hydration 完成後補打一次 + AppState（皆在 `useSettings.js` 內，非畫面層級）| 完成，尚未打包送出實機驗證 |
| symptom_logs、medical_history | — | — | — | 尚未開始 |

只在 Owner 模式執行；Viewer 模式的資料來源完全不同（直接讀雲端，不經過本機快取），不需要這層。

---

## 檢視者模式（ViewerMode）

### 身份切換
- Header 下方 `IdentitySwitcher`：「查看自己」+ 各 owner 姓名按鈕
- 只有 `viewableOwners.length > 0` 才顯示
- Active owner 用硃砂色底色標示

### 各畫面行為
| 畫面 | 擁有者模式 | 檢視者模式 |
|------|-----------|-----------|
| 記錄症狀 | 正常新增 | 顯示「目前為查看模式」|
| 歷史紀錄 | 完整 CRUD | 唯讀，隱藏編輯/刪除，顯示查看橫幅 |
| 行事曆 | 完整功能 | 隱藏新增，勾選/表單 disabled，問診備忘唯讀 |
| 每日用藥 | 完整功能 | 唯讀，checkbox disabled |
| 設定 | 完整設定 | 唯讀，隱藏家人分享區塊與 `__DEV__` 區塊 |

### 資料來源
- 擁有者模式：本機 AsyncStorage（透過 Context）+ 前景刷新拉取（見上方）
- 檢視者模式：Supabase（透過 `viewerData.js` 的 `fetchOwner*` 函式），部分畫面另外掛了
  `useFocusEffect` 在每次取得焦點時重新拉（`HistoryScreen.js`、`CalendarScreen.js` 的
  Owner 分支等，各畫面實作方式不完全一致，如需要精確行為請直接查該畫面檔案）

---

## 推播通知（`src/lib/notifications.js`，expo-notifications）

| 提醒項目 | 觸發方式 | 週期 | 綁定 UI | Identifier |
|---------|---------|------|--------|-----------|
| 每日抗凝血劑（早）| `DAILY` 觸發器 | 每天 10:30 | 無（固定排程）| `reminder_anticoagulant_daily`，冪等 |
| 每日抗凝血劑（晚）| `DAILY` 觸發器 | 每天 22:30 | 無 | `reminder_anticoagulant_evening`，冪等 |
| 牛肉精 | `DAILY` 觸發器 | 每天 12:00 | 「今日用藥」牛肉精勾選框——今天已勾選就取消整個 `DAILY` 排程，未勾選則確保已排程（`DailyMedScreen` 的 `useEffect`，依 `checked['牛肉精']` 變化） | `reminder_beef_essence_daily`，冪等 |
| 嗎啡貼布換藥 | `DATE` 觸發器（一次性）| 36 小時 | 「今日用藥」嗎啡貼布勾選框，勾選時排程/取消勾選時取消，重新勾選先取消舊的再重排 | 存在 AsyncStorage `notif_morphine_patch_id`，非固定 identifier |
| 剪指甲 | `DATE` 觸發器（一次性，每次觸發後自動往後排下一次）| 10.5 天，固定 22:00（GMT+8）| **無**，獨立提醒，不出現在任何勾選清單裡 | `reminder_nail_clip`，固定，冪等 |

**剪指甲提醒排程邏輯**（`ensureNailClipReminder()`，2026/08 新增）：
- 本機 AsyncStorage 存 `nextNailClipReminderAt`（時間戳）
- App 啟動（`AppContent` 的 `useEffect`，掛在 `session` 變化）／回到前景（`AppState` 監聽）時檢查：
  從未排程過 → 排 10.5 天後當天 22:00；已過期 → 以 10.5 天為步進反覆往後推，推到真正落在
  未來為止（避免裝置長時間沒開導致新排程時間點還是落在過去——iOS 對過去時間的 `DATE`
  trigger 會直接靜默丟棄，不發通知也不報錯，這是嗎啡貼布排查時得到的教訓，這裡直接套用）；
  未過期 → 不重複排程
- 排程本身用 `scheduleNailClipReminderAt()`，固定 identifier `reminder_nail_clip`，每次先
  `cancelScheduledNotificationAsync` 再排新的
- 掛載點在 `App.js` 根層（`AppContent`），不掛在特定 tab screen，因為跟任何 tab 的資料都
  無關，且 bottom tabs 預設 lazy mount

---

## 設計方向

**設計由 `frontend-design` skill 主導。任何視覺改動都應先讀取該 skill 再動手。**

### 概念方向：「民國醫案墨帳」
像一本有溫度的私人醫案手帳，而不是科技產品或診所系統。
深墨封面、宣紙頁、硃砂印記、金色裝飾線。

### 硬性要求
- 字型：標楷體（iOS: `STKaiti`，Android: `serif`），全程使用
- 介面語言：繁體中文
- 風格：古典、沉穩、有溫度，**不要現代感、不要紫色、不要 AI 美學**
- Tab icon：單字楷書漢字（記／史／曆／藥／設）置於小方框內，不用 emoji

### 色彩系統（`src/constants/colors.js` 為唯一色值來源）
- 背景：宣紙暖米（parchment tones）
- Header / 主色：深墨色（warm ink-stone，非冷黑、非森林綠）
- 主題強調色：硃砂紅（cinnabar）— CTA、印記、active 狀態
- 裝飾色：舊金（aged gold）— 規則線、邊框、裝飾元素
- 行程類型色（`TYPE_COLORS`）：門診＝硃砂、抽血＝靛、MRI＝苔綠、CT＝褐、骨掃描＝灰藍、X光＝舊金、慢簽＝橄欖、復健／其他＝muted
- 嚴重度色（`colors.textSelfMed` 等命名雖存在，實際目前沒有嚴重度分級 UI 在用它們，見上方「已知現況」）

> 所有色值定義在 `src/constants/colors.js`，**不得在其他檔案硬寫色碼**。

---

## 開發注意事項

- `uuid` 14.x ESM-only：`import { v4 as uuidv4 } from 'uuid'`
- `index.js` 最頂端必須依序 import：`react-native-get-random-values` → `react-native-url-polyfill/auto`
- `react-native-reanimated` 4.x：`babel.config.js` 需加 `'react-native-reanimated/plugin'`（雖然目前程式碼沒有實際使用 reanimated，見上方技術棧）
- Picker：使用 `@react-native-picker/picker`
- 所有 AsyncStorage 操作包 try/catch
- 顏色：`import { colors } from '../constants/colors'`，不硬寫色碼
- 所有 `cloudSync.js` 函式 fire-and-forget，失敗只 `console.warn`，**目前沒有重試佇列機制**
  （見上方「雲端同步邏輯」，`syncQueue.js` 不存在）
- 終端機顯示 `git diff`／`git log` 相關內容時一律用 `git --no-pager diff`／`git --no-pager log`（或接 `| cat`），避免跳進 `less` 分頁工具卡住畫面

---

## 更新與打包流程

> **⚠️ 2026/07/11 起重大變更**：正式版本（要給爸媽用的 TestFlight 版本）**一律停用 `eas build`**。原因是 Build 24 上線後爸爸 iPad／媽媽 iPhone 全白屏，排查後確認是 `eas build` 雲端建置流程產生的 JS bundle 跟本機建置的版本位元組不同，根本原因未知（見 `docs/devlog.md` C-009、C-010）。往後正式版本一律走本機打包 + 手動簽章流程，**不要建議或執行 `eas build --profile production`**。`eas submit` 本身沒有問題，可以照常使用。

### 日常開發（純 JS 改動，不需 build）

```bash
# Terminal 1：啟動 Metro
cd ~/Downloads/Projects/HealthAppFresh
npx expo start --dev-client

# 手機打開 Development Build（恐龍圖示的版本），掃 QR code
# 程式碼改動會熱更新，不需重新 build
```

> Development Build（`eas build --profile development`）目前仍正常，白屏問題只出現在 production profile 的 build，dev client 從未重現過。日常開發、UI 改動確認都可以照常用 dev client，不受這次事故影響。

### ⚠️ 原始碼與實際運作版本可能有落差

目前 git 上的原始碼，跟實際裝置上跑的 app，**不是同一份被驗證過的東西**——即使把原始碼邏輯完全退回到「看起來」等於某個已知正常的版本，透過 `eas build` 重新建置出來的東西依然可能白屏（根本原因未解，見 `docs/devlog.md` C-010）。這代表：

- **每次改完程式碼，不能只靠 `git diff` 看邏輯合不合理就假設沒問題**，必須實際走一次本機打包流程，裝到自己手機測試過，才算數
- 協助排查白屏或類似「本機正常、實機異常」的問題時，優先懷疑建置工具鏈（EAS 雲端建置 vs 本機建置的 bytecode 差異），而不是只在程式碼邏輯裡打轉
- 如果之後要認真查 `eas build` 產出跟本機建置產出為什麼不同，`ver27.ipa`（未置換過的原始 Build 27 樣本）跟 `old_build23.ipa`（真正原廠 Build 23）是現成的比對材料
- **git 歷史本身也不完整**：`git --no-pager log --oneline --all` 目前只有 7 個 commit（最早一筆 2026/06/01），跟 `docs/devlog.md` 記錄的 Build 2 到 Build 35+ 逐版細節對不上、對不出矛盾也對不出佐證——`devlog.md` 的 Build 編號是獨立於 git commit 的另一套版本追蹤方式，兩者不能互相當作對方的佐證來源

### TestFlight 測試人員
目前已加入（內部測試）：
- ChengJui Hsi（rayjhcheng@gmail.com）- 爸爸
- 程歆雅（sophiecheng0716@gmail.com）- 開發者
- 程偉綸（williammantou@gmail.com）- 弟弟
- ChenElysia（elysiachentp@gmail.com）- 媽媽（已在使用中，白屏事故期間她的 iPhone 也受影響）

> 新增內部測試人員需先在 Apple Developer 後台加為成員，再到 App Store Connect → TestFlight → 測試人員加入

### 注意事項
- CC 要用 claude.ai Pro 帳號登入
- 本機打包、簽章、build 和 submit 全部都要在普通 terminal 跑，不是在 CC 裡面
- Apple 處理 submit 需要 5-10 分鐘，TestFlight 才會出現新版本
- 打包用的資料夾固定在 `~/Downloads/HealthApp Builds/`（`01原始樣本`／`02乾淨打包外殼`／`03已送出版本`，數字跟中文字之間**沒有空格**）；`03已送出版本` 底下目前最新的檔案是 `sync_test_v37.ipa`，送下一版前務必先去 App Store Connect → TestFlight 核對目前最高 build number 再往上加

---

## Supabase 重要資訊

- Project URL：`https://npizltqgwfcrldmzsyyx.supabase.co`
- Project ID：`npizltqgwfcrldmzsyyx`
- Region：Northeast Asia (Tokyo)

### RLS Policy 重點
- 所有表都有 RLS，owner 全權限，viewer 只有 SELECT
- viewer 的 SELECT 條件：`viewer_access.viewer_id = auth.uid() AND status = 'accepted'`
- `redeem_invite_code(invite_code)` 是 security definer 函式，用於邀請碼兌換

### 已知的雙帳號問題
爸爸有兩個 Supabase UUID：
- `d6dce0d7...`（程歆雅）：開發測試時用自己 Apple ID 登入產生，現在的資料已搬移到爸爸真實帳號
- `423e495b...`（ChengJui Hsi）：爸爸真實 Apple ID 登入後產生，**這是正確的帳號**

所有資料已於 2026/07/01 用 SQL UPDATE 搬移到 `423e495b...`。
