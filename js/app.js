/**
 * アプリケーションのエントリーポイント
 * 初期化・記録モード判定・全体の制御を行う
 */
(() => {
  /* =====================================================
     状態
     ===================================================== */
  let _records      = [];      // 全レコード
  let _period       = 'all';  // グラフ期間
  let _isRecordMode = false;
  let _inputType    = CONFIG.INPUT_TYPES[0]; // 選択中の入力方式

  /* =====================================================
     起動
     ===================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    _isRecordMode = !!localStorage.getItem('gasWriteUrl');
    _applyRecordModeUI();

    _initSidebar();
    Recorder.initSelectOptions();
    Recorder.init(_isRecordMode, _refresh);
    Recorder.initCsvExport(() => _filteredRecords());

    _initPeriodTabs();

    await _loadData();
  });

  /* =====================================================
     サイドバー（入力方式フィルター）
     ===================================================== */
  const _initSidebar = () => {
    const nav = document.getElementById('sidebar');
    if (!nav) return;

    nav.innerHTML = CONFIG.INPUT_TYPES.map(type => `
      <button class="nav-item${type === _inputType ? ' active' : ''}" data-type="${type}">
        ${type}
      </button>
    `).join('');

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-item');
      if (!btn) return;
      _inputType = btn.dataset.type;
      nav.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
      _renderAll();
    });
  };

  const _filteredRecords = () => _records.filter(r => r.inputType === _inputType);

  /* =====================================================
     記録モード UI
     ===================================================== */
  const _applyRecordModeUI = () => {
    const badge = document.getElementById('record-mode-badge');
    if (_isRecordMode) {
      badge?.classList.remove('hidden');
      badge?.addEventListener('click', () => Recorder.openRecordModal());
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
    const filtered = _filteredRecords();
    Dashboard.renderAll(filtered, _period, _inputType);
    Recorder.renderTable(filtered, _isRecordMode);
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
      Dashboard.reRenderCharts(_filteredRecords(), _period, _inputType);
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
