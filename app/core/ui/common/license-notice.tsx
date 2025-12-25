import { useTranslation } from '~/core/i18n';

export function LicenseNotice() {
  const { t } = useTranslation();

  return (
    <div
      className="border-border/50 mt-12 border-t pt-8"
    >
      <div className="flex items-center justify-center">
        <div className="text-muted-foreground text-center text-sm">
          <p className="leading-relaxed text-gray-300 opacity-60">
            {t('license.notice')}
          </p>
        </div>
      </div>
    </div>
  );
}
