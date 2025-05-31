import { useTheme } from "~/hooks/use-theme";

export default function ThemeTest() {
  const { theme, setTheme, toggleTheme, isSubmitting } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">主题测试页面</h1>
        
        <div className="space-y-4">
          <p className="text-lg">当前主题: <span className="font-semibold">{theme}</span></p>
          
          <div className="flex gap-4">
            <button
              onClick={() => setTheme("light")}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-md border ${
                theme === "light" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              Light
            </button>
            
            <button
              onClick={() => setTheme("dark")}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-md border ${
                theme === "dark" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              Dark
            </button>
            
            <button
              onClick={() => setTheme("auto")}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-md border ${
                theme === "auto" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              Auto
            </button>
          </div>
          
          <button
            onClick={toggleTheme}
            disabled={isSubmitting}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? "切换中..." : "切换主题"}
          </button>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">主题效果测试</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-border rounded-lg bg-card text-card-foreground">
              <h3 className="font-semibold mb-2">卡片组件</h3>
              <p className="text-muted-foreground">这是一个测试卡片，用于验证主题颜色是否正确应用。</p>
            </div>
            
            <div className="p-4 border border-border rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">静音背景</h3>
              <p className="text-muted-foreground">这是一个静音背景的区域。</p>
            </div>
          </div>
          
          <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
            <h3 className="font-semibold text-destructive mb-2">警告区域</h3>
            <p className="text-destructive">这是一个警告样式的区域。</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">技术信息</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• 使用 Remix Cookie 存储主题状态</li>
            <li>• 服务端渲染时即应用正确主题</li>
            <li>• 客户端和服务端状态自动同步</li>
            <li>• 支持系统偏好自动切换</li>
            <li>• 无白色闪动问题</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
