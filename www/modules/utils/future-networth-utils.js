export function parseFutureNetworthNumber(value, fallback = 0) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

export function normalizeFutureNetworthConfig(cfg = {}) {
    const r = parseFutureNetworthNumber(cfg.r, 2.5);
    const g = parseFutureNetworthNumber(cfg.g, 3.0);
    const roi = parseFutureNetworthNumber(cfg.roi, r);
    const e = parseFutureNetworthNumber(cfg.e, 70);
    return {
        ...cfg,
        r,
        g,
        roi,
        e,
    };
}

function calcGrowthSeries(baseAmount, years, growthRatePct) {
    if (!baseAmount || !years || years <= 0) return 0;
    const growthRate = growthRatePct / 100;
    return growthRate === 0
        ? baseAmount * years
        : baseAmount * ((Math.pow(1 + growthRate, years) - 1) / growthRate);
}

export function calcFutureNetworth(cfg = {}) {
    const normalized = normalizeFutureNetworthConfig(cfg);
    const {
        n, W_0, assets, liabilities, r, g, e, inflateS,
        s_car, s_housing, s_wedding, s_edu, s_medical, s_travel,
    } = normalized;

    if (!n || !W_0 || n <= 0 || W_0 <= 0) return null;

    const A_0 = (assets || 0) - (liabilities || 0);
    const rVal = r / 100;
    const eVal = e / 100;

    const S_non_raw = (s_car || 0) + (s_housing || 0) + (s_wedding || 0)
        + (s_edu || 0) + (s_medical || 0) + (s_travel || 0);
    const inflFactor = (inflateS && rVal > 0) ? Math.pow(1 + rVal, n) : 1;
    const S_non = S_non_raw * inflFactor;

    const W_total = calcGrowthSeries(W_0, n, g);
    const E_fixed = W_total * eVal;
    const NW_n = A_0 + (W_total - E_fixed) - S_non;
    const M_save = S_non > 0 ? S_non / (n * 12) : 0;
    const M_avail = W_total * (1 - eVal) / (n * 12);

    return {
        NW_n,
        M_save,
        M_avail,
        W_total,
        E_fixed,
        S_non,
        S_non_raw,
        inflFactor,
        A_0,
        feasible: M_avail >= M_save,
        params: { g: normalized.g, r: normalized.r, roi: normalized.roi, e: normalized.e },
    };
}

export function calcSavingsRareTitleRate(cfg = {}) {
    const normalized = normalizeFutureNetworthConfig(cfg);
    if (!normalized.W_0 || normalized.W_0 <= 0) return null;

    const result = calcFutureNetworth(normalized);
    if (!result) return null;

    const monthlyIncome = normalized.W_0 / 12;
    if (monthlyIncome <= 0) return null;

    return {
        rate: (result.M_avail / monthlyIncome) * 100,
        M_avail: result.M_avail,
        W_total: result.W_total,
        params: result.params,
    };
}
