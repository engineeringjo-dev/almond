// Metro config for the npm-workspaces monorepo. Lets the Expo app resolve and
// transpile the shared TypeScript package (`@almond/shared`) from the repo root.
// Standard Expo monorepo setup: watch the workspace root + resolve hoisted deps.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (so changes to packages/shared reload).
config.watchFolders = [workspaceRoot];

// 2. Resolve node_modules from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
