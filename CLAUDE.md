# nukey-kit

This repo is a public Claude Code plugin marketplace. `.claude-plugin/marketplace.json` lists the plugins, and each one lives in its own folder under `plugins/`.

Working rules:

- Write code, comments, docs, commit messages, issues and pull requests in English.
- A plugin's `name` in its `plugin.json` must match its entry in `marketplace.json`.
- Put `version` only in the plugin's `plugin.json`, never in `marketplace.json`. Installed copies only update when the version changes, so raise it in any commit meant to reach users.
- After touching `marketplace.json`, run `claude plugin validate . --strict`. After touching a plugin, run `claude plugin validate plugins/<name>` as well: it checks the hooks and the state contract, and a plugin that fails it won't load.
- Run `claude plugin test plugins/<name>` for plugins with tests. Tests passing does not mean the plugin validates, so run both.
- Any `$.state` value a plugin reads or writes must be declared in that plugin's `types/index.d.ts` in the same commit.
