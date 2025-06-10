import { AppSidebar } from "~/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { useNavigate } from "react-router";
import { useEffect } from "react";

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to a new chat when landing on home
    const newChatId = crypto.randomUUID();
    navigate(`/chat/${newChatId}`);
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
