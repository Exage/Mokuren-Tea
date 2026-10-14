<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Mokuren Tea — project rules

These rules apply to application code and shared packages throughout this monorepo.

## Code organization

- Prefer clear, direct code over unnecessary abstraction.
- Do not introduce generic clients, utilities, or abstraction layers for a single use case.
- Extract a function or component when it improves readability, reuse, testability, or separates a real responsibility.
- Do not split related logic into many tiny wrappers that make the execution flow harder to follow.

## Naming

- Use `kebab-case` for application source file and folder names. Standard tool, framework, documentation, and configuration filenames are exempt.
- Prefer clear domain names over vague names such as `manager`, `processor`, or `helpers` when a more specific name exists.

## Comments

- Write code comments in English only.
- Explain non-obvious decisions, constraints, edge cases, and trade-offs.
- Do not add comments that merely repeat what the code already says.

## Documentation

- Write project documentation in English, including README files, setup guides, architecture notes, and documentation for applications and shared packages.

## Refactoring

- Preserve existing behavior unless the task explicitly requires changing it.
- Do not change public contracts, rename files, or move code without a clear reason.
- Keep changes focused on the requested task.

## Project skills

- Read existing project skills relevant to the task before working in their area.
- Add references to skills from another project only after adapting and adding them to this repository.

## Conditional statements

- Always use braces for `if`, `else if`, and `else` bodies, including single statements and early returns.
- Put each body on separate lines inside its braces. Do not write one-line conditional statements, even with braces.

```ts
if (a === 1) {
  runPrimaryAction()
} else {
  runFallbackAction()
}
```
