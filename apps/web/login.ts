import { LS_REDIRECTED_TO_LOGIN, LS_TOKEN } from "~/lib/fetchWrapper";

const api_url = import.meta.env.VITE_API_URL;

if (api_url === undefined) console.error("VITE_API_URL env var is not defined");

export async function checkLogin() {
  if (typeof window === "undefined") return;

  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (code) {
    const response = await fetch(`${api_url}/auth/callback?code=${code}`);
    if (response.status === 201) {
      const token = await response.text();
      localStorage.removeItem(LS_REDIRECTED_TO_LOGIN);
      localStorage.setItem(LS_TOKEN, token);
      return state;
    }

    if (
      response.status !== 201 &&
      localStorage.getItem(LS_REDIRECTED_TO_LOGIN)
    ) {
      alert("There was a problem attempting to login, please try again later.");
      localStorage.removeItem(LS_REDIRECTED_TO_LOGIN);
      return;
    }
  }

  const token = localStorage.getItem(LS_TOKEN);

  const newUrl = new URL(location.href);
  newUrl.searchParams.delete("code");
  const originalUrlPath = encodeURIComponent(
    `${newUrl.pathname}${newUrl.search}`,
  );

  const response = await fetch(
    `${api_url}/auth/session?return=${originalUrlPath}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (response.status === 302) {
    localStorage.setItem(LS_REDIRECTED_TO_LOGIN, "true");
    // we are redirecting to login
    const { authorizationUrl } = await response.json();
    location.assign(authorizationUrl);
  }
}
