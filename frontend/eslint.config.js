import pluginVue from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: ['dist/*', 'node_modules/*', 'public/*'],
  },
  // Vue recommended config
  ...pluginVue.configs['flat/essential'],
  // Prettier config
  eslintConfigPrettier,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
];
