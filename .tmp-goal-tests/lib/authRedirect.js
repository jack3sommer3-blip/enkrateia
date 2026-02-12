"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthRedirectUrl = getAuthRedirectUrl;
function getAuthRedirectUrl() {
    return process.env.NODE_ENV === "production"
        ? "https://enkrateia.app"
        : "http://localhost:3000";
}
