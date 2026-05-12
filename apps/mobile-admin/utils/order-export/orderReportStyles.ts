export const orderReportStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  :root {
    --primary: #4A90D9;
    --primary-dark: #357ABD;
    --success: #10B981;
    --success-bg: rgba(16, 185, 129, 0.1);
    --warning: #F59E0B;
    --warning-bg: rgba(245, 158, 11, 0.1);
    --danger: #EF4444;
    --danger-bg: rgba(239, 68, 68, 0.1);
    --purple: #8B5CF6;
    --purple-bg: rgba(139, 92, 246, 0.1);
    --text-main: #0F172A;
    --text-muted: #64748B;
    --bg-light: #F8FAFC;
    --border: #E2E8F0;
  }

  * { box-sizing: border-box; }
  body {
    background: #fff;
    color: var(--text-main);
    font-family: 'Plus Jakarta Sans', sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 40px;
  }
  .header, .insight-header, .insight-content, .footer, .list-item, .fin-row, .table-title {
    align-items: center;
    display: flex;
    justify-content: space-between;
  }
  .header {
    border-bottom: 2px solid var(--border);
    margin-bottom: 40px;
    padding-bottom: 24px;
  }
  .brand { align-items: center; display: flex; gap: 16px; }
  .logo-box {
    align-items: center;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
    color: white;
    display: flex;
    font-size: 28px;
    font-weight: 800;
    height: 64px;
    justify-content: center;
    overflow: hidden;
    width: 64px;
  }
  .logo-img { height: 100%; object-fit: cover; width: 100%; }
  .brand-info { display: flex; flex-direction: column; }
  .brand-name { color: var(--text-main); font-size: 22px; font-weight: 800; }
  .brand-slug { color: var(--text-muted); font-size: 13px; font-weight: 500; }
  .report-meta { text-align: right; }
  .report-type {
    color: var(--primary);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 2px;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .report-date { color: var(--text-main); font-size: 32px; font-weight: 800; margin: 0; }
  .report-period {
    background: var(--bg-light);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--text-muted);
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    margin-top: 10px;
    padding: 6px 14px;
  }
  .section-label {
    align-items: center;
    color: var(--text-muted);
    display: flex;
    font-size: 13px;
    font-weight: 800;
    gap: 12px;
    letter-spacing: 1.5px;
    margin-bottom: 20px;
    text-transform: uppercase;
  }
  .section-label::after {
    background: linear-gradient(to right, var(--border), transparent);
    content: "";
    flex: 1;
    height: 1px;
  }
  .hero-grid, .status-grid, .metrics-row, .insights-grid, .split-grid {
    display: grid;
    gap: 24px;
    margin-bottom: 32px;
  }
  .hero-grid, .insights-grid, .split-grid { grid-template-columns: 1fr 1fr; }
  .status-grid, .metrics-row { gap: 16px; grid-template-columns: repeat(4, 1fr); }
  .hero-card, .insight-card, .metric-box, .status-card {
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 24px;
  }
  .hero-card {
    border: 0;
    color: white;
    overflow: hidden;
    padding: 28px 32px;
    position: relative;
  }
  .hero-card::before {
    background: rgba(255,255,255,0.1);
    border-radius: 50%;
    content: "";
    height: 200px;
    position: absolute;
    right: -30%;
    top: -50%;
    width: 200px;
  }
  .hero-card .label { font-size: 14px; font-weight: 600; margin-bottom: 8px; opacity: 0.9; }
  .hero-card .value { font-size: 38px; font-weight: 800; letter-spacing: -1px; margin-bottom: 4px; }
  .hero-card .sub { font-size: 13px; font-weight: 500; opacity: 0.85; }
  .hero-trend {
    align-items: center;
    background: rgba(255,255,255,0.2);
    border-radius: 20px;
    display: inline-flex;
    font-size: 11px;
    font-weight: 700;
    gap: 4px;
    margin-top: 10px;
    padding: 4px 10px;
  }
  .status-card { text-align: center; }
  .status-card.delivered { background: var(--success-bg); border-color: var(--success); }
  .status-card.processing { background: var(--purple-bg); border-color: var(--purple); }
  .status-card.pending { background: var(--warning-bg); border-color: var(--warning); }
  .status-icon { font-size: 24px; margin-bottom: 8px; }
  .status-count { color: var(--text-main); font-size: 28px; font-weight: 800; }
  .status-label { color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .metric-box { background: var(--bg-light); border-radius: 16px; padding: 20px; }
  .metric-label { color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase; }
  .metric-value { color: var(--text-main); font-size: 20px; font-weight: 800; }
  .insight-card { background: var(--bg-light); border-radius: 20px; }
  .insight-title, .board-title, .table-title { color: var(--text-main); font-weight: 800; }
  .insight-title { font-size: 16px; }
  .insight-badge {
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 4px 10px;
    text-transform: uppercase;
  }
  .badge-success { background: var(--success-bg); color: var(--success); }
  .insight-main { color: var(--text-main); font-size: 24px; font-weight: 800; }
  .insight-sub { color: var(--text-muted); font-size: 12px; font-weight: 500; }
  .insight-stat { text-align: right; }
  .insight-stat-label { color: var(--text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .insight-stat-value { color: var(--success); font-size: 16px; font-weight: 800; }
  .board-title {
    align-items: center;
    display: flex;
    font-size: 16px;
    gap: 8px;
    margin-bottom: 16px;
  }
  .board-title::before {
    background: var(--primary);
    border-radius: 2px;
    content: "";
    height: 20px;
    width: 4px;
  }
  .list-item {
    background: var(--bg-light);
    border: 1px solid var(--border);
    border-radius: 14px;
    margin-bottom: 10px;
    padding: 14px 18px;
  }
  .item-info { display: flex; flex-direction: column; }
  .item-name { color: var(--text-main); font-size: 14px; font-weight: 700; text-transform: capitalize; }
  .item-count { color: var(--text-muted); font-size: 11px; font-weight: 500; }
  .item-val { color: var(--text-main); font-size: 15px; font-weight: 800; }
  .fin-board {
    background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
    border-radius: 24px;
    color: #fff;
    margin-bottom: 32px;
    overflow: hidden;
    padding: 32px;
    position: relative;
  }
  .fin-board::before {
    background: radial-gradient(circle, rgba(74, 144, 217, 0.15) 0%, transparent 70%);
    content: "";
    height: 300px;
    position: absolute;
    right: -100px;
    top: -100px;
    width: 300px;
  }
  .fin-title { display: flex; font-size: 16px; font-weight: 700; gap: 10px; margin-bottom: 24px; }
  .fin-title::before { content: "🏦"; }
  .fin-row { font-size: 15px; margin-bottom: 14px; opacity: 0.85; }
  .fin-row.total {
    border-top: 1px solid rgba(255,255,255,0.15);
    font-size: 22px;
    font-weight: 800;
    margin-top: 18px;
    opacity: 1;
    padding-top: 18px;
  }
  .fin-val.positive { color: var(--success); }
  .fin-val.negative { color: var(--danger); }
  .table-section { margin-bottom: 40px; }
  .table-title { font-size: 18px; margin-bottom: 16px; }
  .badge-count {
    background: var(--primary);
    border-radius: 20px;
    color: white;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 12px;
  }
  table { border-collapse: separate; border-spacing: 0 10px; width: 100%; }
  th {
    background: var(--bg-light);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 14px 20px;
    text-align: left;
    text-transform: uppercase;
  }
  th:first-child, td:first-child { border-radius: 12px 0 0 12px; }
  th:last-child, td:last-child { border-radius: 0 12px 12px 0; }
  td {
    background: var(--bg-light);
    border-bottom: 1px solid var(--border);
    border-top: 1px solid var(--border);
    color: var(--text-main);
    font-size: 13px;
    padding: 16px 20px;
  }
  td:first-child { border-left: 1px solid var(--border); }
  td:last-child { border-right: 1px solid var(--border); }
  .order-id { color: var(--primary); font-family: 'SF Mono', monospace; font-size: 12px; font-weight: 700; }
  .order-name { display: block; font-weight: 700; }
  .order-sub { color: var(--text-muted); font-size: 11px; }
  .status-pill {
    align-items: center;
    border-radius: 20px;
    display: inline-flex;
    font-size: 11px;
    font-weight: 700;
    gap: 6px;
    padding: 4px 12px;
    text-transform: uppercase;
  }
  .pill-paid { background: var(--success-bg); color: var(--success); }
  .pill-pending { background: var(--warning-bg); color: var(--warning); }
  .pill-refunded { background: var(--danger-bg); color: var(--danger); }
  .footer {
    border-top: 2px solid var(--border);
    color: var(--text-muted);
    font-size: 12px;
    margin-top: 48px;
    padding-top: 24px;
  }
  .footer-left { display: flex; flex-direction: column; gap: 4px; }
  .baci-tag {
    align-items: center;
    background: rgba(74, 144, 217, 0.1);
    border-radius: 20px;
    color: var(--primary);
    display: inline-flex;
    font-weight: 800;
    gap: 6px;
    padding: 6px 14px;
  }
`;
