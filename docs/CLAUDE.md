@AGENTS.md

# 健康記錄 App — CLAUDE.md（更新版 2026/07）

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

| 項目 | 版本／套件 |
|------|-----------|
| Framework | React Native + Expo SDK 54 |
| Navigation | `@react-navigation/native` + `@react-navigation/bottom-tabs` |
| 本機 Storage | `@react-native-async-storage/async-storage` |
| 雲端後端 | Supabase（URL: `https://npizltqgwfcrldmzsyyx.supabase.co`）|
| 認證 | Apple Sign In（`expo-apple-authentication` + `signInWithIdToken`）|
| UUID | `uuid` 14.x + `react-native-get-random-values` |
| 目標平台 | iOS（TestFlight 內部測試）|
| 部署 | **本機打包 + 手動簽章**（`@sophiechenggg/health-log`，`eas build` 目前停用於正式版本，見下方「更新與打包流程」）|
| App Bundle ID | `com.sophiechenggg.healthlog`｜Team ID：`Q3AB8UHDUY` |

> 在動任何 Expo API 之前，先查 https://docs.expo.dev/versions/v54.0.0/ 確認正確用法。

---

## 功能需求重點

### Tab 0 — 記錄症狀
- 症狀多選（從 `symptomList` 取值）；選「其他」時顯示自由輸入欄
- 嚴重程度 Slider 1–10，標示「輕微 / 中度 / 嚴重」
- 開始時間自動帶入當前時間（`YYYY/MM/DD HH:MM`），可手動編輯
- 自行服藥多選（從 `medList` 取值）
- 送出按鈕「記錄」：未選症狀時 disabled
- **檢視者模式**：顯示「目前為查看模式，無法新增紀錄」

### Tab 1 — 歷史紀錄
- 子分頁：症狀紀錄 / 病歷 / 分享
- **症狀紀錄**：按日期分組（降冪），每張 Card 含補填功能（inline 展開）
- **病歷**：按年份分組，每筆有月份 + 內容；右上角有分享按鈕（Share.share()）
- **檢視者模式**：頂部顯示「目前查看：{name} 的紀錄」橫幅，隱藏所有編輯/刪除按鈕

### Tab 2 — 每日用藥
- 子分頁：月曆行程 / 所有行程 / 今日用藥
- **月曆行程**：月曆顯示有行程的日期（小點標記），點日期查看當日行程 + 問診備忘
- **所有行程**：依日期排列所有醫院行程，支援類型 / 醫院篩選
- **今日用藥**：勾選框列出今日所有藥物，勾選後加刪除線，進度條顯示完成比例
- **行程類型**：門診 / 抽血 / MRI / CT / X光 / 慢簽 / 復健 / 其他
- **醫院選項**：國泰醫院 / 台大醫院 / 北醫醫院 / 超越診所 / 其他（自訂輸入）
- **看診醫生**：蔡俊明 / 蔡欣熹（神經內科）/ 吳彥雯（心臟科）/ 林志鵬（疼痛科）/ 徐紹剛（復健科）
- **問診備忘**：綁定日期（一天一筆），點進行程詳情可編輯
- **檢視者模式**：隱藏新增按鈕，勾選框 disabled，問診備忘唯讀

### Tab 3 — 設定
- 三個 section：藥物過敏清單 / 藥物清單 / 症狀清單
- 各自可新增、編輯、刪除；變更即時同步雲端
- 「其他」固定在症狀清單末尾，不可刪除
- **家人分享區塊**：產生邀請碼（6碼英數，排除 0/O/1/I，有效期 48 小時）+ 輸入邀請碼綁定
- **登出按鈕**：帶確認 Alert
- **檢視者模式**：隱藏家人分享區塊，所有清單唯讀

---

## 資料模型

### 本機 AsyncStorage

```ts
// SymptomLog（key: "logs"）
{
  id: string               // uuid
  symptoms: string[]       // 多選症狀陣列（新格式）
  symptom: string          // 單一症狀字串（舊格式，兼容）
  severity: number         // 1–10
  startTime: string        // "YYYY/MM/DD HH:MM"
  selfMeds: string[]       // 自行服藥陣列（新格式）
  selfMed: string          // （舊格式，兼容）
  note: string | null
  endTime: string | null
  doctorDiagnosis: string | null
  doctorMed: string | null
  reliefSeverity: number | null  // 0–10
  reliefNote: string | null
}

// Settings（key: "settings"）
{
  symptomList: string[]
  medList: string[]
  allergyList: string[]
  version: number
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
  type: string            // '門診'|'抽血'|'MRI'|'CT'|'X光'|'慢簽'|'復健'|'其他'
  doctor: string | null   // 只有 type==='門診' 才有值
  note: string | null
}

// MedicalHistory（key: "medicalHistory"）
[{
  year: number
  records: [{ id: string, month: number, text: string }]
}]

// ConsultMemo（key: "consultMemo_YYYY-MM-DD"）
string  // 純文字，空內容時 removeItem
```

### Supabase 資料表

```sql
profiles          -- id, full_name, med_list(jsonb), symptom_list(jsonb), allergy_list(jsonb)
symptom_logs      -- id, owner_id, symptom, severity, start_time, self_med, note,
                  --   end_time, doctor_diagnosis, doctor_med, relief_severity, relief_note
daily_med_checks  -- owner_id, check_date, checked(jsonb)  [PK: (owner_id, check_date)]
appointments      -- id, owner_id, appt_time(timestamptz), hospital, type, doctor, note
medical_history   -- id, owner_id, year, month, content
consult_memos     -- owner_id, memo_date(date), content  [PK: (owner_id, memo_date)]
viewer_access     -- id, owner_id, viewer_id, status('accepted'|'revoked')
invite_codes      -- id, owner_id, code, expires_at, used_by, used_at
```

### camelCase ↔ snake_case 對應（cloudSync.js）

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
| dateTime | appt_time（轉 ISO 格式）|
| text（病歷）| content |

---

## 資料夾結構

```
HealthAppFresh/
├── App.js                      # 入口：AuthProvider > ViewerProvider > AppProviders
│                               # AppContent：isLoading → LoginScreen → NavigationContainer
│                               # IdentitySwitcher：身份切換列（有 viewer 時才顯示）
├── app.json                    # usesAppleSignIn: true, plugins: [expo-apple-authentication]
├── babel.config.js             # 含 react-native-reanimated/plugin
├── index.js                    # import 'react-native-get-random-values'
│                               # import 'react-native-url-polyfill/auto'
├── .env                        # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
├── src/
│   ├── constants/
│   │   ├── colors.js           # 色彩系統（唯一色值來源）
│   │   └── defaults.js         # SYMPTOMS_DEFAULT, MEDS_DEFAULT
│   ├── storage/
│   │   └── index.js            # AsyncStorage 讀寫封裝（所有寫入操作附帶雲端同步）
│   ├── lib/
│   │   ├── supabase.js         # Supabase client（AsyncStorage session 持久化）
│   │   ├── cloudSync.js        # 本機 → 雲端同步函式（push/delete/migrate）
│   │   └── viewerData.js       # 雲端 → 本機讀取函式（fetchOwner*）
│   ├── hooks/
│   │   └── useSettings.js      # symptomList / medList / allergyList + 雲端同步
│   ├── context/
│   │   ├── AuthContext.js      # session, user, signInWithApple, signOut
│   │   └── ViewerContext.js    # viewableOwners, activeOwner, setActiveOwner, isViewerMode
│   ├── context.js              # SettingsContext + LogsContext + MedicalHistoryContext
│   ├── screens/
│   │   ├── LoginScreen.js      # Apple 登入畫面（民國墨帳風格）
│   │   ├── RecordScreen.js     # Tab 0
│   │   ├── HistoryScreen.js    # Tab 1（支援 viewerMode）
│   │   ├── DailyMedScreen.js   # Tab 2（支援 viewerMode）
│   │   └── SettingsScreen.js   # Tab 3（家人分享、登出、支援 viewerMode）
│   └── components/
│       ├── Section.js
│       ├── SeverityBadge.js
│       ├── LogCard.js          # readOnly prop 控制檢視者模式
│       ├── DateGroupHeader.js
│       ├── AppPicker.js
│       ├── AppointmentSection.js
│       ├── MedicalHistoryView.js  # readOnly + externalData prop
│       └── ConsultationMemo.js    # readOnly + ownerId prop
└── assets/
```

---

## 雲端同步邏輯

### cloudSync.js 函式清單

| 函式 | 方向 | 對應資料表 |
|------|------|-----------|
| `pushSymptomLogToCloud(log)` | upsert | symptom_logs |
| `deleteSymptomLogFromCloud(id)` | delete | symptom_logs |
| `pushDailyMedCheckToCloud(check)` | upsert | daily_med_checks |
| `pushAppointmentToCloud(appt)` | upsert | appointments |
| `deleteAppointmentFromCloud(id)` | delete | appointments |
| `pushConsultMemoToCloud(date, content)` | upsert/delete | consult_memos |
| `pushMedicalHistoryToCloud(record, year)` | upsert | medical_history |
| `deleteMedicalHistoryFromCloud(id)` | delete | medical_history |
| `deleteMedHistoryYearFromCloud(year)` | delete | medical_history |
| `syncMedListToCloud(medList)` | upsert profiles | profiles |
| `migrateLocalDataToCloud()` | 一次性搬遷（logs + dailyMed）| 同上 |
| `migrateAppointmentsToCloud()` | 補遷移 | appointments |
| `migrateMedHistoryToCloud()` | 補遷移 | medical_history |
| `migrateConsultMemosToCloud()` | 補遷移 | consult_memos |

### Migration flags（AsyncStorage）
- `cloudMigrationDone`：logs + dailyMed 初次搬遷
- `appointmentsMigrationDone`：appointments 補遷移
- `medHistoryMigrationDone`：medical_history 補遷移
- `consultMemoMigrationDone`：consult_memos 補遷移

登入後（`SIGNED_IN` 事件）自動執行 `runSupplementalMigrations()`，各 flag 獨立檢查。

### 前景刷新同步（Pull Sync，Layer 1，實作中）

**背景**：上面這些函式都是「本機 → 雲端」的單向 push，App 從最初設計就沒有「雲端 → 本機」的主動更新機制。症狀：裝置 A 編輯資料並成功推上雲端後，裝置 B（同帳號、App 保持開啟中）不會自動看到更新，除非重新啟動 App 觸發新一次 hydration。

**解法（Layer 1，前景刷新）**：`AppState.addEventListener('change', ...)`，用 ref 判斷是否為「從非 active 變成 active」的瞬間，觸發時向 Supabase 拉當下資料覆蓋本機畫面。只在 Owner 模式執行；拉回的資料寫回本機時**不要**用會順便推雲端的既有 save 函式，避免「拉下來又推上去」的空轉，需要各自資料類型獨立的 `*LocalOnly()` 寫入函式。

**推進狀態**（分層、分資料類型逐步推進，不要一次全上，避免像 C-005～C-008 那樣疊太多功能難以排查）：
1. `daily_med_checks` — ✅ 邏輯完成並修正兩輪問題（Build 31 冷啟動未觸發 → Build 32 補 useFocusEffect + 修正畫面未同步更新），本機驗證通過，Build 32 已送出等候 TestFlight
2. `appointments` — 下一項，尚未開始
3. 設定六個清單 — 尚未開始，需要先確認能否直接複用既有的 `refreshSettingsFromCloud` hydration 邏輯，而非重寫一套
4. 其他資料類型 — 比照辦理，尚未開始

Layer 2（Supabase Realtime 訂閱，真正雙向即時同步）改動範圍較大，留待 Layer 1 全部資料類型上線後再評估，詳見 `docs/devlog.md`「已知架構限制」。

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
| 每日用藥 | 完整功能 | 唯讀，checkbox disabled，隱藏新增 |
| 設定 | 完整設定 | 唯讀，隱藏家人分享區塊 |

### 資料來源
- 擁有者模式：本機 AsyncStorage（透過 Context）
- 檢視者模式：Supabase（透過 `viewerData.js` 的 `fetchOwner*` 函式）

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
- Tab icon：單字楷書漢字（記 / 史 / 藥 / 調）置於小方框內，不用 emoji

### 色彩系統（`src/constants/colors.js` 為唯一色值來源）
- 背景：宣紙暖米（parchment tones）
- Header / 主色：深墨色（warm ink-stone，非冷黑、非森林綠）
- 主題強調色：硃砂紅（cinnabar）— CTA、印記、active 狀態
- 裝飾色：舊金（aged gold）— 規則線、邊框、裝飾元素
- 嚴重度：青瓷（1–3）/ 琥珀（4–6）/ 緋色（7–10）

> 所有色值定義在 `src/constants/colors.js`，**不得在其他檔案硬寫色碼**。

---

## 開發注意事項

- `uuid` 14.x ESM-only：`import { v4 as uuidv4 } from 'uuid'`
- `index.js` 最頂端必須依序 import：`react-native-get-random-values` → `react-native-url-polyfill/auto`
- `react-native-reanimated` 4.x：`babel.config.js` 需加 `'react-native-reanimated/plugin'`
- Picker：使用 `@react-native-picker/picker`
- 所有 AsyncStorage 操作包 try/catch
- Slider：`@react-native-community/slider`
- 顏色：`import { colors } from '../constants/colors'`，不硬寫色碼
- 所有 cloudSync 函式 fire-and-forget，失敗只 console.warn，不阻塞 UI（但失敗時會進 `syncQueue.js` 佇列自動重試，見上方「雲端同步邏輯」）
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
- 打包用的資料夾固定在 `~/Downloads/HealthApp Builds/`（`01原始樣本`／`02乾淨打包外殼`／`03已送出版本`，數字跟中文字之間**沒有空格**），2026/07/19 起已從 Desktop 搬離歸檔完畢，之後打包一律用這個路徑，不用再猜

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