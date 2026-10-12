# nukey-kit

A [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) starring **Nukey**, a little microwave that keeps you company while Claude works.

![Nukey above the prompt, acting out what Claude is doing](plugins/nukey/assets/demo-scenes.svg)

## Get started

```bash
claude plugin marketplace add arifamir/nukey
claude plugin install nukey@nukey-kit
```

Want updates as they ship? Open `/plugin`, go to **Marketplaces**, choose `nukey-kit` and turn on **auto-update**.

## What's inside

| Plugin | What it does |
| :- | :- |
| [`nukey`](plugins/nukey) | A microwave pet above the prompt that acts out what Claude is doing, goes DING! when it's done, and shows a meter for context and rate limits, in five colour themes |

## Development

See [CLAUDE.md](CLAUDE.md) for the working rules. To redraw nukey's README images after changing its art, run `npx -y tsx@4.23.15 scripts/render-demo.mts` from the repository root.

## License

[MIT](LICENSE). An unofficial community project, not affiliated with or endorsed by Anthropic.
