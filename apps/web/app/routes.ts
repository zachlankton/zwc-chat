import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("chat", "routes/chat.tsx", [
    route(":chatId", "routes/chat.$chatId.tsx"),
  ]),
  route("auth", "routes/auth.tsx"),
  route("auth/openrouter/callback", "routes/auth.openrouter.callback.tsx"),
  route("logged-out", "routes/logout.tsx"),
  route("loading-demo", "routes/loading-demo.tsx"),
] satisfies RouteConfig;
