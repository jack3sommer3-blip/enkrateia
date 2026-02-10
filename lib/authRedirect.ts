export function getAuthRedirectUrl() {
  return process.env.NODE_ENV === "production"
    ? "https://enkrateia.app"
    : "http://localhost:3000";
}
