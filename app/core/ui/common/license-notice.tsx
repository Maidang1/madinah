import { motion } from 'motion/react';
import { useTranslation } from '~/core/i18n';

export function LicenseNotice() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="border-border/50 mt-12 border-t pt-8"
    >
      <div className="flex items-center justify-center">
        <div className="text-muted-foreground text-center text-sm">
          <p className="leading-relaxed text-gray-300 opacity-60">
            {t('license.notice')}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
