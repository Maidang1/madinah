import type { MetaFunction } from '@remix-run/cloudflare';
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
    | 'tasukuRs'
    | 'reminderCli';
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
  {
    id: 'reminder-cli',
    github: 'https://github.com/Maidang1/reminder-cli',
    icon: 'i-streamline-ultimate-color-check-badge',
    translationKey: 'reminderCli',
  },
];

export default function Projects() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h1 className="from-primary to-primary-light mb-4 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            {t('projects.title')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-black/70 dark:text-white/70">
            {t('projects.subtitle')}
          </p>
        </div>

        <div>
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
        </div>
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
    <div
      className={cn(
        'group relative overflow-hidden',
        'rounded-lg',
        'border-border-default border',
        'bg-surface-white',
        'transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <a
        className="focus-visible:ring-text-primary/20 flex items-center gap-x-4 p-4 transition-all duration-300 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2"
        href={project.url ?? project.github}
        target="_blank"
        rel="noreferrer"
      >
        <div>
          <span className={cn(project.icon, 'text-3xl')}></span>
        </div>
        <div>
          <h3 className="text-text-primary mb-1 text-base font-medium">
            {displayName}
          </h3>
          <p className="text-text-secondary line-clamp-2 text-sm leading-5">
            {description}
          </p>
        </div>
      </a>
    </div>
  );
}
