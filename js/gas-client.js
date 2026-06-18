/**
 * GAS Web App との通信モジュール
 *
 * doGet  : 全レコード取得（認証不要・公開 URL）
 * doPost : 追加 / 更新 / 削除（書き込み用 URL を知っている人のみ）
 */
const GasClient = (() => {
  /** 読み取り用 URL（config.js から） */
  const getReadUrl = () => CONFIG.GAS_READ_URL;

  /** 書き込み用 URL（localStorage から） */
  const getWriteUrl = () => localStorage.getItem('gasWriteUrl');

  /**
   * 全レコードを取得する
   * @returns {Promise<Array>} レコード配列（日付昇順）
   */
  const fetchRecords = async () => {
    const url = getReadUrl();
    if (!url || url === 'YOUR_GAS_WEB_APP_URL_HERE') {
      // GAS 未設定時はサンプルデータを使用
      return CONFIG.SAMPLE_DATA.map((r, i) => ({ ...r, rowIndex: i + 2 }));
    }

    try {
      const res = await fetch(`${url}?action=list`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Unknown error');
      return json.data || [];
    } catch (err) {
      console.error('[GasClient] fetchRecords error:', err);
      throw err;
    }
  };

  /**
   * 新規レコードを追加する
   * @param {Object} record  スプレッドシートに書き込むデータ
   */
  const createRecord = async (record) => {
    return _post({ action: 'create', record });
  };

  /**
   * レコードを更新する
   * @param {number} rowIndex  スプレッドシートの行番号（2 始まり）
   * @param {Object} record    更新後のデータ
   */
  const updateRecord = async (rowIndex, record) => {
    return _post({ action: 'update', rowIndex, record });
  };

  /**
   * レコードを削除する
   * @param {number} rowIndex  スプレッドシートの行番号（2 始まり）
   */
  const deleteRecord = async (rowIndex) => {
    return _post({ action: 'delete', rowIndex });
  };

  /** POST 共通処理 */
  const _post = async (body) => {
    const url = getWriteUrl();
    if (!url) throw new Error('GAS 書き込み URL が設定されていません。⚙️ から設定してください。');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // GAS の CORS 対応のため text/plain
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Unknown error');
    return json;
  };

  return { fetchRecords, createRecord, updateRecord, deleteRecord, getWriteUrl };
})();
