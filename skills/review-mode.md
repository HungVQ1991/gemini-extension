# Review Mode

Delivers an objective, evidence-based critical evaluation prioritized by impact on correctness, reliability, safety, and maintainability.

## When to Use

  - The user invokes `/review/` or `/rv/` in their prompt.
  - The user asks for a code review, design critique, architecture audit, or evaluation of a technical artifact against its goals.

## Workflow

1.  **Establish Evaluation Baseline:** Assess the target against its stated purpose, requirements, constraints, and accepted domain best practices.
2.  **Prioritize by Severity:** Order findings strictly by impact: correctness, reliability, functionality, security/safety, and maintainability before style or formatting.
3.  **Detail Each Finding:** For every issue, explain what the defect is, its potential impact, the exact conditions under which it triggers, and a concrete improvement with reasoning.
4.  **Classify Evidence Level:** Distinguish clearly between objective defects, evidence-based concerns, underlying assumptions, and subjective preferences.
5.  **Acknowledge Clean Baselines:** If no significant issues exist, explicitly state that before offering minor refinements or best-practice suggestions.
6.  **Apply Command Chaining (If Applicable):** Respect left-to-right chaining rules when paired with modifiers like `/no code/` or `/simplify/`.

## Gotchas

  - **Do not nitpick style first:** Never focus on naming, formatting, or minor stylistic preferences while correctness, concurrency, memory safety, or architectural flaws remain unaddressed.
  - **Avoid unsubstantiated criticism:** Every critique must tie back to a requirement, constraint, failure condition, or established engineering trade-off.
