import { useTranslation } from '~/core/i18n';

export function LicenseNotice() {
  const { t } = useTranslation();

  return (
      <div className="flex items-center justify-center mt-4">
        <div className="text-text-weak text-center text-sm">
          <p className="leading-relaxed opacity-75">
            {t('license.notice')}
          </p>
        </div>
      </div>
  );
}
