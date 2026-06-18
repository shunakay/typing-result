/**
 * アプリケーション設定
 *
 * GEMINI_API_KEY は Google AI Studio で取得し、
 * HTTPリファラー制限（GitHub Pages の URL のみ許可）を必ず設定してください。
 *
 * GAS_READ_URL は doGet（全員アクセス可）の GAS Web App URL を設定します。
 * 書き込み用 URL は記録モード設定画面から localStorage に保存します。
 */
const CONFIG = {
  // Gemini API キー（要: HTTPリファラー制限 in Google AI Studio）
  GEMINI_API_KEY: atob('QVEuQWI4Uk42S1JsVVhuQ1lHQjVWdF84dGFDZ1dURGw1Q2tJTDN6eUcwdE8yYVZuNjZCNWc='),

  // GAS Web App URL（読み取り専用・公開 OK）
  // 未設定の場合はサンプルデータで表示します
  GAS_READ_URL: 'https://script.google.com/macros/s/AKfycbwx6krcYi17-c9bmStgHcj2lLJVwf7sJH61IiieM1I1P9AS4FFbkcvDdMrVKwoGoFV7/exec',

  // 目標値（ダッシュボードの達成率表示に使用）
  TARGETS: {
    score: 5000,         // 得点
    correctRate: 99.0,   // 正タイプ率（%）
    charCount: 500,      // 入力文字数
    missCount: 5,        // 誤タイプ数（以下が目標）
  },

  // 入力方式の選択肢（自由に追加可能）
  INPUT_TYPES: ['英字', '日本語', 'かな', 'その他'],

  // サンプルデータ（GAS_READ_URL 未設定時に表示）
  SAMPLE_DATA: [
    {
      date: '2025-01-15', inputType: '英字', timeMinutes: 5,
      score: 3985, charCount: 404, correctCount: 404,
      missCount: 11, correctRate: 97.349, missRate: 2.651, memo: 'サンプル',
    },
    {
      date: '2025-01-16', inputType: '英字', timeMinutes: 5,
      score: 4495, charCount: 457, correctCount: 457,
      missCount: 15, correctRate: 96.822, missRate: 3.178, memo: 'サンプル',
    },
    {
      date: '2025-01-18', inputType: '英字', timeMinutes: 5,
      score: 4210, charCount: 430, correctCount: 430,
      missCount: 8, correctRate: 98.17, missRate: 1.83, memo: 'サンプル',
    },
    {
      date: '2025-01-20', inputType: '英字', timeMinutes: 5,
      score: 4620, charCount: 468, correctCount: 468,
      missCount: 6, correctRate: 98.73, missRate: 1.27, memo: 'サンプル',
    },
    {
      date: '2025-01-22', inputType: '英字', timeMinutes: 5,
      score: 4890, charCount: 495, correctCount: 495,
      missCount: 4, correctRate: 99.20, missRate: 0.80, memo: 'サンプル',
    },
    {
      date: '2025-01-25', inputType: '英字', timeMinutes: 5,
      score: 5020, charCount: 510, correctCount: 510,
      missCount: 3, correctRate: 99.42, missRate: 0.58, memo: 'サンプル',
    },
  ],
};
