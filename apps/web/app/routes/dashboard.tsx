import { AppSidebar } from "~/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useSession } from "~/stores/session";

export default function Dashboard() {
  const navigate = useNavigate();
  const session = useSession() as any;

  useEffect(() => {
    if (!session) return;
    if (session.status === 302) return;
    // Redirect to a new chat when landing on home
    const newChatId = crypto.randomUUID();
    navigate(`/chat/${newChatId}`, { replace: true });
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex-1 flex flex-col overflow-hidden"></div>
      </SidebarInset>
    </SidebarProvider>
  );
}
