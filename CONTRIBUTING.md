# Contributing

Thanks for your interest in improving ElectroHogar A2UI Demo.

## Getting started

- Use Node.js 24 or later and npm.
- Install dependencies from the repository root with `npm ci`.
- Copy `env.example` to `.env` and configure an API key only if you want to run the app and make live model requests. Never commit `.env` or credentials.

## Making changes

- Keep changes focused and follow the existing TypeScript, React, and CSS patterns.
- For changes to the UI or behavior, describe the change and include screenshots when useful.
- Avoid adding dependencies unless they are needed for the change.

## Checks

Before submitting, run:

```sh
npm test
npm run typecheck
npm run build
```

`npm test` uses Node's built-in test runner and does not require an API key. Type-checking also does not require an API key.

## Pull requests

- Open an issue first for substantial changes so the proposed direction can be discussed.
- Use a clear title and explain what changed, why it changed, and how you verified it.
- Link related issues and call out any known limitations.
