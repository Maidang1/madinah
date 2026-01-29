import { useTranslation } from '~/core/i18n';
import { Github, Rss, Twitter } from 'lucide-react';

export function Hero() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="space-y-4">
        <h1 className="text-text-primary font-sans text-4xl font-bold tracking-tight sm:text-5xl">
          👋 {t('home.hero.title')}
        </h1>
        <p className="text-text-secondary max-w-2xl text-lg leading-relaxed">
          {t('home.hero.subtitle')}
        </p>
      </div>

      <div className="flex items-center gap-5">
        <a
          href="https://github.com/Maidang1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label="GitHub"
        >
          <Github className="h-6 w-6" />
        </a>
        <a
          href="https://twitter.com" // Replace with actual Twitter link if available
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label="Twitter"
        >
          <Twitter className="h-6 w-6" />
        </a>
        <a
          href="/rss.xml"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label="RSS"
        >
          <Rss className="h-6 w-6" />
        </a>
      </div>
    </div>
  );
}
