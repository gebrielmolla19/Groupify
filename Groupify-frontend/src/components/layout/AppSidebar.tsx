import {
  Home,
  User,
  Music,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "../ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useUser } from "../../contexts/UserContext";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

export default function AppSidebar() {
  const { user, logout } = useUser();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  
  const menuItems = [
    { path: "/", label: "Groups", icon: Home },
  ];

  // Get user initials for avatar fallback
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className={`border-b border-border transition-all duration-200 ${
        isCollapsed ? "px-3 py-2" : "p-6"
      }`}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <div className="bg-primary/10 border border-primary/30 rounded-lg w-8 h-8 p-0 flex items-center justify-center">
              <Music className="w-4 h-4 text-primary" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/30 rounded-lg shrink-0 p-2 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <span className="text-primary font-semibold">Groupify</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className={isCollapsed ? "!p-0 px-3 py-2" : ""}>
          <SidebarGroupContent className={isCollapsed ? "!p-0" : ""}>
            <SidebarMenu className={isCollapsed ? "!gap-1 items-center" : ""}>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path} className={isCollapsed ? "flex justify-center" : ""}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.path)}
                      isActive={isActive}
                      tooltip={item.label}
                      className={`${isActive ? "bg-primary/10 text-primary" : ""} ${
                        isCollapsed ? "!p-0 !w-8 !h-8 !justify-center !mx-0" : ""
                      }`}
                      aria-label={`Navigate to ${item.label}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={`border-t border-border transition-all duration-200 ${
        isCollapsed ? "px-3 py-2" : "p-3 md:p-4"
      }`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
        <button
                className={`flex items-center gap-2 md:gap-3 mb-2 p-2 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors ${
                  isCollapsed ? "w-full justify-center" : "w-full text-left"
                } ${location.pathname === '/profile' ? "bg-primary/10" : ""}`}
          onClick={() => navigate('/profile')}
          aria-label="View profile"
        >
          <Avatar className={`border border-primary/30 shrink-0 transition-all duration-200 ${
            isCollapsed ? "w-8 h-8" : "w-8 h-8 md:w-9 md:h-9"
          }`}>
            <AvatarImage src={user?.profileImage || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {user?.displayName ? getInitials(user.displayName) : 'U'}
            </AvatarFallback>
          </Avatar>
                <div className={`flex-1 min-w-0 transition-opacity duration-200 ${
                  isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                }`}>
            <p className={`text-xs md:text-sm font-medium truncate ${location.pathname === '/profile' ? "text-primary" : ""}`}>
              {user?.displayName || 'User'}
            </p>
          </div>
                {!isCollapsed && (
          <User className={`w-4 h-4 shrink-0 ${location.pathname === '/profile' ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                )}
        </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" align="center">
                <p>{user?.displayName || 'User'}</p>
              </TooltipContent>
            )}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
                className={`hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 cursor-pointer transition-colors ${
                  isCollapsed ? "!w-8 !h-8 !p-0 !justify-center !mx-auto" : "w-full justify-start text-xs md:text-sm"
                }`}
          onClick={handleLogout}
          aria-label="Logout from Groupify"
        >
                <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className={`truncate transition-opacity duration-200 ${
                  isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 ml-2"
                }`}>
                  Logout
                </span>
        </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" align="center">
                <p>Logout</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  );
}
