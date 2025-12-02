import type { MetaFunction } from '@remix-run/cloudflare';
import { motion } from 'motion/react';
import { cn } from '~/core/utils';
import { DEFAULT_LOCALE, getT, useTranslation } from '~/core/i18n';

export const meta: MetaFunction = ({ matches }) => {
  const rootData = matches.find((m) => m.id === 'root')?.data as any;
  const locale = (rootData?.locale ?? DEFAULT_LOCALE) as typeof DEFAULT_LOCALE;
  const t = getT(locale);
  const metaDict = t('projects.meta') as any;
  return [
    { title: metaDict?.title ?? 'Projects - Madinah' },
    {
      name: 'description',
      content:
        metaDict?.description ?? 'Projects that I created or maintaining.',
    },
  ];
};
interface Project {
  id: string;
  url?: string;
  github?: string;
  icon?: string;
  translationKey:
    | 'wallpaperApp'
    | 'farmfePlugins'
    | 'pixelPicture'
    | 'reminders'
    | 'tasukuRs';
}

const projects: Project[] = [
  {
    id: 'wallpaper-app',
    github: 'https://github.com/Maidang1/wallpaper-app',
    icon: 'i-streamline-ultimate-color-card-game-heart',
    translationKey: 'wallpaperApp',
  },
  {
    id: 'farmfe-plugins',
    github: 'https://github.com/farm-fe/plugins',
    icon: 'i-streamline-ultimate-color-snapchat-logo',
    translationKey: 'farmfePlugins',
  },
  {
    id: 'pixel-picture',
    github: 'https://github.com/Maidang1/pixel-picture',
    url: 'https://pixel.felixwliu.cn/',
    icon: 'i-streamline-ultimate-color-picture-double-landscape',
    translationKey: 'pixelPicture',
  },
  {
    id: 'reminders',
    github: 'https://github.com/Maidang1/reminders',
    icon: 'i-streamline-ultimate-color-time-clock-hand-1',
    translationKey: 'reminders',
  },
  {
    id: 'tasuku-rs',
    github: 'https://github.com/Maidang1/tasuku-rs',
    icon: 'i-streamline-ultimate-color-space-astronaut',
    translationKey: 'tasukuRs',
  },
];

export default function Projects() {
  const { t } = useTranslation();
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
            {t('projects.title')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-black/70 dark:text-white/70">
            {t('projects.subtitle')}
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
                translationKey={project.translationKey}
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
  translationKey: Project['translationKey'];
}

function ProjectCard({ project, translationKey }: ProjectCardProps) {
  const { t } = useTranslation();
  const displayName: string = t(`projects.items.${translationKey}.name`);
  const description: string = t(`projects.items.${translationKey}.description`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={cn(
        'group relative overflow-hidden',
        'transition-all duration-300',
        'rounded-[6px]',
        'hover:bg-black/5 dark:hover:bg-black/40',
      )}
    >
      <motion.a
        className="flex items-center gap-x-4 p-4 opacity-80 transition-opacity duration-300 hover:opacity-100"
        href={project.url ?? project.github}
        target="_blank"
        rel="noreferrer"
      >
        <div>
          <span className={cn(project.icon, 'text-4xl')}></span>
        </div>
        <div>
          <h3 className="mb-1 text-lg !text-gray-700 transition-colors dark:!text-gray-200">
            {displayName}
          </h3>
          <p className="text-sm !leading-5 text-gray-700 opacity-50 dark:text-gray-200">
            {description}
          </p>
        </div>
      </motion.a>
    </motion.div>
  );
}
