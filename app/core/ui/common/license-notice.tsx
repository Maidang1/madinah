import { motion } from 'motion/react';

export function LicenseNotice() {
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
            本内容采用 知识共享署名 - 非商业性使用 - 相同方式共享 4.0
            国际许可协议 (CC BY-NC-SA 4.0) 进行许可。
          </p>
        </div>
      </div>
    </motion.div>
  );
}
