/**
 * 記録モード UI 制御モジュール
 * ・画像アップロード & OCR
 * ・手動入力フォーム（追加・編集）
 * ・履歴テーブル（編集・削除ボタン）
 * ・設定モーダル
 */
const Recorder = (() => {

  /* =====================================================
     内部状態
     ===================================================== */
  let _records = [];       // 全レコードのキャッシュ
  let _isRecordMode = false;
  let _onRefresh = null;   // データ更新後のコールバック

  /* =====================================================
     初期化
     ===================================================== */
  const init = (isRecordMode, onRefresh) => {
    _isRecordMode = isRecordMode;
    _onRefresh = onRefresh;

    _initSettingsModal();
    _initDeleteModal();

    if (isRecordMode) {
      _initUpload();
      _initRecordForm();
      _initEditModal();
    }
  };

  /* =====================================================
     設定モーダル
     ===================================================== */
  const _initSettingsModal = () => {
    const btn    = document.getElementById('settings-btn');
    const modal  = document.getElementById('settings-modal');
    const input  = document.getElementById('gas-url-input');
    const saveBtn = document.getElementById('save-settings-btn');
    const disableBtn = document.getElementById('disable-record-mode-btn');

    btn?.addEventListener('click', () => {
      // 現在の URL を表示
      input.value = localStorage.getItem('gasWriteUrl') || '';
      _openModal('settings-modal');
    });

    saveBtn?.addEventListener('click', () => {
      const url = input.value.trim();
      if (url) {
        localStorage.setItem('gasWriteUrl', url);
        Toast.show('記録モードを有効にしました。再読み込みします…', 'success');
        setTimeout(() => location.reload(), 1200);
      } else {
        Toast.show('URL を入力してください', 'error');
      }
    });

    disableBtn?.addEventListener('click', () => {
      localStorage.removeItem('gasWriteUrl');
      Toast.show('記録モードを解除しました。再読み込みします…', 'info');
      setTimeout(() => location.reload(), 1200);
    });

    // モーダルを閉じるボタン（data-modal 属性）
    _initModalClose();
  };

  /* =====================================================
     削除確認モーダル
     ===================================================== */
  const _initDeleteModal = () => {
    const confirmBtn = document.getElementById('delete-confirm-btn');
    confirmBtn?.addEventListener('click', async () => {
      const rowIndex = parseInt(document.getElementById('delete-row-index').value, 10);
      if (!rowIndex) return;
      try {
        await GasClient.deleteRecord(rowIndex);
        Toast.show('削除しました', 'success');
        _closeModal('delete-modal');
        _onRefresh?.();
      } catch (e) {
        Toast.show(`削除エラー: ${e.message}`, 'error');
      }
    });
  };

  /* =====================================================
     画像アップロード & OCR
     ===================================================== */
  const _initUpload = () => {
    const area      = document.getElementById('upload-area');
    const inner     = document.getElementById('upload-inner');
    const fileInput = document.getElementById('file-input');
    const preview   = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-img');
    const clearBtn  = document.getElementById('clear-image-btn');

    // クリックでファイル選択
    inner?.addEventListener('click', () => fileInput.click());

    // ファイル選択
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) _handleFile(file);
    });

    // ドラッグ&ドロップ
    area?.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('drag-over');
    });
    area?.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area?.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) _handleFile(file);
    });

    // クリア
    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      previewImg.src = '';
      preview.classList.add('hidden');
      inner.classList.remove('hidden');
      fileInput.value = '';
    });

    async function _handleFile(file) {
      if (!file.type.startsWith('image/')) {
        Toast.show('画像ファイルを選択してください', 'error');
        return;
      }
      // プレビュー表示
      const url = URL.createObjectURL(file);
      previewImg.src = url;
      inner.classList.add('hidden');
      preview.classList.remove('hidden');

      // OCR
      const status     = document.getElementById('ocr-status');
      const statusText = document.getElementById('ocr-status-text');
      status.classList.remove('hidden');
      statusText.textContent = '🤖 AI が画像を解析中...';

      try {
        const result = await OCR.analyzeImage(file);
        statusText.textContent = '✅ 解析完了。内容を確認してください。';
        _fillForm(result);
      } catch (e) {
        statusText.textContent = `❌ 解析エラー: ${e.message}`;
        Toast.show(`OCR エラー: ${e.message}`, 'error');
      }
    }
  };

  /** OCR 結果をフォームに流し込む */
  const _fillForm = (ocr) => {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== null && val !== undefined) el.value = val;
    };
    set('f-score',         ocr.score);
    set('f-input-type',    ocr.inputType);
    set('f-time',          ocr.timeMinutes);
    set('f-char-count',    ocr.charCount);
    set('f-correct-count', ocr.correctCount);
    set('f-miss-count',    ocr.missCount);
    set('f-correct-rate',  ocr.correctRate !== null ? ocr.correctRate : '');
    set('f-miss-rate',     ocr.missRate    !== null ? ocr.missRate    : '');
  };

  /* =====================================================
     追加フォーム
     ===================================================== */
  const _initRecordForm = () => {
    // 今日の日付をデフォルト設定
    const dateInput = document.getElementById('f-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    // 正タイプ率・誤タイプ率の自動計算
    ['f-correct-count', 'f-miss-count'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', _autoCalcRates);
    });

    // クリアボタン
    document.getElementById('form-clear-btn')?.addEventListener('click', _clearForm);

    // フォーム送信
    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const record = _collectFormData('f-');
      const btn = document.getElementById('form-submit-btn');
      btn.disabled = true;
      btn.textContent = '保存中...';
      try {
        await GasClient.createRecord(record);
        Toast.show('記録を保存しました！', 'success');
        _clearForm();
        _closeModal('record-modal');
        _onRefresh?.();
      } catch (err) {
        Toast.show(`保存エラー: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'スプレッドシートに保存';
      }
    });
  };

  const _autoCalcRates = () => {
    const correct = parseFloat(document.getElementById('f-correct-count')?.value) || 0;
    const miss    = parseFloat(document.getElementById('f-miss-count')?.value)    || 0;
    const total   = correct + miss;
    if (total > 0) {
      const correctRate = ((correct / total) * 100).toFixed(3);
      const missRate    = ((miss    / total) * 100).toFixed(3);
      document.getElementById('f-correct-rate').value = correctRate;
      document.getElementById('f-miss-rate').value    = missRate;
    }
  };

  const _autoCalcRatesEdit = () => {
    const correct = parseFloat(document.getElementById('e-correct-count')?.value) || 0;
    const miss    = parseFloat(document.getElementById('e-miss-count')?.value)    || 0;
    const total   = correct + miss;
    if (total > 0) {
      document.getElementById('e-correct-rate').value = ((correct / total) * 100).toFixed(3);
      document.getElementById('e-miss-rate').value    = ((miss    / total) * 100).toFixed(3);
    }
  };

  const _clearForm = () => {
    document.getElementById('record-form')?.reset();
    document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('ocr-status')?.classList.add('hidden');
    document.getElementById('upload-preview')?.classList.add('hidden');
    document.getElementById('upload-inner')?.classList.remove('hidden');
    document.getElementById('file-input').value = '';
  };

  /** フォームデータを収集してオブジェクト化 */
  const _collectFormData = (prefix) => {
    const g = (id) => {
      const el = document.getElementById(`${prefix}${id}`);
      return el ? el.value : '';
    };
    const num = (id) => {
      const v = parseFloat(g(id));
      return isNaN(v) ? null : v;
    };
    return {
      date:         g('date'),
      inputType:    g('input-type'),
      timeMinutes:  num('time'),
      score:        num('score'),
      charCount:    num('char-count'),
      correctCount: num('correct-count'),
      missCount:    num('miss-count'),
      correctRate:  num('correct-rate'),
      missRate:     num('miss-rate'),
      memo:         g('memo'),
    };
  };

  /* =====================================================
     編集モーダル
     ===================================================== */
  const _initEditModal = () => {
    // 自動計算
    ['e-correct-count', 'e-miss-count'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', _autoCalcRatesEdit);
    });

    // 保存ボタン
    document.getElementById('edit-save-btn')?.addEventListener('click', async () => {
      const rowIndex = parseInt(document.getElementById('e-row-index').value, 10);
      const record   = _collectFormData('e-');
      const btn      = document.getElementById('edit-save-btn');
      btn.disabled   = true;
      btn.textContent = '更新中...';
      try {
        await GasClient.updateRecord(rowIndex, record);
        Toast.show('記録を更新しました！', 'success');
        _closeModal('edit-modal');
        _onRefresh?.();
      } catch (err) {
        Toast.show(`更新エラー: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '更新';
      }
    });
  };

  /** 指定レコードで編集モーダルを開く */
  const openEditModal = (record) => {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    set('e-row-index',     record.rowIndex);
    set('e-date',          record.date);
    set('e-input-type',    record.inputType);
    set('e-time',          record.timeMinutes);
    set('e-score',         record.score);
    set('e-char-count',    record.charCount);
    set('e-correct-count', record.correctCount);
    set('e-miss-count',    record.missCount);
    set('e-correct-rate',  record.correctRate);
    set('e-miss-rate',     record.missRate);
    set('e-memo',          record.memo);
    _openModal('edit-modal');
  };

  /** 削除確認モーダルを開く */
  const openDeleteModal = (record) => {
    document.getElementById('delete-row-index').value = record.rowIndex;
    document.getElementById('delete-record-info').textContent =
      `${record.date}｜得点 ${record.score}点`;
    _openModal('delete-modal');
  };

  /* =====================================================
     履歴テーブル
     ===================================================== */

  /**
   * テーブルを描画する
   * @param {Array}   records      全レコード（日付降順で表示）
   * @param {boolean} isRecordMode 記録モード時は操作列を表示
   */
  const renderTable = (records, isRecordMode) => {
    const tbody       = document.getElementById('history-tbody');
    const actionHeader = document.getElementById('table-action-header');
    if (!tbody) return;

    if (isRecordMode) actionHeader?.classList.remove('hidden');

    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

    if (!sorted.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-cell">データがありません</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map(r => {
      const actionTd = isRecordMode
        ? `<td>
             <button class="btn-edit" data-row="${r.rowIndex}">編集</button>
             <button class="btn-del"  data-row="${r.rowIndex}">削除</button>
           </td>`
        : '';
      return `<tr>
        <td>${r.date ?? ''}</td>
        <td>${r.inputType ?? ''}</td>
        <td>${r.timeMinutes ?? ''}分</td>
        <td class="td-score">${(r.score ?? 0).toLocaleString()}</td>
        <td>${r.charCount ?? ''}</td>
        <td>${r.correctCount ?? ''}</td>
        <td>${r.missCount ?? ''}</td>
        <td>${r.correctRate != null ? r.correctRate.toFixed(3) + '%' : ''}</td>
        <td>${r.missRate    != null ? r.missRate.toFixed(3)    + '%' : ''}</td>
        <td>${r.memo ?? ''}</td>
        ${actionTd}
      </tr>`;
    }).join('');

    // 編集・削除ボタンのイベント
    if (isRecordMode) {
      tbody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = sorted.find(r => r.rowIndex === parseInt(btn.dataset.row, 10));
          if (row) openEditModal(row);
        });
      });
      tbody.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = sorted.find(r => r.rowIndex === parseInt(btn.dataset.row, 10));
          if (row) openDeleteModal(row);
        });
      });
    }
  };

  /* =====================================================
     CSV エクスポート
     ===================================================== */
  const initCsvExport = (getRecords) => {
    document.getElementById('csv-export-btn')?.addEventListener('click', () => {
      const records = getRecords();
      const header = ['日付', '入力方式', '制限時間(分)', '得点', '入力文字数',
                       '正タイプ数', '誤タイプ数', '正タイプ率(%)', '誤タイプ率(%)', 'メモ'];
      const rows = records.map(r => [
        r.date, r.inputType, r.timeMinutes, r.score, r.charCount,
        r.correctCount, r.missCount, r.correctRate, r.missRate, r.memo ?? ''
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

      const csv  = [header.join(','), ...rows].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `typing_records_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  /* =====================================================
     INPUT_TYPES セレクト初期化
     ===================================================== */
  const initSelectOptions = () => {
    ['f-input-type', 'e-input-type'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = CONFIG.INPUT_TYPES.map(t =>
        `<option value="${t}">${t}</option>`
      ).join('');
    });
  };

  /* =====================================================
     モーダル共通
     ===================================================== */
  const _openModal  = (id) => document.getElementById(id)?.classList.remove('hidden');
  const _closeModal = (id) => document.getElementById(id)?.classList.add('hidden');

  const _initModalClose = () => {
    document.addEventListener('click', (e) => {
      // data-modal 属性を持つ閉じるボタン
      const btn = e.target.closest('[data-modal]');
      if (btn) {
        _closeModal(btn.dataset.modal);
        return;
      }
      // オーバーレイ自体をクリックで閉じる
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
      }
    });
  };

  const openRecordModal = () => _openModal('record-modal');

  return {
    init,
    renderTable,
    initCsvExport,
    initSelectOptions,
    openRecordModal,
  };
})();

/* =====================================================
   Toast 通知ユーティリティ
   ===================================================== */
const Toast = (() => {
  const show = (message, type = 'info', duration = 3000) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };
  return { show };
})();
