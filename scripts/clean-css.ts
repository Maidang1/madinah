import { PurgeCSS } from 'purgecss'
import path from "path"
import fs from "fs"
const cwd = process.cwd()
const appDir = path.join(cwd, "app")
const purgeCSSResult = await new PurgeCSS().purge({
  content: [`${appDir}/**/*.{ts,tsx}`],
  css: [`${appDir}/**/*.css`]
})

purgeCSSResult.forEach(result => {
  const { file, css } = result;
  if (file) {
    fs.writeFileSync(file, css);
  }
})