import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("loading-demo", "routes/loading-demo.tsx"),
] satisfies RouteConfig;
