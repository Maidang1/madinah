import type { MetaFunction } from "@remix-run/cloudflare";
import { motion } from "motion/react";
import { cn } from "~/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Projects - Madinah" },
    { name: "description", content: "Projects that I created or maintaining." },
  ];
};
interface Project {
  id: string;
  name: string;
  description: string;
  url?: string;
  github?: string;
  stars?: number;
  forks?: number;
  language?: string;
  status?: "active" | "archived" | "wip";
  category: string;
  featured?: boolean;
  icon?: string;
}

const projects: Project[] = [
  {
    id: "wallpaper-app",
    name: "Wallpaper App",
    description: "A simple wallpaper app built with Tauri and Rust.",
    github: "https://github.com/Maidang1/wallpaper-app",
    language: "Rust",
    status: "wip",
    category: "Web Development",
    featured: true,
    icon: "i-streamline-ultimate-color-card-game-heart",
  },
  {
    id: "farmfe-plugins",
    name: "FarmFe Plugins",
    description: "The one-stop shop for official Farm plugins",
    github: "https://github.com/farm-fe/plugins",
    language: "Rust",
    status: "active",
    category: "Rust",
    featured: false,
    icon: "i-streamline-ultimate-color-snapchat-logo"
  },
  {
    id: "pixel-picture",
    name: "Pixel Picture",
    description: "Transform your image into pixel art",
    github: "https://github.com/Maidang1/pixel-picture",
    language: "TypeScript",
    status: "active",
    category: "Web Development",
    featured: false,
    url: "https://pixel.felixwliu.cn/",
    icon: "i-streamline-ultimate-color-picture-double-landscape",
  },
  {
    id: "reminders",
    name: "Reminders",
    description: "一个提醒 app 定时提醒你喝水",
    github: "https://github.com/Maidang1/reminders",
    language: "Rust",
    status: "active",
    category: "Rust",
    featured: false,
    icon: "i-streamline-ultimate-color-time-clock-hand-1",
  },
];


export default function Projects() {
  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <h1 className="from-primary to-primary-light mb-4 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            Projects
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-black/70 dark:text-white/70">
            Projects that I created or maintaining.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                delay={index * 0.05}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  featured?: boolean;
  delay?: number;
}

function ProjectCard({
  project,
}: ProjectCardProps) {


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={cn(
        "group relative overflow-hidden",
        "transition-all duration-300",
        "rounded-[6px]",
        "hover:bg-black/5 dark:hover:bg-black/40"
      )}
    >
      <motion.a className="p-4 flex gap-x-4 items-center duration-300 transition-opacity opacity-80 hover:opacity-100" href={project.url ?? project.github} target="_blank" rel="noreferrer">
        <div>
          <span className={cn(project.icon, "text-4xl")}></span>
        </div>
        <div>
          <h3 className="mb-1 text-lg !text-gray-700 dark:!text-gray-200 transition-colors">
            {project.name}
          </h3>
          <p className="text-sm opacity-50 text-gray-700 dark:text-gray-200 !leading-5">
            {project.description}
          </p>
        </div>
      </motion.a>
    </motion.div>
  );
}
