import { useTranslation } from '~/core/i18n';

export function LicenseNotice() {
  const { t } = useTranslation();

  return (
    <div className="border-border-weak/50 mt-12 border-t pt-8">
      <div className="flex items-center justify-center">
        <div className="text-text-weak text-center text-sm">
          <p className="leading-relaxed opacity-75">
            {t('license.notice')}
          </p>
        </div>
      </div>
    </div>
  );
}
