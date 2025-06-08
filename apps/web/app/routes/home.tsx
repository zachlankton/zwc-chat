import type { Route } from "./+types/home";
import Dashboard from "./dashboard";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "ZWC Chat" },
    { name: "description", content: "Welcome to ZWC Chat" },
  ];
}

export default function Home() {
  return <Dashboard />;
}
