"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampInt = clampInt;
exports.numFromText = numFromText;
exports.intFromText = intFromText;
exports.formatScore = formatScore;
exports.normalizeIntText = normalizeIntText;
exports.textFromUnknown = textFromUnknown;
exports.todayKey = todayKey;
exports.toDateKey = toDateKey;
exports.startOfDay = startOfDay;
exports.addDays = addDays;
exports.getWeekWindow = getWeekWindow;
exports.getWeekWindowFromKey = getWeekWindowFromKey;
function clampInt(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function numFromText(value) {
    if (value === undefined)
        return undefined;
    const t = value.trim();
    if (!t)
        return undefined;
    const n = Number(t);
    if (!Number.isFinite(n))
        return undefined;
    return n;
}
function intFromText(value) {
    const n = numFromText(value);
    if (n === undefined)
        return undefined;
    return Math.trunc(n);
}
function formatScore(n) {
    if (!Number.isFinite(n))
        return "0";
    const fixed = n.toFixed(1);
    return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}
function normalizeIntText(value, min, max) {
    const n = intFromText(value);
    if (n === undefined)
        return undefined;
    let v = n;
    if (min !== undefined)
        v = Math.max(min, v);
    if (max !== undefined)
        v = Math.min(max, v);
    return String(v);
}
function textFromUnknown(value) {
    if (value === null || value === undefined)
        return undefined;
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    if (typeof value === "string")
        return value;
    return undefined;
}
function todayKey() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function toDateKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function addDays(date, count) {
    const d = new Date(date);
    d.setDate(d.getDate() + count);
    return d;
}
function getWeekWindow(date) {
    const base = startOfDay(date);
    const day = base.getDay(); // 0 = Sunday
    const diffToMonday = (day + 6) % 7;
    const start = addDays(base, -diffToMonday);
    const end = addDays(start, 6);
    return {
        start,
        end,
        startKey: toDateKey(start),
        endKey: toDateKey(end),
    };
}
function getWeekWindowFromKey(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return getWeekWindow(date);
}
