import { LS_REDIRECTED_TO_LOGIN, LS_TOKEN } from "~/lib/fetchWrapper";
import { fetchSession, setSession, type SessionData } from "~/stores/session";

const api_url = import.meta.env.VITE_API_URL;

if (api_url === undefined) console.error("VITE_API_URL env var is not defined");
let calledAuthAlready = false;

export async function checkLogin() {
  if (typeof window === "undefined") return;
  if (location.pathname === "/auth") return;
  if (location.pathname === "/logged-out") return;

  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (code && !calledAuthAlready) {
    calledAuthAlready = true;
    const response = await fetch(`${api_url}/auth/callback?code=${code}`);

    if (response.status === 201) {
      const session = (await response.json()) as SessionData;
      setSession(session);
      localStorage.removeItem(LS_REDIRECTED_TO_LOGIN);
      localStorage.setItem(LS_TOKEN, session.token);
      calledAuthAlready = false;
      return { state };
    }

    if (
      response.status !== 201 &&
      localStorage.getItem(LS_REDIRECTED_TO_LOGIN)
    ) {
      localStorage.removeItem(LS_REDIRECTED_TO_LOGIN);
      const txt = await response.text();
      location.assign(
        `/auth?status=${response.status}&msg=${encodeURIComponent(txt)}`,
      );
      calledAuthAlready = false;
      return;
    }
  }

  const newUrl = new URL(location.href);
  newUrl.searchParams.delete("code");
  const originalUrlPath = encodeURIComponent(
    `${newUrl.pathname}${newUrl.search}`,
  );

  const response = await fetchSession(originalUrlPath);
  if (response.status === 302) {
    localStorage.setItem(LS_REDIRECTED_TO_LOGIN, "true");
    // we are redirecting to login
    const { authorizationUrl } = response;
    return { authorizationUrl, originalUrlPath };
  }
}
