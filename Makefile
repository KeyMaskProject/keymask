# KeysArk —— 便捷构建/调试 keysark CLI。
# 常用:
#   make cli-link     构建并把 `keysark` 链接到本机(全局可用)
#   make cli          仅重新构建(已 link 过则全局命令随之更新)
#   make cli-dev ARGS="ls"   不构建,直接用 tsx 跑(快速调试)
#   make cli-unlink   解除全局链接

CLI := @keysark/cli
CLI_DIR := apps/cli
CLI_BIN := $(CLI_DIR)/dist/keysark.mjs

.DEFAULT_GOAL := help

.PHONY: help cli cli-build cli-link cli-relink cli-unlink cli-dev

help: ## 列出可用目标
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

cli: cli-build ## 重新构建 CLI bundle(link 后全局命令随之更新)

cli-build: ## esbuild 打包 CLI 到 dist/keysark.mjs
	pnpm --filter $(CLI) build
	chmod +x $(CLI_BIN)

cli-link: cli-build ## 构建并把 `keysark` 全局链接到本机
	cd $(CLI_DIR) && pnpm link --global
	@echo ""
	@echo "✓ 已链接。试试: keysark help"
	@echo "  若提示 command not found,确保 pnpm 全局 bin 在 PATH:"
	@echo "    pnpm setup   # 然后重开终端"
	@echo "  当前 pnpm 全局 bin: $$(pnpm bin -g 2>/dev/null || echo '未配置')"

cli-relink: cli-unlink cli-link ## 解链后重新链接

cli-unlink: ## 解除 `keysark` 全局链接
	cd $(CLI_DIR) && pnpm uninstall --global $(CLI) || true

cli-dev: ## 用 tsx 直接跑 CLI(不构建)。传参: make cli-dev ARGS="ls --vault x"
	pnpm --filter $(CLI) exec tsx src/cli.ts $(ARGS)
