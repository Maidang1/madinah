import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import {
  MoonIcon,
  SunIcon,
  HouseIcon,
  BookOpenIcon,
  CodeIcon,
} from "lucide-react";
import { Dock, DockIcon } from "@components/magicui/dock";

interface MenuProps {
  className?: string;
}

export function Menu({ className }: MenuProps) {
  const [localDark, setLocalDark] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("madinah_blog_theme");
    if (savedTheme) {
      setLocalDark(JSON.parse(savedTheme));
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setLocalDark(prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !localDark;
    setLocalDark(newTheme);
    localStorage.setItem("madinah_blog_theme", JSON.stringify(newTheme));
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <Dock direction="middle">
        <DockIcon
          onClick={() => navigate("/")}
          active={isActive("/")}
          activeClassName="bg-gray-300/50 dark:bg-gray-600/50"
        >
          <HouseIcon size={16} />
        </DockIcon>
        <DockIcon
          onClick={() => navigate("/blog")}
          active={isActive("/blog")}
          activeClassName="bg-gray-300/50 dark:bg-gray-600/50"
        >
          <BookOpenIcon size={16} />
        </DockIcon>
        <DockIcon
          onClick={() => navigate("/rust")}
          active={isActive("/rust")}
          activeClassName="bg-gray-300/50 dark:bg-gray-600/50"
        >
          <CodeIcon size={16} />
        </DockIcon>
        <div className="mx-1 h-8 w-px bg-gray-200 dark:bg-gray-700" />
        <DockIcon
          onClick={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          activeClassName="bg-gray-300/50 dark:bg-gray-600/50"
        >
          {localDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </DockIcon>
      </Dock>
    </div>
  );
}
