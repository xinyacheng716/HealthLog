// "民國醫案墨帳" — Deep Ink Cover · Xuan Paper Pages · Cinnabar Stamps
// Aesthetic: a personal medical case notebook, Republican-era Chinese craft tradition

export const colors = {
  // ── Backgrounds: warm xuan paper tones ──────────────────────────────────
  bg:           '#f4ede0',   // 宣紙 aged xuan paper — page body
  bgCard:       '#fdf8f0',   // slightly lighter for card surfaces
  bgCardBottom: '#f6eedd',   // card follow-up section, slightly deeper
  bgSection:    '#ede4d4',   // filter bars, grouped section backgrounds

  // ── Primary identity: deep warm ink-stone ───────────────────────────────
  header:       '#2e2018',   // 深墨 warm ink-stone, the book cover
  headerDeep:   '#1e1410',   // near-black for gradient depths
  headerMid:    '#3d2c1e',   // mid-tone for subtle variation

  // ── Cinnabar accent: the signature stamp color ──────────────────────────
  cinnabar:     '#8b3020',   // 硃砂 cinnabar — primary CTA, active accents
  cinnabarMid:  '#a03c28',   // slightly lighter cinnabar
  cinnabarFaint:'#f0ddd8',   // very light cinnabar tint for backgrounds

  // ── Aged gold: the gilded binding and decorative rules ──────────────────
  gold:         '#9a7838',   // aged gold — ornaments, borders, labels
  goldLight:    '#c4a058',   // lighter gold for text on dark backgrounds
  goldFaint:    '#e8d8b4',   // near-white gold, subtle fills

  // ── Ink & text system ───────────────────────────────────────────────────
  white:        '#fdf8f0',   // warm white (matches bgCard)
  textPrimary:  '#2a1c10',   // warm ink black — body text
  textMuted:    '#8a7458',   // faded ink — secondary text
  textLabel:    '#6a5438',   // warm gray-brown — labels, captions

  // ── Semantic field colors (traditional dye/pigment references) ──────────
  textSelfMed:  '#7a4420',   // 褐 deep amber-brown
  textDiagnosis:'#284060',   // 靛 deep indigo
  textDoctorMed:'#2a5028',   // 青 deep moss-green
  textRelief:   '#48622c',   // 草 olive-green

  // ── Border system ───────────────────────────────────────────────────────
  border:       '#d0c0a0',   // warm parchment border
  borderLight:  '#e4d8c4',   // lighter border
  borderFaint:  '#ede8dc',   // near-invisible dividers

  // ── UI states ───────────────────────────────────────────────────────────
  btnDisabled:  '#c4b8a4',
  deleteRed:    '#8b2020',
};

// Refined shadow for card elevation (warm-toned)
export const cardShadow = {
  shadowColor: '#2a1c10',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 8,
  elevation: 3,
};

export const TYPE_COLORS = {
  '門診': '#8b3020',   // cinnabar
  '抽血': '#284060',   // deep indigo
  'MRI':  '#2a5028',   // moss-green
  'CT':   '#7a4420',   // amber-brown
  '骨掃描': '#4a5a78', // slate-blue
  'X光':  '#9a7838',   // aged gold
  '慢簽': '#48622c',   // olive
  '復健': '#8a7458',   // textMuted warm
  '其他': '#8a7458',
};

export const headerShadow = {
  shadowColor: '#1e1410',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 10,
};
