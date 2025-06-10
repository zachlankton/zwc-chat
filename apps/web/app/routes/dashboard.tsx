import { AppSidebar } from "~/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { ChatInterface } from "~/components/chat-interface";

export default function Dashboard() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
