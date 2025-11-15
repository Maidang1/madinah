import { ChevronDown, ExternalLink, GitCommitHorizontal } from 'lucide-react';
import { useTranslation } from '~/core/i18n';
import { PostGitInfo } from '~/types';

interface Props {
  gitInfo?: PostGitInfo;
}
export const HistoryVersions = ({ gitInfo }: Props) => {
  const { t, locale } = useTranslation();
  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  return (
    <details className="text-muted-foreground group text-sm">
      <summary className="cursor-pointer list-none">
        <span className="hover:text-foreground inline-flex items-center gap-1.5">
          <GitCommitHorizontal className="h-4 w-4" />
          {t('blog.detail.versionHistory')} ({gitInfo?.commits.length})
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="mt-3 space-y-2 pl-5">
        {gitInfo?.commits.slice(0, 10).map((commit) => (
          <div key={commit.hash} className="flex items-start gap-2 text-xs">
            <code className="text-muted-foreground/70 font-mono">
              {commit.hash}
            </code>
            <div className="flex-1">
              <div className="text-muted-foreground/70">
                {commit.author} ·{' '}
                {new Date(commit.date).toLocaleDateString(localeCode)}
              </div>
            </div>
            {commit.githubUrl && (
              <a
                href={commit.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </details>
  );
};
