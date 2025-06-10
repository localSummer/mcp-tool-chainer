import fs from 'fs';

/**
 * 从 process.env.CONFIG_PATH 加载MCP JSON配置
 * @returns {Object} 配置对象
 */
export default function getConfig() {
  const configPath = process.env.CONFIG_PATH;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config;
}
