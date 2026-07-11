# 健康記錄 App — 完整規格書（2026/07 更新版）

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

## 2. 技術規格

### 技術棧

| 項目 | 版本 / 套件 |
|------|-----------|
| Framework | React Native + **Expo SDK 54**（`expo: ~54.0.0`）|
| Navigation | `@react-navigation/native` ^7.0.0 + `@react-navigation/bottom-tabs` ^7.2.0 |
| 本機 Storage | `@react-native-async-storage/async-storage` 2.2.0 |
| 雲端後端 | Supabase（`https://npizltqgwfcrldmzsyyx.supabase.co`）|
| 認證 | Apple Sign In（`expo-apple-authentication` + `signInWithIdToken`）|
| UUID | `uuid` ^14.0.0 + `react-native-get-random-values` ~1.11.0 |
| 動畫 | `react-native-reanimated` ~4.1.1 |
| 漸層 | `expo-linear-gradient` ~15.0.8 |
| Slider | `@react-native-community/slider` 5.0.1 |
| Picker | `@react-native-picker/picker` 2.11.1 |
| DateTimePicker | `@react-native-community/datetimepicker` 8.4.4 |
| 目標平台 | iOS（TestFlight 內部測試）|
| Bundle ID | `com.sophiechenggg.healthlog` |
| Expo Project ID | `1d365195-d613-44a9-a742-77a94055c6f9` |

> 查閱 Expo API 時使用 https://docs.expo.dev/versions/v54.0.0/

### 環境設定
```
# .env（不得 commit）
EXPO_PUBLIC_SUPABASE_URL=https://npizltqgwfcrldmzsyyx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

---

## 3. 資料架構

### 3-1. 本機 AsyncStorage

```ts
// SymptomLog（key: "logs"）
{
  id: string               // uuid v4
  symptoms: string[]       // 多選症狀陣列（主格式）
  symptom?: string         // 舊格式兼容（單一字串）
  severity: number         // 1–10
  startTime: string        // "YYYY/MM/DD HH:MM"
  selfMeds: string[]       // 自行服藥陣列（主格式）
  selfMed?: string         // 舊格式兼容
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
  date: string             // "YYYY-MM-DD"
  checked: Record<string, boolean>  // { "藥名": true/false }
}

// Appointment（key: "appointments"）
// Array of:
{
  id: string               // uuid v4
  dateTime: string         // "YYYY/MM/DD HH:MM"
  hospital: string
  type: string             // 見行程類型清單
  doctor: string | null    // 只有 type==='門診' 才有值
  note: string | null
}

// MedicalHistory（key: "medicalHistory"）
// Array of:
{
  year: number
  records: Array<{
    id: string
    month: number          // 1–12
    text: string
  }>
}

// ConsultMemo（key: "consultMemo_YYYY-MM-DD"）
string  // 純文字；內容為空時 removeItem，不存空字串

// Migration flags（各自獨立）
"cloudMigrationDone"        // logs + dailyMed 初次搬遷
"appointmentsMigrationDone" // appointments 補遷移
"medHistoryMigrationDone"   // medical_history 補遷移
"consultMemoMigrationDone"  // consult_memos 補遷移
```

### 3-2. Supabase 資料表

```sql
-- 使用者個人資料
profiles (
  id uuid PRIMARY KEY,          -- 對應 auth.users.id
  full_name text,
  med_list jsonb,               -- 藥物清單（同步自 settings.medList）
  symptom_list jsonb,           -- 症狀清單
  allergy_list jsonb,           -- 過敏清單
  created_at timestamptz
)

-- 症狀紀錄
symptom_logs (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES profiles(id),
  symptom text NOT NULL,        -- symptoms[] join 成「、」分隔字串
  severity smallint,            -- 1–10
  start_time timestamptz,
  self_med text,                -- selfMeds[] join 成「、」分隔字串
  note text,
  end_time timestamptz,
  doctor_diagnosis text,
  doctor_med text,
  relief_severity smallint,     -- 0–10
  relief_note text,
  created_at timestamptz
)

-- 每日用藥勾選
daily_med_checks (
  owner_id uuid REFERENCES profiles(id),
  check_date date,
  checked jsonb,                -- Record<string, boolean>
  PRIMARY KEY (owner_id, check_date)
)

-- 醫院行程
appointments (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES profiles(id),
  appt_time timestamptz,
  hospital text,
  type text,
  doctor text,
  note text,
  created_at timestamptz
)

-- 病歷
medical_history (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES profiles(id),
  year smallint,
  month smallint,               -- 1–12
  content text,                 -- 對應本機的 text 欄位
  created_at timestamptz
)

-- 問診備忘
consult_memos (
  owner_id uuid REFERENCES profiles(id),
  memo_date date,
  content text,
  updated_at timestamptz,
  PRIMARY KEY (owner_id, memo_date)
)

-- 家人授權關係
viewer_access (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES profiles(id),
  viewer_id uuid REFERENCES profiles(id),
  status text,                  -- 'accepted' | 'revoked'
  created_at timestamptz,
  UNIQUE (owner_id, viewer_id)
)

-- 邀請碼
invite_codes (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES profiles(id),
  code text UNIQUE,             -- 6碼大寫英數，排除 0/O/1/I
  expires_at timestamptz,       -- 產生後 48 小時
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz
)
```

### 3-3. camelCase ↔ snake_case 對應（cloudSync.js）

| 本機欄位 | Supabase 欄位 | 轉換方式 |
|---------|--------------|---------|
| `symptoms[]` | `symptom` | `join('、')` |
| `selfMeds[]` | `self_med` | `join('、')`，空陣列存 null |
| `startTime` | `start_time` | `"YYYY/MM/DD HH:MM"` → ISO timestamptz |
| `endTime` | `end_time` | 同上 |
| `doctorDiagnosis` | `doctor_diagnosis` | 直接帶值 |
| `doctorMed` | `doctor_med` | 直接帶值 |
| `reliefSeverity` | `relief_severity` | 直接帶值 |
| `reliefNote` | `relief_note` | 直接帶值 |
| `dateTime`（行程）| `appt_time` | 同 startTime 轉換 |
| `text`（病歷）| `content` | 直接帶值 |
| `month`（病歷）| `month` | 直接帶值 |

---

## 4. 應用程式架構

### 4-1. 進入點與 Provider 層級

```
index.js
  import 'react-native-get-random-values'   ← 必須最頂端
  import 'react-native-url-polyfill/auto'   ← Supabase 需要
  registerRootComponent(App)

App.js
  SafeAreaProvider
    AuthProvider              ← session / signInWithApple / signOut
      ViewerProvider          ← viewableOwners / activeOwner / isViewerMode
        AppProviders          ← SettingsContext + LogsContext + MedicalHistoryContext
          AppContent
            isLoading → 黑底 View（避免閃爍）
            !session  → LoginScreen
            session   → NavigationContainer + Tab.Navigator + IdentitySwitcher
```

### 4-2. Context 清單

| Context | 檔案 | 管理內容 |
|---------|------|---------|
| AuthContext | `src/context/AuthContext.js` | session, user, isLoading, signInWithApple, signOut |
| ViewerContext | `src/context/ViewerContext.js` | viewableOwners, activeOwner, setActiveOwner, isViewerMode |
| SettingsContext | `src/context.js`（透過 useSettings hook）| symptomList, medList, allergyList + CRUD |
| LogsContext | `src/context.js` | logs, logsReady, addLog, updateLog, deleteLog |
| MedicalHistoryContext | `src/context.js` | medicalHistory, medReady + CRUD |

### 4-3. 資料夾結構

```
HealthAppFresh/
├── App.js
├── app.json
├── babel.config.js          # 含 react-native-reanimated/plugin
├── index.js
├── eas.json                 # build profiles: development / preview / production
├── .env                     # EXPO_PUBLIC_SUPABASE_*（不 commit）
├── docs/
│   └── spec.md
├── src/
│   ├── constants/
│   │   ├── colors.js        # 唯一色值來源
│   │   └── defaults.js      # SYMPTOMS_DEFAULT, MEDS_DEFAULT
│   ├── storage/
│   │   └── index.js         # AsyncStorage 封裝 + 觸發雲端同步
│   ├── lib/
│   │   ├── supabase.js      # Supabase client
│   │   ├── cloudSync.js     # 本機 → 雲端（push / delete / migrate）
│   │   └── viewerData.js    # 雲端 → 本機讀取（fetchOwner*）
│   ├── hooks/
│   │   └── useSettings.js
│   ├── context/
│   │   ├── AuthContext.js
│   │   └── ViewerContext.js
│   ├── context.js
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── RecordScreen.js
│   │   ├── HistoryScreen.js
│   │   ├── DailyMedScreen.js
│   │   └── SettingsScreen.js
│   └── components/
│       ├── Section.js
│       ├── SeverityBadge.js
│       ├── LogCard.js             # readOnly prop
│       ├── DateGroupHeader.js
│       ├── AppPicker.js
│       ├── AppointmentSection.js
│       ├── MedicalHistoryView.js  # readOnly + externalData prop
│       └── ConsultationMemo.js    # readOnly + ownerId prop
└── assets/
```

---

## 5. 畫面規格

### 5-1. 登入畫面（LoginScreen）
- 顯示時機：`session === null`
- 畫面中央：App 名稱「健康記錄」+ 歡迎文字
- 按鈕：`AppleAuthentication.AppleAuthenticationButton`（buttonStyle: BLACK）
- 風格：民國墨帳，深墨底色，標楷體

### 5-2. Tab 0 — 記錄症狀（RecordScreen）

**擁有者模式：**
- 症狀多選（從 `symptomList` 取值）；選「其他」顯示自由輸入欄
- 嚴重程度 Slider 1–10，標示「輕微 / 中度 / 嚴重」
- 開始時間自動帶入當前時間（`YYYY/MM/DD HH:MM`），可手動編輯
- 自行服藥多選（從 `medList` 取值）
- 送出按鈕「記錄」：未選症狀時 disabled

**檢視者模式：**
- 顯示「閱」字印章 + 「目前為查看模式，無法新增紀錄」提示
- 引導文字：「請在上方切換回『查看自己』」

### 5-3. Tab 1 — 歷史紀錄（HistoryScreen）

子分頁：**症狀紀錄 / 病歷 / 分享**

**症狀紀錄：**
- 頂部篩選下拉（全部症狀 + 已出現過的症狀）
- 按日期分組（降冪），每組有日期 header
- 每張 LogCard 分上下兩區：
  - 上：嚴重度徽章、症狀名、時間區間、自行服藥、醫生診斷、醫生用藥、緩解狀況
  - 下：補填按鈕 or 編輯按鈕 → 展開 inline 表單
- 補填欄位：結束時間、醫生診斷、醫生確認用藥、緩解後嚴重度（0–10 Slider）、備註

**病歷：**
- 頂部：新增年份輸入框 + 新增按鈕
- 按年份降冪分組，每年可新增 / 編輯 / 刪除個別記錄，也可刪除整年
- 每筆記錄顯示：月份圖章 + 內容文字

**分享：**
- 按鈕：呼叫 `Share.share()`，將病歷格式化成純文字分享（iOS 系統分享選單）

**檢視者模式：**
- 頂部橫幅：「● 目前查看：{name} 的紀錄」
- 隱藏所有新增 / 編輯 / 刪除按鈕
- LogCard `readOnly={true}`，MedicalHistoryView `readOnly={true}`

### 5-4. Tab 2 — 每日用藥（DailyMedScreen）

子分頁：**月曆行程 / 所有行程 / 今日用藥**

**月曆行程：**
- 月曆顯示，有行程的日期標記小點
- 點日期進入日期詳情頁：顯示當日行程卡片 + 問診備忘
- 日期詳情頁：返回按鈕 + 「今日」快捷按鈕

**所有行程：**
- 依日期降冪列出所有行程
- 頂部雙篩選器：類型（全部/門診/抽血/MRI/CT/X光/慢簽/復健/其他）+ 醫院（全部/國泰/台大/北醫/超越/其他）
- 點行程進入詳情頁（同月曆點日期後的格式）

**今日用藥：**
- 日期標題 + 進度條（已服 X / 總計 N）
- 藥物清單：勾選框 + 藥名，勾選後加刪除線、按鈕變實心紅「服」字
- 分母來源：owner 的完整 `medList`

**行程類型選項：** 門診 / 抽血 / MRI / CT / X光 / 慢簽 / 復健 / 其他

**醫院選項：** 國泰醫院 / 台大醫院 / 北醫醫院 / 超越診所 / 其他（自訂輸入）

**看診醫生選項：**
- 蔡俊明
- 蔡欣熹（神經內科）
- 吳彥雯（心臟科）
- 林志鵬（疼痛科）
- 徐紹剛（復健科）

**問診備忘：**
- 綁定日期，一天一筆（`consultMemo_YYYY-MM-DD`）
- 同一天多筆行程共用同一份備忘
- 支援條列輸入（`+ 條目` 按鈕）

**檢視者模式：**
- 隱藏「+ 新增」行程按鈕
- 勾選框 disabled（不可勾選）
- 問診備忘唯讀
- 分母從 `fetchOwnerMedList(ownerId)` 讀取 owner 的藥物清單

### 5-5. Tab 3 — 設定（SettingsScreen）

**過敏藥物清單：**
- 列表顯示，各項可編輯 / 刪除
- 底部輸入框 + 新增按鈕

**藥物清單（medList）：**
- 同上結構
- 變更後同步呼叫 `syncMedListToCloud`

**症狀清單（symptomList）：**
- 同上結構
- 「其他」固定在末尾，不可刪除（顯示「固定項目」標籤）

**家人分享：**
- 產生邀請碼：6碼大寫英數（排除 0/O/1/I），有效期 48 小時
- 成功後以硃砂大字顯示邀請碼 + 分享按鈕（`Share.share()`）
- 可重新產生
- 輸入邀請碼：輸入框（`autoCapitalize="characters"`）+ 綁定按鈕
- 呼叫 `supabase.rpc('redeem_invite_code', { invite_code })`

**登出：**
- 按鈕 + Alert 確認（「確定要登出嗎？」）
- 呼叫 `supabase.auth.signOut()`

**檢視者模式：**
- 隱藏家人分享整個區塊
- 所有清單唯讀（隱藏新增 / 編輯 / 刪除按鈕）

---

## 6. 家人共享系統

### 6-1. 邀請碼流程
1. Owner 在設定頁面點「產生邀請碼」
2. 系統產生 6 碼大寫英數字串，INSERT 進 `invite_codes` 表，有效期 48 小時
3. Owner 透過系統分享選單把邀請碼傳給家人
4. 家人打開 App，登入後進設定，輸入邀請碼按「綁定」
5. App 呼叫 `supabase.rpc('redeem_invite_code', { invite_code })`
6. 資料庫函式驗證（存在、未過期、未使用、非自己邀自己），寫入 `viewer_access`
7. 成功後 Alert「已成功綁定」

### 6-2. 身份切換（IdentitySwitcher）
- 顯示條件：`viewableOwners.length > 0`
- 位置：AppHeader 下方、Tab.Navigator 上方
- 內容：「查看自己」按鈕 + 各 owner 姓名按鈕
- 樣式：active 狀態用硃砂色底色

### 6-3. 檢視者資料來源（viewerData.js）

| 函式 | 來源表 | 回傳格式 |
|------|--------|---------|
| `fetchOwnerLogs(ownerId)` | symptom_logs | camelCase，symptom 字串 split 成 symptoms[] |
| `fetchOwnerMedicalHistory(ownerId)` | medical_history | 巢狀年份結構 `[{year, records:[{id,month,text}]}]` |
| `fetchOwnerAppointments(ownerId)` | appointments | camelCase，appt_time → dateTime |
| `fetchOwnerDailyMed(ownerId, date)` | daily_med_checks | `{date, checked}` |
| `fetchOwnerMarkedDates(ownerId)` | appointments | 有行程日期的集合（月曆標記用）|
| `fetchOwnerMedList(ownerId)` | profiles.med_list | string[] |
| `fetchOwnerConsultMemo(ownerId, date)` | consult_memos | string |

### 6-4. RLS 規則摘要
- 所有表 RLS 開啟
- Owner：對自己資料全權限（SELECT / INSERT / UPDATE / DELETE）
- Viewer：只能 SELECT，條件是 `viewer_access` 表中有對應的 `accepted` 授權
- `redeem_invite_code` 函式為 `SECURITY DEFINER`，繞過 RLS 寫入 viewer_access

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
| 嚴重度 1–3 | 青瓷色 |
| 嚴重度 4–6 | 琥珀色 |
| 嚴重度 7–10 | 緋色 |

### 7-4. Tab 圖示
單字楷書漢字置於小方框（印章樣式）：
- Tab 0：記
- Tab 1：史
- Tab 2：藥
- Tab 3：調

---

## 8. 開發流程

### 8-1. 日常開發（純 JS 改動）

```bash
# Terminal：啟動 Metro
cd ~/Downloads/Projects/HealthAppFresh
npx expo start --dev-client

# 手機打開 Development Build（恐龍圖示），掃 QR code
# 程式碼改動熱更新，不需 build
```

### 8-2. Build + Submit（正式版本）

```bash
# Build（在普通 Terminal，不要在 Claude Code 裡跑）
cd ~/Downloads/Projects/HealthAppFresh
eas build --platform ios

# Submit（若卡住超過 15 分鐘，改用 Transporter）
eas submit --platform ios --latest
```

**Transporter 備用上傳：**
1. Mac App Store 搜尋「Transporter」（Apple 官方，免費）
2. 從 expo.dev 下載 .ipa 檔案
3. 拖入 Transporter → 用 Apple ID 登入 → 按 Deliver

### 8-3. EAS Build 額度管理
- 免費方案：每月 15 次 iOS build
- 查詢用量：https://expo.dev/accounts/sophiechenggg/billing
- **節省原則**：UI 改動先在 Development Build 確認定案，再統一 build

### 8-4. Development Build vs TestFlight

| | Development Build | TestFlight |
|--|--|--|
| 圖示 | 恐龍（粉紅色）| 正常 App 圖示 |
| 安裝方式 | `eas build --profile development` 後掃 QR 安裝 | 透過 TestFlight App |
| 熱更新 | ✅（Metro 連線時）| ❌（需重新 build + submit）|
| Apple Sign In | ✅ | ✅ |
| 用途 | 開發測試 | 給用戶使用 |

### 8-5. TestFlight 測試人員
| 姓名 | Apple ID | 狀態 |
|------|---------|------|
| ChengJui Hsi（爸爸）| rayjhcheng@gmail.com | 已安裝 1.0.0 (16) |
| 程歆雅（開發者）| sophiecheng0716@gmail.com | 已安裝 |
| 程偉綸（弟弟）| williammantou@gmail.com | 已邀請 |
| ChenElysia（媽媽）| elysiachentp@gmail.com | 待確認 |

> 新增內部測試人員：先在 Apple Developer 後台加為成員 → 再到 App Store Connect → TestFlight → 測試人員加入

---

## 9. 已知問題與注意事項

### 9-1. 爸爸的雙帳號歷史
爸爸在 Supabase 有兩個 UUID：
- `d6dce0d7...`：開發測試期間用 Xinya 的 Apple ID 登入產生，**已廢棄**
- `423e495b...`：爸爸真實 Apple ID 登入後產生，**這是正確帳號**

所有資料已於 2026/07/01 用 SQL UPDATE 搬移到 `423e495b...`。
未來不要再用 `d6dce0d7...`。

### 9-2. SafeAreaView 警告
Metro log 常見 `SafeAreaView has been deprecated` 警告，這是 Expo SDK 54 底層的已知問題，不影響功能，暫時忽略。

### 9-3. 補遷移機制
每次登入（`SIGNED_IN` 事件）會觸發 `runSupplementalMigrations()`，透過四個獨立 flag 確保各類資料只搬遷一次，不重複上傳。

### 9-4. eas submit 可能卡住
EAS Submit 有時會在 `waiting for an available submitter` 卡住超過 15 分鐘，這是 EAS 雲端佇列問題，不是程式碼問題。改用 Transporter 可完全繞過此問題。
