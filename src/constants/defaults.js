// 預設清單版本。每次調整下方任一預設清單就 +1，
// app 啟動時會對版本較舊的 AsyncStorage 設定做遷移（精準移除 + 補上新預設）。
export const SETTINGS_VERSION = 3;

// 遷移時要從既有清單中移除的項目（不分清單，比對字串）。
// 注意：只移除這些指定項目，使用者自行新增的其他項目會保留。
export const REMOVED_ITEMS = ['Anzyme', '腳部疼痛', '椎體外症候群'];

// v3：新增「牛肉精」，遷移時補到藥物清單最前面（見 storage/index.js loadSettings）。
export const BEEF_ESSENCE = '牛肉精';

export const SYMPTOMS_DEFAULT = [
  '胸痛', '肋骨疼痛', '關節疼痛／髖部疼痛', '脊椎僵硬',
  '呼吸困難', '噁心／嘔吐', '發燒', '疲倦', '食慾不振',
  '咳嗽', '水腫', '頭暈', '便秘', '其他',
];

export const MEDS_DEFAULT = [
  BEEF_ESSENCE,
  '泰格莎 Tagrisso', '嗎啡貼布', '嗎啡緩釋錠',
  '希樂葆 Celebrex', '法莫替丁 Famotidine', '克利生 Clexane',
  '心律整 Propranolol', '戀多眠 Lendormin', '立福全 Rivotril',
  '驅異樂 Xyzal', '適秘效 Symproic', '昂特欣 Eltroxin',
];

export const ALLERGY_DEFAULT = [
  '暢腹立 Panzyme Pancreatin Metoclopramide',
  '磺胺類藥物 Sulfonamides',
  '吲哚美辛 Indomethacin',
];

// 「新增行程」表單下拉選單的初始清單（遷移自 AppointmentSection.js 原本寫死的選項）
export const HOSPITAL_DEFAULT = ['國泰醫院', '台大醫院', '北醫醫院', '超越診所', '其他'];

export const VISIT_TYPE_DEFAULT = ['門診', '抽血', 'MRI', 'CT', '骨掃描', 'X光', '慢簽', '復健', '其他'];

export const DOCTOR_DEFAULT = [
  '蔡俊明',
  '蔡欣熹（神經內科）',
  '吳彥雯（心臟科）',
  '林志鵬（疼痛科）',
  '徐紹剛（復健科）',
];

// 病歷預設資料：以年份分組、降冪（最新在上），年份內依月份降冪。
// 不含 id，於 storage 首次帶入時才產生 uuid（見 loadMedicalHistory）。
export const MEDICAL_HISTORY_DEFAULT = [
  { year: 2026, records: [
    { month: 5, text: '正子檢查胸腔淋巴無腫瘤，切片報告發炎纖維化' },
  ] },
  { year: 2025, records: [
    { month: 10, text: '質子 25 次' },
    { month: 9, text: '太紫 10 次' },
    { month: 8, text: '光子治骨轉 10 次' },
    { month: 7, text: '肺倍恩 5 支 3 週，歐紫 2 休 1，血栓中風住院一個月' },
    { month: 6, text: '光子腦轉移治療' },
    { month: 5, text: '腦轉移，肺倍恩＋紫杉醇＋泰格莎' },
    { month: 3, text: '肋膜擴散，肺倍恩＋歐洲紫杉醇' },
  ] },
  { year: 2024, records: [
    { month: 11, text: '免疫＋卡鉑' },
  ] },
  { year: 2023, records: [
    { month: 9, text: '泰格莎＋健澤' },
    { month: 1, text: '癌自癒＋癌思停＋卡鉑＋愛寧達 6 個月，免疫反應，甲狀腺低下' },
  ] },
  { year: 2020, records: [
    { month: 5, text: '開始泰格莎' },
  ] },
  { year: 2017, records: [
    { month: 1, text: '得舒緩＋癌思停 25 次（至 2019）' },
  ] },
  { year: 2016, records: [
    { month: 12, text: 'Stage 4 骨盆 肋膜 EGFR L858R TP53' },
  ] },
  { year: 2014, records: [
    { month: 12, text: '肺腺癌開刀 Stage 1' },
  ] },
];
