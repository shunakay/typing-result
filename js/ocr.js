/**
 * Gemini API を使った画像OCRモジュール
 * モデル: gemini-2.0-flash
 */
const OCR = (() => {
  const API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  const PROMPT = `このタイピング練習（e-typing等）の成績画像から、以下の項目を抽出してください。
JSONオブジェクトのみを返してください（前後の説明文・コードブロック不要）。

{
  "score": 得点（整数）,
  "inputType": 入力方式（"英字" "日本語" "かな" のいずれか、または画面に表示されている文字列）,
  "timeMinutes": 制限時間（数値・分単位。例: 5分なら5）,
  "charCount": 入力文字数（整数）,
  "correctCount": 正タイプ数（整数）,
  "missCount": 誤タイプ数（整数）,
  "correctRate": 正タイプ率（小数・%値。例: 97.349）,
  "missRate": 誤タイプ率（小数・%値。例: 2.651）
}

注意事項:
- 数値は必ず数値型（文字列ではなく）で返してください
- 画像から読み取れない項目は null にしてください
- 正タイプ率が「正確さ」として表示されている場合もあります
- パーセント記号は除いて数値だけ返してください`;

  /**
   * 画像ファイルを Gemini API に送り、成績データを抽出する
   * @param {File} file  画像ファイル
   * @returns {Promise<Object>} 抽出されたデータ
   */
  const analyzeImage = async (file) => {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error(
        'Gemini API キーが設定されていません。js/config.js の GEMINI_API_KEY を設定してください。'
      );
    }

    const base64Data = await _fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

    const payload = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,  // 決定論的な出力
        maxOutputTokens: 512,
      },
    };

    const res = await fetch(`${API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        `Gemini API エラー (${res.status}): ${errData?.error?.message || res.statusText}`
      );
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return _parseJsonResponse(text);
  };

  /**
   * Gemini の応答テキストから JSON を抽出してパース
   */
  const _parseJsonResponse = (text) => {
    // コードブロック（```json ... ```）があれば中身だけ取り出す
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = codeBlock ? codeBlock[1].trim() : text.trim();

    // { ... } の最初のブロックを取り出す
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI の応答から JSON を取り出せませんでした。画像を確認してください。');
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('AI の応答 JSON が不正な形式です。再度お試しください。');
    }
  };

  /**
   * File → Base64文字列（data URL のデータ部分のみ）
   */
  const _fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        // "data:image/png;base64," の部分を除去
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsDataURL(file);
    });
  };

  return { analyzeImage };
})();
