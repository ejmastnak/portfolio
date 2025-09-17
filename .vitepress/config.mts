import { defineConfig } from 'vitepress'
import { fileURLToPath, URL } from 'node:url'
import { imagetools } from 'vite-imagetools'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Notes",
  description: "Notes",
  srcDir: "src",
  themeConfig: {
    nav: null,
    sidebar: null,
    socialLinks: null,
    siteTitle: null,
    logo: '/logo.svg',
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./theme', import.meta.url))
      }
    },
    plugins: [
      imagetools(),
    ]
  }
})
