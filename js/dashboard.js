/**
 * ダッシュボード描画モジュール
 * サマリーカード・Chart.js グラフを管理する
 */
const Dashboard = (() => {
  // Chart インスタンスを保持（期間切替時に破棄して再描画）
  const _charts = {};

  // 共通グラフオプション
  const _commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#333',
        titleFont: { family: "'Noto Sans JP', sans-serif", size: 12 },
        bodyFont:  { family: "'Noto Sans JP', sans-serif", size: 12 },
        padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { font: { family: "'Noto Sans JP', sans-serif", size: 11 }, color: '#888' },
        grid: { color: '#f0f0f0' },
      },
      y: {
        ticks: { font: { family: "'Noto Sans JP', sans-serif", size: 11 }, color: '#888' },
        grid: { color: '#f0f0f0' },
      },
    },
  };

  /* =====================================================
     サマリーカード
     ===================================================== */

  /**
   * サマリーカードを描画する
   * @param {Array} records  全レコード
   */
  const renderSummary = (records) => {
    const grid = document.getElementById('summary-grid');
    if (!grid) return;

    // 過去最高得点とその取得日
    const bestScore = records.length ? Math.max(...records.map(r => r.score)) : null;
    const bestRecord = bestScore !== null
      ? records.find(r => r.score === bestScore)
      : null;

    // 直近7日の平均正タイプ率・平均文字数
    const avg7dCorrectRate = _calc7dAvgField(records, 'correctRate');
    const avg7dCharCount   = _calc7dAvgField(records, 'charCount');

    const cards = [
      {
        label: '過去最高得点',
        value: bestScore !== null ? bestScore.toLocaleString() : '--',
        unit: '点',
        valueRight: bestRecord ? bestRecord.date : '',
        sub: '',
        targetLabel: `目標: ${CONFIG.TARGETS.score.toLocaleString()}点`,
        target: CONFIG.TARGETS.score,
        current: bestScore,
        higher: true,
      },
      {
        label: '平均正タイプ率（直近7日）',
        value: avg7dCorrectRate !== null ? avg7dCorrectRate.toFixed(2) : '--',
        unit: '%',
        valueRight: '',
        sub: '',
        targetLabel: `目標: ${CONFIG.TARGETS.correctRate}%`,
        target: CONFIG.TARGETS.correctRate,
        current: avg7dCorrectRate,
        higher: true,
      },
      {
        label: '平均文字数（直近7日）',
        value: avg7dCharCount !== null ? Math.round(avg7dCharCount).toLocaleString() : '--',
        unit: '字',
        valueRight: '',
        sub: '',
        targetLabel: `目標: ${CONFIG.TARGETS.charCount.toLocaleString()}字`,
        target: CONFIG.TARGETS.charCount,
        current: avg7dCharCount,
        higher: true,
      },
    ];

    grid.innerHTML = cards.map(c => _buildCard(c)).join('');
  };

  const _buildCard = ({ label, value, unit, valueRight = '', sub, targetLabel, target, current, higher }) => {
    let progressHtml = '';
    if (target !== null && current !== null) {
      const pct = higher
        ? Math.min(100, Math.round((current / target) * 100))
        : Math.min(100, Math.round(((target * 2 - current) / target) * 100));
      const achieved = higher ? current >= target : current <= target;
      progressHtml = `
        <div class="progress-wrap">
          <div class="progress-bar">
            <div class="progress-fill ${achieved ? 'achieved' : ''}"
                 style="width:${Math.max(0, pct)}%"></div>
          </div>
          <span class="progress-label" style="color:${achieved ? 'var(--success)' : 'var(--primary)'}">
            ${pct}%
          </span>
        </div>`;
    }

    const targetHtml = targetLabel
      ? `<p style="font-size:10px;color:var(--text-sub);margin-top:4px;">${targetLabel}</p>`
      : '';

    const valueClass = typeof value === 'number' && String(value).length > 4 ? ' card-value--sm' : '';
    const valueRightHtml = valueRight
      ? `<span style="font-size:11px;color:var(--text-sub);font-weight:400;margin-left:8px;align-self:flex-end;padding-bottom:6px;">${valueRight}</span>`
      : '';

    return `
      <div class="summary-card">
        <p class="card-label">${label}</p>
        <div style="display:flex;align-items:baseline;gap:0;">
          <p class="card-value${valueClass}" style="margin:0;">${value}<span class="card-unit">${unit}</span></p>
          ${valueRightHtml}
        </div>
        <p class="card-sub">${sub}</p>
        ${targetHtml}
        ${progressHtml}
      </div>`;
  };

  /** 直近 7 日間の指定フィールドの平均値 */
  const _calc7dAvgField = (records, field) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recent = records.filter(r => new Date(r.date) >= cutoff && r[field] != null);
    if (!recent.length) return null;
    return recent.reduce((s, r) => s + r[field], 0) / recent.length;
  };

  /* =====================================================
     グラフ共通ユーティリティ
     ===================================================== */

  /** 期間でレコードを絞り込む */
  const filterByPeriod = (records, period) => {
    if (period === 'all') return records;
    const days = period === '30d' ? 30 : 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return records.filter(r => new Date(r.date) >= cutoff);
  };

  /** Chart インスタンスを安全に破棄して再生成 */
  const _destroyChart = (key) => {
    if (_charts[key]) {
      _charts[key].destroy();
      delete _charts[key];
    }
  };

  /** 横軸ラベル（日付文字列 → MM/DD） */
  const _toLabel = (dateStr) => {
    const [, m, d] = dateStr.split('-');
    return `${m}/${d}`;
  };

  /* =====================================================
     各グラフ
     ===================================================== */

  /** 得点推移（折れ線） */
  const renderScoreChart = (records, period) => {
    _destroyChart('score');
    const data = filterByPeriod(records, period).sort((a, b) => a.date.localeCompare(b.date));
    const ctx = document.getElementById('chart-score');
    if (!ctx) return;

    _charts.score = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(r => _toLabel(r.date)),
        datasets: [
          {
            label: '得点',
            data: data.map(r => r.score),
            borderColor: '#4A90C2',
            backgroundColor: 'rgba(74,144,194,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#4A90C2',
            pointRadius: 4,
            tension: 0.3,
            fill: true,
          },
          // 目標値ライン
          {
            label: `目標 ${CONFIG.TARGETS.score.toLocaleString()}点`,
            data: data.map(() => CONFIG.TARGETS.score),
            borderColor: '#FF8C00',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        ..._commonOptions,
        plugins: {
          ..._commonOptions.plugins,
          legend: { display: true, labels: { font: { family: "'Noto Sans JP', sans-serif", size: 11 } } },
        },
        scales: {
          ..._commonOptions.scales,
          y: {
            ..._commonOptions.scales.y,
            // 目標値が必ず表示範囲内に入るよう suggestedMin を設定
            suggestedMin: CONFIG.TARGETS.score * 0.97,
          },
        },
      },
    });
  };

  /** 正タイプ率推移（折れ線・目標 99% 点線） */
  const renderCorrectRateChart = (records, period) => {
    _destroyChart('correctRate');
    const data = filterByPeriod(records, period).sort((a, b) => a.date.localeCompare(b.date));
    const ctx = document.getElementById('chart-correct-rate');
    if (!ctx) return;

    _charts.correctRate = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(r => _toLabel(r.date)),
        datasets: [
          {
            label: '正タイプ率',
            data: data.map(r => r.correctRate),
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76,175,80,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#4CAF50',
            pointRadius: 4,
            tension: 0.3,
            fill: true,
          },
          {
            label: `目標 ${CONFIG.TARGETS.correctRate}%`,
            data: data.map(() => CONFIG.TARGETS.correctRate),
            borderColor: '#FF8C00',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        ..._commonOptions,
        plugins: {
          ..._commonOptions.plugins,
          legend: { display: true, labels: { font: { family: "'Noto Sans JP', sans-serif", size: 11 } } },
        },
        scales: {
          ..._commonOptions.scales,
          y: {
            ..._commonOptions.scales.y,
            // 目標値・データ最小値の両方が収まるよう min を算出
            min: Math.max(0, Math.min(
              CONFIG.TARGETS.correctRate,
              data.length ? Math.min(...data.map(r => r.correctRate || 100)) : 100
            ) - 3),
            max: 100,
            ticks: {
              ..._commonOptions.scales.y.ticks,
              callback: v => `${v}%`,
            },
          },
        },
      },
    });
  };

  /** 入力文字数推移（棒グラフ・目標 500 点線） */
  const renderCharCountChart = (records, period) => {
    _destroyChart('charCount');
    const data = filterByPeriod(records, period).sort((a, b) => a.date.localeCompare(b.date));
    const ctx = document.getElementById('chart-char-count');
    if (!ctx) return;

    _charts.charCount = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(r => _toLabel(r.date)),
        datasets: [
          {
            label: '入力文字数',
            data: data.map(r => r.charCount),
            backgroundColor: 'rgba(74,144,194,0.7)',
            borderColor: '#4A90C2',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: `目標 ${CONFIG.TARGETS.charCount}字`,
            data: data.map(() => CONFIG.TARGETS.charCount),
            type: 'line',
            borderColor: '#FF8C00',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        ..._commonOptions,
        plugins: {
          ..._commonOptions.plugins,
          legend: { display: true, labels: { font: { family: "'Noto Sans JP', sans-serif", size: 11 } } },
        },
        scales: {
          ..._commonOptions.scales,
          y: {
            ..._commonOptions.scales.y,
            // 目標値が必ず表示範囲内に入るよう suggestedMin を設定
            suggestedMin: CONFIG.TARGETS.charCount * 0.97,
          },
        },
      },
    });
  };

  /** 誤タイプ数推移（折れ線・目標 5 点線） */
  const renderMissCountChart = (records, period) => {
    _destroyChart('missCount');
    const data = filterByPeriod(records, period).sort((a, b) => a.date.localeCompare(b.date));
    const ctx = document.getElementById('chart-miss-count');
    if (!ctx) return;

    _charts.missCount = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(r => _toLabel(r.date)),
        datasets: [
          {
            label: '誤タイプ数',
            data: data.map(r => r.missCount),
            borderColor: '#F44336',
            backgroundColor: 'rgba(244,67,54,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#F44336',
            pointRadius: 4,
            tension: 0.3,
            fill: true,
          },
          {
            label: `目標 ${CONFIG.TARGETS.missCount}回以下`,
            data: data.map(() => CONFIG.TARGETS.missCount),
            borderColor: '#FF8C00',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        ..._commonOptions,
        plugins: {
          ..._commonOptions.plugins,
          legend: { display: true, labels: { font: { family: "'Noto Sans JP', sans-serif", size: 11 } } },
        },
        scales: {
          ..._commonOptions.scales,
          y: {
            ..._commonOptions.scales.y,
            min: 0,
            // データが全部目標以下でも目標ラインが見切れないよう suggestedMax を設定
            suggestedMax: CONFIG.TARGETS.missCount * 1.3,
          },
        },
      },
    });
  };

  /**
   * 全グラフを一括描画する
   * @param {Array}  records  全レコード
   * @param {string} period   'all' | '30d' | '7d'
   */
  const renderAll = (records, period = 'all') => {
    renderSummary(records);
    renderScoreChart(records, period);
    renderCorrectRateChart(records, period);
    renderCharCountChart(records, period);
    renderMissCountChart(records, period);
  };

  /**
   * 期間変更時にグラフのみ再描画
   */
  const reRenderCharts = (records, period) => {
    renderScoreChart(records, period);
    renderCorrectRateChart(records, period);
    renderCharCountChart(records, period);
    renderMissCountChart(records, period);
  };

  return { renderAll, reRenderCharts, filterByPeriod };
})();
