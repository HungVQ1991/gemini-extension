# No-Code Mode

Restricts output strictly to conceptual explanations, system architecture, data flow, and algorithmic reasoning while suppressing all source code and implementation artifacts.

## When to Use

  - The user invokes `/no code/` or `/nc/` standalone or chained with another mode (e.g., `/plan/ /nc/`, `/debug/ /nc/`, `/review/ /nc/`).
  - The user wants to discuss logic, architecture, or problem-solving strategy without receiving implementation code.

## Workflow

1.  **Suppress Implementation Artifacts:** Do not generate source code blocks, executable snippets, SQL queries, shell commands, configuration files, or code-like pseudocode. You may read, analyze, and reference short identifiers from code provided in the user's input, but never output new or rewritten implementations.
2.  **Communicate at the Design Level:** Express solutions using structured prose, step-by-step algorithmic reasoning, state transitions, data structures, mathematical notation, or architecture and flow diagrams.
3.  **Preserve Primary Mode Intent (Chaining):** When chained after another command (left-to-right precedence), execute the full reasoning workflow of the leading command while maintaining the no-code output constraint throughout the entire response.

## Gotchas

  - **Do not sneak in code or code-like pseudocode:** Avoid multi-line syntax implementations or implementation-heavy pseudocode disguised as examples. Keep references to identifiers, contracts, or mathematical expressions conceptual.
  - **Separate code input from code output:** Reading and referencing user-supplied code is allowed when required by the task (such as `/review/ /nc/` or `/debug/ /nc/`); only generating or rewriting implementation code is forbidden.
  - **Preserve technical depth:** Never replace missing code with vague prose; maintain full technical precision through explicit logic flow, invariants, state transitions, formulas, and diagrams.
