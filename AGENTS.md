<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Mokuren Tea — project rules

These rules apply to application code and shared packages throughout this monorepo.

## Git actions

- Create Git commits only when the user explicitly requests a commit.
- Push to a remote repository only when the user explicitly requests a push. A request to commit does not authorize a push, and a request to push does not authorize creating a commit.

## Code organization

- Prefer clear, direct code over unnecessary abstraction.
- Do not introduce generic clients, utilities, or abstraction layers for a single use case.
- Extract a function or component when it improves readability, reuse, testability, or separates a real responsibility.
- Do not split related logic into many tiny wrappers that make the execution flow harder to follow.

## Naming

- Use `kebab-case` for application source file and folder names. In the backend, append architectural roles with a dot: `products.module.ts`, `products.service.ts`, `create-product.dto.ts`. See [backend module conventions](apps/backend/docs/modules.md). Standard tool, framework, documentation, and configuration filenames are exempt.
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

- Prefer truthiness checks for presence or absence: use `if (alt)` for a present value and `if (!alt)` for a missing or empty value.
- Avoid explicit comparisons with `undefined` or `null` unless the logic must distinguish them from other falsy values such as `''`, `0`, or `false`.
- Preserve the condition's intent: `alt !== undefined` checks for a defined value, while `!alt` checks for a falsy value; do not mechanically replace one with the other.
- Prefer `||` over `??` for fallback values when both have the same intended behavior. For example, use `adminId || null` when an empty ID should also count as absent.
- Keep `??` when valid falsy values such as `0`, `false`, or `''` must be preserved. Before replacing an existing `??`, check the possible inputs and validation behavior; do not mask invalid falsy inputs with a fallback or change behavior merely for stylistic consistency.
- Always use braces for `if`, `else if`, and `else` bodies, including single statements and early returns.
- Put each body on separate lines inside its braces. Do not write one-line conditional statements, even with braces.

```ts
if (a === 1) {
  runPrimaryAction()
} else {
  runFallbackAction()
}
```
