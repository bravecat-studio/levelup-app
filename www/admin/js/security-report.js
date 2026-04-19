// ─── Security Report Module (보안 리포트) ───
import { functions, httpsCallable } from "./firebase-init.js";
import { tlog, tok, terror, twarn } from "./log-panel.js";

const getSecurityAlerts = httpsCallable(functions, "getSecurityAlerts");

const ALERT_META = {
    points_spike:        { label: "포인트 급증",           color: "#ff9800" },
    repeat_points_spike: { label: "반복 포인트 급증",      color: "#ff5252" },
    stats_decrease:      { label: "스탯 감소 (조작 의심)", color: "#ff5252" },
    admin_claim_set:     { label: "어드민 클레임 부여",    color: "#00e5ff" },
    brute_force:         { label: "브루트포스 의심",        color: "#ff5252" },
    dormant_admin:       { label: "휴면 어드민",            color: "#ffc107" },
};

function alertMeta(type) {
    return ALERT_META[type] || { label: type, color: "#888", badgeClass: "sr-badge-info" };
}

let _container = null;
let _alerts = [];
let _filterType = "";
let _filterDays = 30;

export function initSecurityReport(containerId) {
    _container = document.getElementById(containerId);
    render();
}

function render() {
    if (!_container) return;
    _container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h2>보안 리포트</h2>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <select id="sr-filter-days" style="width:auto; padding:6px 10px; font-size:0.8rem;">
                        <option value="7">최근 7일</option>
                        <option value="30" selected>최근 30일</option>
                        <option value="60">최근 60일</option>
                        <option value="90">최근 90일</option>
                    </select>
                    <select id="sr-filter-type" style="width:auto; padding:6px 10px; font-size:0.8rem;">
                        <option value="">전체 유형</option>
                        <option value="points_spike">포인트 급증</option>
                        <option value="repeat_points_spike">반복 포인트 급증</option>
                        <option value="stats_decrease">스탯 감소 (조작 의심)</option>
                        <option value="admin_claim_set">어드민 클레임 부여</option>
                        <option value="brute_force">브루트포스 의심</option>
                        <option value="dormant_admin">휴면 어드민</option>
                    </select>
                    <button class="btn btn-outline btn-sm" id="sr-btn-load">조회</button>
                </div>
            </div>
            <div id="sr-summary"></div>
        </div>
        <div id="sr-alerts-area"></div>
    `;

    document.getElementById("sr-btn-load").addEventListener("click", loadAlerts);
    document.getElementById("sr-filter-days").addEventListener("change", e => { _filterDays = parseInt(e.target.value, 10); });
    document.getElementById("sr-filter-type").addEventListener("change", e => { _filterType = e.target.value; });
}

export async function loadSecurityReport() {
    await loadAlerts();
}

async function loadAlerts() {
    const summaryEl = document.getElementById("sr-summary");
    const alertsEl = document.getElementById("sr-alerts-area");
    if (!summaryEl || !alertsEl) return;

    summaryEl.innerHTML = '<p class="text-sub text-sm">로딩 중...</p>';
    alertsEl.innerHTML = "";
    tlog("SecReport", `보안 알림 조회 중 (최근 ${_filterDays}일)...`);

    try {
        const result = await getSecurityAlerts({
            days: _filterDays,
            type: _filterType || null,
            pageSize: 100,
        });
        _alerts = result.data?.alerts || [];
        const byType = result.data?.byType || {};

        tok("SecReport", `${_alerts.length}건 조회 완료`);
        renderSummary(summaryEl, byType);
        renderAlerts(alertsEl);
    } catch (e) {
        terror("SecReport", "보안 알림 조회 실패: " + e.message);
        summaryEl.innerHTML = `<p class="text-error text-sm">오류: ${e.message}</p>`;
    }
}

function renderSummary(el, byType) {
    const total = Object.values(byType).reduce((s, v) => s + v, 0);

    if (total === 0) {
        el.innerHTML = '<p class="text-sub text-sm">해당 기간에 보안 알림이 없습니다.</p>';
        return;
    }

    const cards = Object.entries(ALERT_META).map(([type, meta]) => {
        const count = byType[type] || 0;
        return `
            <div class="stat-card" style="cursor:pointer;" onclick="window._srFilterType('${type}')">
                <div class="stat-value" style="font-size:1.4rem; color:${meta.color};">${count}</div>
                <div class="stat-label">${meta.label}</div>
            </div>
        `;
    }).join("");

    // 타입별 바 차트
    const barItems = Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => {
            const meta = alertMeta(type);
            const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
            return `
                <div class="ua-bar-row">
                    <span class="ua-bar-label" style="color:${meta.color};">${meta.label}</span>
                    <div class="ua-bar-track">
                        <div class="ua-bar-fill" style="width:${pct}%; background:${meta.color};"></div>
                    </div>
                    <span class="ua-bar-value">${count}건</span>
                </div>
            `;
        }).join("");

    el.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
            <span class="text-sub text-sm">총</span>
            <span style="font-size:1.5rem; font-weight:700; color:var(--accent);">${total}</span>
            <span class="text-sub text-sm">건</span>
        </div>
        <div class="stats-grid" style="margin-bottom:16px;">${cards}</div>
        <div class="ua-chart-box" style="margin-bottom:0;">
            <h3 class="text-sm" style="color:var(--accent); margin-bottom:10px;">유형별 분포</h3>
            ${barItems}
        </div>
    `;
}

function renderAlerts(el) {
    if (_alerts.length === 0) {
        el.innerHTML = '<div class="card"><p class="text-sub text-sm">알림 없음</p></div>';
        return;
    }

    const rows = _alerts.map(a => {
        const meta = alertMeta(a.type);
        const dt = a.detectedAt ? new Date(a.detectedAt).toLocaleString("ko-KR") : "—";
        const badge = `<span class="badge" style="background:${meta.color}20; color:${meta.color}; border:1px solid ${meta.color}40;">${meta.label}</span>`;
        const source = a.source === "scheduler"
            ? '<span class="badge badge-info" style="font-size:10px;">스케줄러</span>'
            : '<span class="badge badge-info" style="font-size:10px;">실시간</span>';
        const details = renderAlertDetails(a);

        return `
            <tr>
                <td>${badge} ${source}</td>
                <td class="text-sm">${escHtml(a.userId || a.targetEmail || "—")}</td>
                <td class="text-sm">${details}</td>
                <td class="text-sub text-sm" style="white-space:nowrap;">${dt}</td>
            </tr>
        `;
    }).join("");

    el.innerHTML = `
        <div class="card">
            <h2>알림 목록 <span class="text-sub text-sm">(${_alerts.length}건)</span></h2>
            <table>
                <thead><tr>
                    <th>유형</th>
                    <th>대상</th>
                    <th>상세</th>
                    <th>탐지 시각</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderAlertDetails(a) {
    switch (a.type) {
        case "points_spike":
            return `+${(a.delta || 0).toLocaleString()}pt (${(a.pointsBefore || 0).toLocaleString()} → ${(a.pointsAfter || 0).toLocaleString()})`;
        case "repeat_points_spike":
            return `${a.spikeCount}회 반복, 최대 +${(a.maxDelta || 0).toLocaleString()}pt (24h)`;
        case "stats_decrease":
            return `${escHtml(a.field || "—")}: ${a.before} → ${a.after}`;
        case "admin_claim_set":
            return `${escHtml(a.claimType || "—")} 부여 by ${escHtml(a.grantedBy || "—")}`;
        case "brute_force":
            return `${a.authErrorCount}회 인증 실패 (1h 내)`;
        case "dormant_admin":
            return `${escHtml(a.claimType || "—")} — ${a.dormantDays != null ? `${a.dormantDays}일 미접속` : "접속 이력 없음"}`;
        default:
            return "—";
    }
}

function escHtml(str) {
    if (str == null) return "—";
    const d = document.createElement("div");
    d.textContent = String(str);
    return d.innerHTML;
}

// 타입 필터 단축 (stat-card 클릭)
window._srFilterType = (type) => {
    const sel = document.getElementById("sr-filter-type");
    if (sel) {
        sel.value = type;
        _filterType = type;
        loadAlerts();
    }
};
