#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "请先安装 Node.js 22.12 或更新版本，再重新运行。"
  exit 1
fi
npm ci
npm test
npm run build:mac -- "$@"
echo "构建完成。请在 dist 中找到对应架构的 ZIP，将 .app 放入应用程序后打开。"
