import type { MetaFunction } from "@remix-run/cloudflare";
import { motion } from "motion/react";
import { ExternalLink, Github, Star, GitFork } from "lucide-react";
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
    url: "https://pixel.felixwliu.cn/"
  },
];


export default function Projects() {
  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-4">
            Projects
          </h1>
          <p className="text-lg text-black/70 dark:text-white/70 max-w-2xl mx-auto">
            Projects that I created or maintaining. Each one represents a journey of learning and exploration.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  delay={index * 0.05}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-xl font-bold text-black dark:text-white mb-2">
                No projects found
              </h3>

            </div>
          )}
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

function ProjectCard({ project, featured = false, delay = 0 }: ProjectCardProps) {
  // Language color mapping
  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      TypeScript: "#3178c6",
      JavaScript: "#f7df1e",
      Rust: "#ce422b",
      Go: "#00add8",
      Python: "#3776ab",
      Shell: "#89e051",
      Markdown: "#083fa1",
      Multiple: "#6b7280",
    };
    return colors[language] || "#6b7280";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700",
        "bg-white dark:bg-gray-800/50 backdrop-blur-sm",
        "hover:border-main-500/50 hover:shadow-xl hover:shadow-main-500/10",
        "transition-all duration-300",
        featured && "md:col-span-1"
      )}
    >
      {/* Status Badge */}
      {project.status && (
        <div className="absolute top-4 right-4 z-10">
          <span
            className={cn(
              "px-2 py-1 text-xs font-medium rounded-full",
              project.status === "active" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
              project.status === "wip" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
              project.status === "archived" && "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
            )}
          >
            {project.status === "wip" ? "WIP" : project.status}
          </span>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-black dark:text-white mb-1 group-hover:text-main-500 transition-colors">
              {project.name}
            </h3>
            {project.category && (
              <span className="text-sm text-main-500 font-medium">
                {project.category}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-black/70 dark:text-white/70 text-sm mb-4 line-clamp-2">
          {project.description}
        </p>

        {/* Stats */}
        {(project.stars || project.forks || project.language) && (
          <div className="flex items-center gap-4 mb-4 text-sm text-black/60 dark:text-white/60">
            {project.language && (
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getLanguageColor(project.language) }}
                ></span>
                {project.language}
              </span>
            )}
            {project.stars && (
              <span className="flex items-center gap-1">
                <Star size={12} />
                {project.stars}
              </span>
            )}
            {project.forks && (
              <span className="flex items-center gap-1">
                <GitFork size={12} />
                {project.forks}
              </span>
            )}
          </div>
        )}

        {/* Links */}
        <div className="flex items-center gap-3">
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-black/70 dark:text-white/70 hover:text-main-500 transition-colors"
            >
              <Github size={16} />
              Source
            </a>
          )}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-black/70 dark:text-white/70 hover:text-main-500 transition-colors"
            >
              <ExternalLink size={16} />
              Live Demo
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}