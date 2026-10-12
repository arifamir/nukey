import { describe, expect, test } from 'claude-code/testing'
import type { SceneId } from '../types'
import { classifyShell, classifyTool, fileKind, isHandback, takesUpDesignWork } from './classify'

const HEREDOC = "<<'EOF'"

// Shell commands (tool Bash) and the scene each shows, design-work flag off.
const SHELL: readonly (readonly [string, SceneId])[] = [
  // reading
  ['cat README.md', 'reading'],
  ['head -40 hooks/register.tsx', 'reading'],
  ["sed -n '1,20p' file.ts", 'reading'],
  ['cat notes.md | grep TODO', 'reading'],
  ['cat file.ts 2>/dev/null', 'reading'],
  ['cat .gitignore', 'reading'],
  ['sudo cat /etc/hosts', 'reading'],
  ['FOO=1 cat x', 'reading'],
  ['then cat x', 'reading'],
  ['cd a; cd b && cat x', 'reading'],
  ["cd 'my dir' && cat x", 'reading'],
  ['tail -f x', 'reading'],
  ['less x', 'reading'],
  ['more x', 'reading'],
  ['bat x', 'reading'],
  ['wc -l x', 'reading'],
  ['nl x', 'reading'],
  ['jq . x', 'reading'],
  ['yq . x', 'reading'],
  ['awk 1 x', 'reading'],
  ['diff a b', 'reading'],
  ['stat x', 'reading'],
  ['file x', 'reading'],
  ["sed --in-place 's/a/b/' x.ts", 'reading'],
  ["sed -in 's/a/b/' x.ts", 'reading'],
  [`cat ${HEREDOC}\ngit status\nEOF`, 'reading'],
  // searching
  ['grep -rn "nukey" src', 'searching'],
  ['grep -rn "git commit" docs', 'searching'],
  ['find . -name "*.ts"', 'searching'],
  ['ls -la', 'searching'],
  ['ls missing 2>&1', 'searching'],
  ['/usr/bin/grep foo bar', 'searching'],
  ['pushd src && ls', 'searching'],
  ['FOO=1 BAR="a b" rg x', 'searching'],
  ['which node', 'searching'],
  ['tree', 'searching'],
  ['locate x', 'searching'],
  ['fd x', 'searching'],
  ['ag x', 'searching'],
  ['ack x', 'searching'],
  ['egrep x', 'searching'],
  ['fgrep x', 'searching'],
  // web
  ['curl -s https://example.com', 'web'],
  ['wget x', 'web'],
  ['http GET x', 'web'],
  ['https x', 'web'],
  // git
  ['git status', 'git'],
  ['git', 'git'],
  ['gh pr view', 'git'],
  ['cd repo && git status', 'git'],
  ['cd "my repo" && gh pr list', 'git'],
  ['GIT_PAGER=cat git log', 'git'],
  ['exec git status', 'git'],
  ['set -e; git add -A && git commit -m "Fix"', 'git'],
  ['ls plugins && git status --short', 'git'],
  ['make build; git diff --stat', 'git'],
  ['python3 build.py\ngit log --oneline -3', 'git'],
  ['for f in a b; do git add "$f"; done', 'git'],
  ['echo a; git push', 'git'],
  ['echo "a" | git apply', 'git'],
  ['cat a > b.ts && git add b.ts', 'git'],
  ['npm install && git commit -m x', 'git'],
  [`cat ${HEREDOC} | git apply\nfoo\nEOF`, 'git'],
  ['echo "then run git status; git push"', 'terminal'],
  [`python3 - ${HEREDOC}\nprint(1)\ngit status\nEOF`, 'terminal'],
  // coding
  ["sed -i '' 's/a/b/' file.ts", 'coding'],
  ["sed -i.bak 's/a/b/' x.ts", 'coding'],
  [`cat > file.ts ${HEREDOC}\nconst a = 1\nEOF`, 'coding'],
  ['cat >> page.html', 'coding'],
  ['echo hi > page.htm', 'coding'],
  // writing
  ['echo hello >> notes.md', 'writing'],
  ['cat x >out.md', 'writing'],
  [`cat > docs/README ${HEREDOC}\n# Title\nEOF`, 'writing'],
  ['cat > README', 'writing'],
  ['cat > notes.rst', 'writing'],
  ["sed -i '' 's/a/b/' CHANGELOG.md", 'writing'],
  ["sed -E -i 's/a/b/' x.md", 'writing'],
  ['sed -i s/a/b/ a.css b.md', 'writing'],
  ['tee out.md', 'writing'],
  // designing
  ["sed -i '' 's/red/blue/' theme.css", 'designing'],
  ['printf "a" > style.css', 'designing'],
  ['echo hi > x.svg', 'designing'],
  ['echo hi > a.scss', 'designing'],
  ['cat <<EOF > a.css', 'designing'],
  // testing
  ['cd app && npm test', 'testing'],
  ['uv run pytest -q', 'testing'],
  ['time npm test', 'testing'],
  ['CI=1 npm test', 'testing'],
  ['npm run test:unit', 'testing'],
  ['npm install && npm test', 'testing'],
  ['npx vitest run', 'testing'],
  ['bun test', 'testing'],
  ['go test ./...', 'testing'],
  ['pnpm run test', 'testing'],
  ['yarn test', 'testing'],
  ['deno test', 'testing'],
  ['dotnet test', 'testing'],
  ['tox -e py', 'testing'],
  ['python -m unittest', 'testing'],
  ['mocha', 'testing'],
  ['rspec', 'testing'],
  ['phpunit', 'testing'],
  ['cargo test', 'testing'],
  ['make test', 'testing'],
  // installing
  ['npm install left-pad', 'installing'],
  ['cd app && pip install requests', 'installing'],
  ['python -m pip install x', 'installing'],
  ['uv pip install x', 'installing'],
  ['uv sync', 'installing'],
  ['npm ci', 'installing'],
  ['npm i', 'installing'],
  ['yarn add react', 'installing'],
  ['bun add x', 'installing'],
  ['cargo install ripgrep', 'installing'],
  ['apt-get install vim', 'installing'],
  ['brew install jq', 'installing'],
  ['poetry install', 'installing'],
  // terminal
  ['npm init', 'terminal'],
  ['echo hello', 'terminal'],
  ['echo x > /dev/null', 'terminal'],
  ['printf x >> /dev/null', 'terminal'],
  ['echo x &> log.txt', 'terminal'],
  ['python script.py', 'terminal'],
  ['make build', 'terminal'],
  ['node a.js', 'terminal'],
  ['docker ps', 'terminal'],
  ['./script.sh', 'terminal'],
  ['kill 1', 'terminal'],
  ['sleep 5', 'terminal'],
  ['nohup python a.py &', 'terminal'],
  ['command -v node', 'terminal'],
  ['cd /repo', 'terminal'],
  ['for f in *.ts; do cat "$f"; done', 'terminal'],
]

// The quirks CONTRACT.md fixes, each with the scene it now shows.
const FIXED: readonly (readonly [string, string, SceneId])[] = [
  // 1. Test runners and installers only as commands, never anywhere in the text.
  ['runner in a file name', 'cat jest.config.js', 'reading'],
  ['runner in quotes', 'echo "jest"', 'terminal'],
  ['runner as an argument', 'echo jest', 'terminal'],
  ['runner in a heredoc body', `cat > a.ts ${HEREDOC}\nrun pytest here\nEOF`, 'coding'],
  ['runner inside a longer word', 'detox build', 'terminal'],
  ['runner later in a chain', 'cd app && make build && npx jest --ci', 'testing'],
  ['installer in quotes', 'echo "npm install x"', 'terminal'],
  ['installer as an argument', 'grep "pip install" README.md', 'searching'],
  ['runner by path', './node_modules/.bin/vitest run', 'testing'],
  // 2. Surrounding whitespace is trimmed.
  ['leading spaces', '  cat x', 'reading'],
  ['surrounding lines', '\n  git status  \n', 'git'],
  ['trailing spaces', 'ls -la   ', 'searching'],
  // 3. tee anywhere in a pipeline writes a file.
  ['tee in a pipeline, code', 'echo x | tee out.ts', 'coding'],
  ['tee in a pipeline, prose', 'echo x | tee out.txt', 'writing'],
  ['tee in a pipeline, looks', 'cat a | tee -a b.css', 'designing'],
  ['tee to /dev/null', 'ls | tee /dev/null', 'searching'],
  // 4. Redirects respect quotes; 1> writes; 2>&1, &>/dev/null and > /dev/null do not.
  ['arrow in double quotes', 'echo "a -> b"', 'terminal'],
  ['arrow in single quotes', "echo 'x > y.ts'", 'terminal'],
  ['1> writes', 'echo a 1>out.ts', 'coding'],
  ['1> to prose', 'echo a 1>out.txt', 'writing'],
  ['>> writes', 'echo a >> out.ts', 'coding'],
  ['2>&1 does not', 'echo x 2>&1', 'terminal'],
  ['&>/dev/null does not', 'echo x &>/dev/null', 'terminal'],
  ['> /dev/null does not', 'echo x > /dev/null', 'terminal'],
  ['quoted target', 'echo hi > "my notes.md"', 'writing'],
]

describe('shell commands', () => {
  test('every command of the shell table shows its scene', () => {
    for (const [command, scene] of SHELL) expect(classifyShell(command), command).toBe(scene)
  })

  test('through the Bash tool too', () => {
    for (const [command, scene] of SHELL) expect(classifyTool('Bash', { command }), command).toBe(scene)
  })

  test('each quirk fix', () => {
    for (const [what, command, scene] of FIXED) expect(classifyShell(command), what).toBe(scene)
  })

  test('web pages written by the shell are designing once the turn took up design work', () => {
    expect(classifyShell(`cat > page.html ${HEREDOC}\n<p>\nEOF`, true)).toBe('designing')
    expect(classifyShell('cat >> page.html', true)).toBe('designing')
    expect(classifyShell('cat >> page.html', false)).toBe('coding')
    expect(classifyShell('echo hi > notes.md', true)).toBe('writing')
  })

  test('Bash with no arguments, or a command that is not text, is terminal', () => {
    expect(classifyTool('Bash')).toBe('terminal')
    expect(classifyTool('Bash', { command: 42 })).toBe('terminal')
  })
})

// Tools and their arguments; the flag is the design-work flag.
const TOOLS: readonly (readonly [string, Record<string, unknown> | undefined, boolean, SceneId])[] = [
  ['Read', { file_path: 'a.ts' }, false, 'reading'],
  ['Edit', { file_path: 'a.ts' }, false, 'coding'],
  ['Edit', { file_path: 'src/App.tsx' }, false, 'coding'],
  ['Edit', { file_path: 'src/App.tsx' }, true, 'coding'],
  ['Edit', { file_path: '/repo/CLAUDE.md' }, false, 'memory'],
  ['Edit', { file_path: '/r/docs/MEMORY.md' }, false, 'memory'],
  ['Edit', { file_path: '/a/memory/x.ts' }, false, 'memory'],
  ['Edit', { file_path: '/repo/README.md' }, false, 'writing'],
  ['Write', { file_path: 'notes.txt' }, false, 'writing'],
  ['Write', { file_path: 'LICENSE' }, false, 'writing'],
  ['Write', { file_path: '/a/Readme' }, false, 'writing'],
  ['Write', { file_path: '/a/README.txt' }, false, 'writing'],
  ['Write', { file_path: 'notes.md' }, false, 'writing'],
  ['Write', { file_path: 'notes.md' }, true, 'writing'],
  ['Edit', { file_path: 'src/app.css' }, false, 'designing'],
  ['Write', { file_path: 'assets/logo.svg' }, false, 'designing'],
  ['Write', { file_path: 'x.SVG' }, false, 'designing'],
  ['MultiEdit', { file_path: 'a.less' }, false, 'designing'],
  ['Write', { file_path: 'scratchpad/tide-table.html' }, false, 'coding'],
  ['Write', { file_path: 'scratchpad/tide-table.html' }, true, 'designing'],
  ['Edit', { file_path: 'site/index.htm' }, true, 'designing'],
  ['Write', { file_path: 'z.xhtml' }, true, 'designing'],
  ['Write', { file_path: 'z.xhtml' }, false, 'coding'],
  ['Write', { file_path: 'config.json' }, false, 'coding'],
  ['NotebookEdit', { notebook_path: 'a.md' }, false, 'coding'],
  ['Artifact', { action: 'quickstart' }, false, 'designing'],
  ['Artifact', { action: 'publish' }, false, 'sharing'],
  ['Artifact', { file_path: 'page.html' }, false, 'sharing'],
  ['Artifact', undefined, false, 'sharing'],
  ['Skill', { skill: 'artifact-design' }, false, 'designing'],
  ['Skill', { skill: 'artifact-diagramming' }, false, 'designing'],
  ['Skill', { skill: 'Diagrams' }, false, 'designing'],
  ['Skill', { skill: 'code-review' }, false, 'skill'],
  ['Skill', undefined, false, 'skill'],
  ['DesignSync', undefined, false, 'designing'],
  ['mcp__figma__get_file', undefined, false, 'designing'],
  ['mcp__x__designer', undefined, false, 'designing'],
  ['Grep', undefined, false, 'searching'],
  ['mcp__Claude_Browser__navigate', undefined, false, 'web'],
  ['mcp__claude-in-chrome__navigate', undefined, false, 'web'],
  ['mcp__chrome__click', undefined, false, 'web'],
  ['mcp__terminal__read_terminal', undefined, false, 'terminal'],
  ['mcp__atlassian__searchJiraIssuesUsingJql', undefined, false, 'searching'],
  ['mcp__x__get_query_results', undefined, false, 'searching'],
  ['mcp__x__queryDb', undefined, false, 'searching'],
  ['mcp__x__Find', undefined, false, 'searching'],
  ['mcp__x__findings', undefined, false, 'searching'],
  ['SearchSkills', undefined, false, 'searching'],
  ['mcp__atlassian__getJiraIssue', undefined, false, 'reading'],
  ['mcp__docs__read', undefined, false, 'reading'],
  ['mcp__x__list_items', undefined, false, 'reading'],
  ['mcp__x__view', undefined, false, 'reading'],
  ['mcp__x__fetchThing', undefined, false, 'reading'],
  ['mcp__visualize__show_widget', undefined, false, 'sharing'],
  ['mcp__x__openTab', undefined, false, 'sharing'],
  ['mcp__x__render', undefined, false, 'sharing'],
  ['mcp__x__display', undefined, false, 'sharing'],
  ['mcp__atlassian__createJiraIssue', undefined, false, 'tool'],
  ['mcp__server__thing', undefined, false, 'tool'],
  ['mcp__x__upload', undefined, false, 'tool'],
  ['SomeTool', undefined, false, 'tool'],
  ['ReportFindings', undefined, false, 'sharing'],
  ['TaskStop', undefined, false, 'terminal'],
  ['KillShell', undefined, false, 'terminal'],
  ['TaskList', undefined, false, 'planning'],
  ['EnterWorktree', undefined, false, 'git'],
  ['ReadNotifications', undefined, false, 'reading'],
  ['NotebookRead', undefined, false, 'reading'],
  ['Monitor', undefined, false, 'waiting'],
  ['Workflow', undefined, false, 'delegating'],
  ['SendMessage', undefined, false, 'delegating'],
  ['LS', undefined, false, 'searching'],
  // 13. Memory files ignore case.
  ['Edit', { file_path: '/a/claude.md' }, false, 'memory'],
  ['Edit', { file_path: '/r/memory.md' }, false, 'memory'],
  ['Write', { file_path: '/a/Memory/notes.txt' }, false, 'memory'],
  ['Write', { file_path: 'Claude.MD' }, false, 'memory'],
]

const BUILT_IN: Readonly<Record<string, SceneId>> = {
  Read: 'reading',
  NotebookRead: 'reading',
  ReadMcpResourceTool: 'reading',
  ListMcpResourcesTool: 'reading',
  ReadMcpResourceDirTool: 'reading',
  ReadNotifications: 'reading',
  FetchInboxMessage: 'reading',
  Skill: 'skill',
  Edit: 'coding',
  MultiEdit: 'coding',
  Write: 'coding',
  NotebookEdit: 'coding',
  Bash: 'terminal',
  KillShell: 'terminal',
  TaskStop: 'terminal',
  BashOutput: 'waiting',
  TaskOutput: 'waiting',
  Monitor: 'waiting',
  ScheduleWakeup: 'waiting',
  CronCreate: 'waiting',
  CronList: 'waiting',
  CronDelete: 'waiting',
  Grep: 'searching',
  Glob: 'searching',
  LS: 'searching',
  ToolSearch: 'searching',
  ListSkills: 'searching',
  ListPlugins: 'searching',
  ListAgents: 'searching',
  WebFetch: 'web',
  WebSearch: 'web',
  Agent: 'delegating',
  Task: 'delegating',
  Workflow: 'delegating',
  SendMessage: 'delegating',
  AskUserQuestion: 'asking',
  TodoWrite: 'planning',
  TaskCreate: 'planning',
  TaskUpdate: 'planning',
  TaskList: 'planning',
  TaskGet: 'planning',
  EnterPlanMode: 'planning',
  ExitPlanMode: 'planning',
  Artifact: 'sharing',
  SendUserFile: 'sharing',
  PushNotification: 'sharing',
  ReportFindings: 'sharing',
  SuggestSkills: 'sharing',
  SuggestPluginInstall: 'sharing',
  EnterWorktree: 'git',
  ExitWorktree: 'git',
}

describe('tools', () => {
  test('every tool of the other-tools table shows its scene', () => {
    for (const [tool, args, flag, scene] of TOOLS) {
      expect(classifyTool(tool, args, flag), `${tool} ${JSON.stringify(args)} flag ${String(flag)}`).toBe(scene)
    }
  })

  test('the built-in table, by name alone', () => {
    for (const [tool, scene] of Object.entries(BUILT_IN)) expect(classifyTool(tool), tool).toBe(scene)
  })

  test('the built-in table matches names exactly', () => {
    expect(classifyTool('read')).toBe('reading') // by the name heuristics, not the table
    expect(classifyTool('bash')).toBe('tool')
    expect(classifyTool('agent')).toBe('tool')
  })

  test('web pages need design work in the turn', () => {
    for (const file of ['x.html', 'y.htm', 'z.xhtml']) {
      expect(classifyTool('Write', { file_path: file }, true)).toBe('designing')
      expect(classifyTool('Write', { file_path: file }, false)).toBe('coding')
    }
    expect(classifyTool('Write', { file_path: 'notes.md' }, true)).toBe('writing')
    expect(classifyTool('Edit', { file_path: 'App.tsx' }, true)).toBe('coding')
  })

  test('what takes up design work', () => {
    expect(takesUpDesignWork('Skill', { skill: 'artifact-design' })).toBe(true)
    expect(takesUpDesignWork('Skill', { skill: 'artifact-diagramming' })).toBe(true)
    expect(takesUpDesignWork('Artifact', { action: 'quickstart' })).toBe(true)
    expect(takesUpDesignWork('mcp__figma__get_file', {})).toBe(true)
    expect(takesUpDesignWork('Skill', { skill: 'code-review' })).toBe(false)
    expect(takesUpDesignWork('Edit', { file_path: 'app.css' })).toBe(false)
    expect(takesUpDesignWork('Bash', { command: "sed -i '' 's/a/b/' theme.css" })).toBe(false)
    expect(takesUpDesignWork('Artifact', { file_path: 'page.html' })).toBe(false)
    expect(takesUpDesignWork('Artifact', { action: 'publish' })).toBe(false)
  })

  test('the handback calls', () => {
    expect(isHandback('SubagentHandback')).toBe(true)
    expect(isHandback('StructuredOutput')).toBe(true)
    expect(isHandback('Read')).toBe(false)
  })
})

describe('file kinds', () => {
  test('memory before prose, prose, looks, pages', () => {
    expect(fileKind('/repo/CLAUDE.md')).toBe('memory')
    expect(fileKind('CLAUDE.md')).toBe('memory')
    expect(fileKind('/a/memory/x.png')).toBe('memory')
    expect(fileKind('/r/notmemory.md')).toBe('prose')
    expect(fileKind('/repo/README.md')).toBe('prose')
    expect(fileKind('docs/CHANGELOG')).toBe('prose')
    expect(fileKind('paper.TEX')).toBe('prose')
    expect(fileKind('a.Sass')).toBe('looks')
    expect(fileKind('index.HTML')).toBe('page')
    expect(fileKind('README.json')).toBe('other')
    expect(fileKind('src/main.rs')).toBe('other')
  })
})
