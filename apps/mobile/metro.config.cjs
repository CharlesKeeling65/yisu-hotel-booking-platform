const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// 获取当前项目路径
const projectRoot = __dirname;
// 获取 Monorepo 根路径 (往上两级)
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 这一步是让 Metro 能读到根目录的 node_modules (关键修复)
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: "./tailwind.config.js",
});
