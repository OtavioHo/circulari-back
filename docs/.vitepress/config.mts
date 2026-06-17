import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Circulari',
  description: 'Inventory management app — catalog physical items with AI',
  themeConfig: {
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Roadmap', link: '/roadmap' }
    ],
    sidebar: [
      { text: 'Overview', link: '/index' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Data Models', link: '/data-models' },
      { text: 'API', link: '/api' },
      { text: 'AI Integration', link: '/ai' },
      { text: 'Infrastructure', link: '/infra' },
      { text: 'Deployment', link: '/deployment' },
      { text: 'Infrastructure Costs', link: '/infrastructure-costs' },
      { text: 'Monetization', link: '/monetization' },
      { text: 'Roadmap', link: '/roadmap' }
    ],
    socialLinks: [],
    search: { provider: 'local' }
  }
})
