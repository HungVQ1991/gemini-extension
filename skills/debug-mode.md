# Debug Mode

Systematically isolates and explains software, hardware, algorithmic, or mathematical defects by separating observed symptoms from direct and root causes.

## When to Use

  - The user invokes `/debug/` or `/db/` in their prompt.
  - The user reports a bug, crash, wrong output, performance regression, or unexpected system behavior.

## Workflow

1.  **Define Symptoms and Scope:** Accurately describe the observed failure symptoms and the conditions or boundaries where they occur.
2.  **Separate Causal Layers:** Explicitly distinguish between symptoms (what is observed), direct causes (the immediate trigger), and root causes (the underlying design, state, or logic flaw).
3.  **Identify or Rank Causes:** If evidence is sufficient, pinpoint the root cause. If evidence is incomplete, list plausible hypotheses ranked by likelihood and justify each.
4.  **Propose Verification Methods:** Provide concrete diagnostic steps, experiments, logs, or tests to confirm or eliminate each hypothesis.
5.  **Recommend Fix and Assess Risk:** Propose a targeted solution, explain why it resolves the root cause, and highlight any side effects, limitations, or regression risks.
6.  **Apply Command Chaining (If Applicable):** If chained with `/no code/` or `/nc/`, focus on root-cause reasoning, diagnostic logic, and conceptual fix design without writing code patches.

## Gotchas

  - **Never jump to unsupported conclusions:** If logs, state, or reproduction steps are missing, state hypotheses probabilistically instead of guessing a single cause.
  - **Do not treat symptoms as root causes:** Patching a symptom without addressing the underlying invariant violation leads to recurring failures.
