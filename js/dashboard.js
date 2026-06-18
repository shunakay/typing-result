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
   * @param {Array} records  全レコード（日付昇順）
   */
  const renderSummary = (records) => {
    const grid = document.getElementById('summary-grid');
    if (!grid) return;

    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1] || null;

    const latestScore = latest?.score ?? null;
    const bestScore   = records.length ? Math.max(...records.map(r => r.score)) : null;
    const avg7d       = _calc7dAvg(records);
    const streak      = _calcStreak(records);

    const cards = [
      {
        label: '最新得点',
        value: latestScore !== null ? latestScore.toLocaleString() : '--',
        unit: '点',
        sub: latest ? latest.date : '',
        targetLabel: `目標: ${CONFIG.TARGETS.score.toLocaleString()}点`,
        target: CONFIG.TARGETS.score,
        current: latestScore,
        higher: true,
      },
      {
        label: '過去最高得点',
        value: bestScore !== null ? bestScore.toLocaleString() : '--',
        unit: '点',
        sub: '',
        targetLabel: `目標: ${CONFIG.TARGETS.score.toLocaleString()}点`,
        target: CONFIG.TARGETS.score,
        current: bestScore,
        higher: true,
      },
      {
        label: '直近7日平均',
        value: avg7d !== null ? Math.round(avg7d).toLocaleString() : '--',
        unit: '点',
        sub: '直近7日の記録から算出',
        targetLabel: `目標: ${CONFIG.TARGETS.score.toLocaleString()}点`,
        target: CONFIG.TARGETS.score,
        current: avg7d,
        higher: true,
      },
      {
        label: '継続記録',
        value: streak,
        unit: '日',
        sub: '連続で記録した日数',
        targetLabel: null,
        target: null,
        current: null,
      },
    ];

    grid.innerHTML = cards.map(c => _buildCard(c)).join('');
  };

  const _buildCard = ({ label, value, unit, sub, targetLabel, target, current, higher }) => {
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

    return `
      <div class="summary-card">
        <p class="card-label">${label}</p>
        <p class="card-value${typeof value === 'number' && String(value).length > 4 ? ' card-value--sm' : ''}">
          ${value}<span class="card-unit">${unit}</span>
        </p>
        <p class="card-sub">${sub}</p>
        ${targetHtml}
        ${progressHtml}
      </div>`;
  };

  /** 直近 7 日の平均得点 */
  const _calc7dAvg = (records) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recent = records.filter(r => new Date(r.date) >= cutoff);
    if (!recent.length) return null;
    return recent.reduce((s, r) => s + r.score, 0) / recent.length;
  };

  /** 連続記録日数（今日から遡って） */
  const _calcStreak = (records) => {
    if (!records.length) return 0;
    const dates = new Set(records.map(r => r.date));
    let streak = 0;
    const today = new Date();
    // 今日または昨日から開始
    let d = new Date(today);
    // 今日の記録がない場合は昨日から
    const todayStr = _dateStr(d);
    if (!dates.has(todayStr)) d.setDate(d.getDate() - 1);

    while (true) {
      const str = _dateStr(d);
      if (!dates.has(str)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  const _dateStr = (d) => d.toISOString().slice(0, 10);

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
            min: Math.max(0, Math.min(...data.map(r => r.correctRate || 100)) - 5),
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
          y: { ..._commonOptions.scales.y, min: 0 },
        },
      },
    });
  };

  /** 曜日別平均得点（レーダーチャート） */
  const renderWeekdayChart = (records) => {
    _destroyChart('weekday');
    const ctx = document.getElementById('chart-weekday');
    if (!ctx) return;

    const days = ['日', '月', '火', '水', '木', '金', '土'];
    // 曜日ごとの合計・件数
    const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    records.forEach(r => {
      const dow = new Date(r.date).getDay(); // 0=日 〜 6=土
      buckets[dow].sum += r.score;
      buckets[dow].count++;
    });
    const avgs = buckets.map(b => (b.count ? Math.round(b.sum / b.count) : 0));

    _charts.weekday = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: days,
        datasets: [
          {
            label: '曜日別平均得点',
            data: avgs,
            borderColor: '#4A90C2',
            backgroundColor: 'rgba(74,144,194,0.15)',
            pointBackgroundColor: '#4A90C2',
            pointRadius: 4,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw.toLocaleString()}点`,
            },
          },
        },
        scales: {
          r: {
            ticks: { display: false },
            pointLabels: { font: { family: "'Noto Sans JP', sans-serif", size: 13, weight: 'bold' } },
            grid: { color: '#e5e5e5' },
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
    renderWeekdayChart(records);  // レーダーは全期間固定
  };

  /**
   * 期間変更時にグラフのみ再描画（サマリー・レーダーは据え置き）
   */
  const reRenderCharts = (records, period) => {
    renderScoreChart(records, period);
    renderCorrectRateChart(records, period);
    renderCharCountChart(records, period);
    renderMissCountChart(records, period);
  };

  return { renderAll, reRenderCharts, filterByPeriod };
})();
