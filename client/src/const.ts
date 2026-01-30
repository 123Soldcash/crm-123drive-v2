export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// When OAuth is not configured (empty VITE_OAUTH_PORTAL_URL), returns same-origin path to avoid Invalid URL.
export const getLoginUrl = () => {
  const oauthPortalUrl =
    import.meta.env.VITE_OAUTH_PORTAL_URL?.trim() || "";
  const appId = import.meta.env.VITE_APP_ID ?? "";

  if (!oauthPortalUrl) {
    return `${window.location.origin}/`;
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL("/app-auth", oauthPortalUrl.replace(/\/$/, ""));
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
