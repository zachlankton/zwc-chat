import { QueryCache, QueryClient } from "@tanstack/react-query";
import { checkLogin } from "login";
import { AsyncAlert } from "~/components/async-modals";

const MAX_RETRIES = 6;
const HTTP_STATUS_TO_NOT_RETRY = [400, 401, 403, 404];
let sessionExpiring = false;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: async (error: any) => {
      if (
        !sessionExpiring &&
        error.status === 401 &&
        location.pathname !== "/auth"
      ) {
        sessionExpiring = true;
        await AsyncAlert({
          title: "Please Login",
          message: "Your session has expired. Redirecting you to login.",
        });

        const ret = await checkLogin();
        if (ret === undefined) return;
        if (ret.state) location.assign(ret.state);
        if (ret.authorizationUrl) {
          const newUrl = new URL(location.origin);
          newUrl.pathname = "/auth";
          newUrl.searchParams.set("authorizationUrl", ret.authorizationUrl);
          location.assign(newUrl.toString());
        }
      }
      console.log(error);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 500,
      retry: (failureCount, error: any) => {
        if (failureCount > MAX_RETRIES) {
          return false;
        }

        if (
          Object.hasOwnProperty.call(error, "status") &&
          HTTP_STATUS_TO_NOT_RETRY.includes(error.status)
        ) {
          return false;
        }

        return true;
      },
    },
  },
});
