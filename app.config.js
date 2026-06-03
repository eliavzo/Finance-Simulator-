/**
 * Dynamic Expo config.
 *
 * Reads the static base config from app.base.json and, when EXPO_BASE_URL is
 * set (e.g. in the GitHub Pages CI job), injects it as `experiments.baseUrl`
 * so every web asset path is prefixed with the project's Pages subpath. Local
 * development leaves it unset and serves from the root.
 */
const base = require('./app.base.json');

module.exports = () => {
  const baseUrl = process.env.EXPO_BASE_URL;
  const expo = { ...base.expo };
  if (baseUrl) {
    expo.experiments = { ...(expo.experiments ?? {}), baseUrl };
  }
  return { ...base, expo };
};
