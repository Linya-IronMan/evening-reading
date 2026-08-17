import fs from 'node:fs';
import path from 'node:path';

/**
 * CI/CD 发布时生成 Tauri 2 官方标准 latest.json 更新清单
 *
 * 环境变量要求：
 * - VERSION: 当前发布版本（如 0.2.1）
 * - UPDATE_ARCHIVE_PATH: 本地打包产物压缩包路径
 * - UPDATE_ARCHIVE_URL: 远端下载公开 URL
 * - UPDATE_SIGNATURE_PATH: 本地 Minisign .sig 签名文件路径
 * - UPDATE_MANIFEST_PATH: 输出 latest.json 目标路径
 * - RELEASE_NOTES: (可选) 本次发布的更新日志
 */
const {
  VERSION,
  UPDATE_ARCHIVE_PATH,
  UPDATE_ARCHIVE_URL,
  UPDATE_SIGNATURE_PATH,
  UPDATE_MANIFEST_PATH,
  RELEASE_NOTES,
} = process.env;

const requiredEnv = {
  VERSION,
  UPDATE_ARCHIVE_PATH,
  UPDATE_ARCHIVE_URL,
  UPDATE_SIGNATURE_PATH,
  UPDATE_MANIFEST_PATH,
};

const missing = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`[create-updater-manifest] 缺少必要环境变量: ${missing.join(', ')}`);
  process.exit(1);
}

if (!fs.existsSync(UPDATE_ARCHIVE_PATH)) {
  console.error(`[create-updater-manifest] 未找到更新包文件: ${UPDATE_ARCHIVE_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(UPDATE_SIGNATURE_PATH)) {
  console.error(`[create-updater-manifest] 未找到签名文件: ${UPDATE_SIGNATURE_PATH}`);
  process.exit(1);
}

const signature = fs.readFileSync(UPDATE_SIGNATURE_PATH, 'utf8').trim();
const pubDate = new Date().toISOString();

const manifest = {
  version: VERSION,
  notes: RELEASE_NOTES || `Evening Reading v${VERSION}`,
  pub_date: pubDate,
  platforms: {
    'darwin-aarch64': {
      signature,
      url: UPDATE_ARCHIVE_URL,
    },
    'darwin-x86_64': {
      signature,
      url: UPDATE_ARCHIVE_URL,
    },
    'windows-x86_64': {
      signature,
      url: UPDATE_ARCHIVE_URL,
    },
  },
};

fs.mkdirSync(path.dirname(UPDATE_MANIFEST_PATH), { recursive: true });
fs.writeFileSync(UPDATE_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[create-updater-manifest] 成功生成更新清单: ${UPDATE_MANIFEST_PATH}`);
