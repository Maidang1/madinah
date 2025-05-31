import { useNavigate, useLocation } from "@remix-run/react";
import {
  MoonIcon,
  SunIcon,
  HouseIcon,
  FileIcon,
  WandIcon,
} from "lucide-react";
import { Dock, DockIcon } from "~/components/magicui/dock";
import { Theme } from "~/utils/theme-sync";


interface MenuProps {
  onThemeToggle?: () => void;
  theme?: Theme;
}

export function Menu({ onThemeToggle, theme }: MenuProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <Dock direction="middle">
        <DockIcon
          onClick={() => navigate("/")}
          active={isActive("/")}
          activeClassName="bg-main-500"
        >
          <HouseIcon size={16} />
        </DockIcon>
        <DockIcon
          onClick={() => navigate("/blog")}
          active={isActive("/blog")}
          activeClassName="bg-main-500"
        >
          <FileIcon size={16} />
        </DockIcon>
        <DockIcon
          onClick={() => navigate("/projects")}
          active={isActive("/projects")}
          activeClassName="bg-main-500"
        >
          <WandIcon size={16} />
        </DockIcon>
        <div className="mx-1 h-3 w-px bg-gray-700 dark:bg-white" />
        <DockIcon
          onClick={(e) => {
            e.preventDefault();
            onThemeToggle?.();
          }}
          activeClassName="bg-main-500"
        >
          {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </DockIcon>
      </Dock>
    </div>
  );
}
