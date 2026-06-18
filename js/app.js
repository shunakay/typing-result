/**
 * アプリケーションのエントリーポイント
 * 初期化・記録モード判定・全体の制御を行う
 */
(() => {
  /* =====================================================
     状態
     ===================================================== */
  let _records    = [];    // 全レコード
  let _period     = 'all'; // グラフ期間
  let _isRecordMode = false;

  /* =====================================================
     起動
     ===================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    _isRecordMode = !!localStorage.getItem('gasWriteUrl');
    _applyRecordModeUI();

    Recorder.initSelectOptions();
    Recorder.init(_isRecordMode, _refresh);
    Recorder.initCsvExport(() => _records);

    _initPeriodTabs();

    await _loadData();
  });

  /* =====================================================
     記録モード UI
     ===================================================== */
  const _applyRecordModeUI = () => {
    const badge   = document.getElementById('record-mode-badge');
    const section = document.getElementById('record-section');
    if (_isRecordMode) {
      badge?.classList.remove('hidden');
      section?.classList.remove('hidden');
    }
  };

  /* =====================================================
     データ読み込み
     ===================================================== */
  const _loadData = async () => {
    const overlay = document.getElementById('loading-overlay');
    overlay?.classList.remove('hidden');

    try {
      const raw = await GasClient.fetchRecords();
      // rowIndex が付いていない場合は付与（サンプルデータ対策）
      _records = raw.map((r, i) => ({
        ...r,
        // 数値型保証
        score:        _toNum(r.score),
        charCount:    _toNum(r.charCount),
        correctCount: _toNum(r.correctCount),
        missCount:    _toNum(r.missCount),
        correctRate:  _toNum(r.correctRate),
        missRate:     _toNum(r.missRate),
        timeMinutes:  _toNum(r.timeMinutes),
        rowIndex:     r.rowIndex ?? (i + 2),
      }));
    } catch (err) {
      console.error('[App] データ取得エラー:', err);
      Toast.show(`データ取得エラー: ${err.message}`, 'error');
      _records = [];
    } finally {
      overlay?.classList.add('hidden');
    }

    _renderAll();
  };

  /** データ再取得（追加・更新・削除後に呼ばれる） */
  const _refresh = async () => {
    await _loadData();
  };

  /* =====================================================
     描画
     ===================================================== */
  const _renderAll = () => {
    Dashboard.renderAll(_records, _period);
    Recorder.renderTable(_records, _isRecordMode);
  };

  /* =====================================================
     期間タブ
     ===================================================== */
  const _initPeriodTabs = () => {
    document.getElementById('period-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.period-tab');
      if (!tab) return;
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _period = tab.dataset.period;
      Dashboard.reRenderCharts(_records, _period);
    });
  };

  /* =====================================================
     ユーティリティ
     ===================================================== */
  const _toNum = (v) => {
    const n = Number(v);
    return isNaN(n) ? null : n;
  };
})();
