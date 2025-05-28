import { Link } from "@remix-run/react";
import { Icons } from "~/components/common/icons";
import type { MetaFunction } from "@remix-run/cloudflare";
import { TypingAnimation } from "~/components/magicui/typing-animation";
import { motion } from "motion/react";
import { cn } from "~/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Madinah" },
    { name: "description", content: "Welcome to Madinah!" },
  ];
};

const Index = () => {
  return (
    <div className="relative h-full overflow-hidden">
      <div className="bg-transparent main-content relative flex items-center gap-x-6 justify-around pt-[100px] sm:pt-[160px] max-h-full overflow-hidden flex-col gap-y-10 lg:gap-y-0 lg:flex-row lg:pt-[240px] px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-y-6 text-center items-center lg:text-left lg:items-start text-foreground order-2 lg:order-1"
        >
          <div className='text-2xl sm:text-4xl min-h-[80px] font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'>
            <TypingAnimation>Hey I&apos;m Madinah</TypingAnimation>
          </div>
          <motion.div
            transition={{ delay: 0.5, duration: 0.5 }}
            className="font-light text-xl text-black/70 dark:text-white/70"
          >
            A Frontend Developer
          </motion.div>
          <motion.div
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-2 flex gap-x-6 items-center"
          >
            {[
              {
                name: 'bilibili',
                url: 'https://space.bilibili.com/427444426',
                icon: 'i-simple-icons-bilibili',
                color: 'bg-[rgb(242,93,142)]'
              },
              {
                name: 'Telegram',
                url: 'https://t.me/maidang606',
                icon: 'i-simple-icons-telegram',
                color: 'bg-[rgb(0,136,204)]'
              },
              {
                name: 'GitHub',
                url: 'https://github.com/Maidang1',
                icon: 'i-simple-icons-github',
                color: 'bg-foreground dark:bg-black'
              },
              {
                name: 'RSS',
                url: '/rss.xml',
                icon: 'i-simple-icons-rss',
                color: 'bg-[rgb(255,135,73)]'
              },
              {
                name: 'X',
                url: 'https://x.com/felixwliu',
                icon: 'i-simple-icons-x',
                color: 'bg-[rgb(29,145,200)]'
              },
            ].map((item, index) => (
              <Link
                key={item.name}
                to={item.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "p-[2px] rounded-[6px] transition-colors duration-300 hover:scale-110",
                  item.color
                )}
                aria-label={item.name}
              >
                <Icons
                  iconName={item.icon}
                  iconColor={item.color}
                />
              </Link>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative order-1 lg:order-2 group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-70 blur-xl transition-opacity duration-500 animate-pulse"></div>
          <div className="relative">
            <img
              src="https://avatars.githubusercontent.com/u/50993231?v=4"
              alt="avatar"
              className="rounded-full w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] lg:w-[300px] lg:h-[300px] select-none border-4 border-background shadow-xl transition-all duration-500 group-hover:scale-105"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
