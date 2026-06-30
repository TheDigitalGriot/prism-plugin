import DefaultTheme from 'vitepress/theme'
import ArchitectureExplorer from './components/ArchitectureExplorer.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ArchitectureExplorer', ArchitectureExplorer)
  },
}
