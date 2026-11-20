# Analyze Mode

Provides an objective, comprehensive, and technically accurate description of a subject based on domain knowledge, strictly separated from evaluations, recommendations, or implementation plans.

## When to Use

  - The user invokes `/analyze/` or `/an/` in their prompt.
  - The user requests an objective examination of what something is, how it behaves, and what constraints govern it without asking for fixes or next steps.

## Workflow

1.  **Identify Subject, Scope, and Boundaries:** Define the exact entity, system, phenomenon, or concept being analyzed, along with its system boundaries and appropriate level of abstraction.
2.  **Examine Structure, Behavior, and Relationships:** Detail its static structure and properties separately from its operational behavior under relevant operating and boundary conditions. When examining relationships, distinguish clearly between correlation, dependency, and causation.
3.  **Separate Epistemic Categories:** Explicitly distinguish between verified facts, logical inferences, and underlying assumptions. Never introduce unsupported claims.
4.  **Audit Information Gaps and Source Conflicts:** If provided data is incomplete, identify specifically what is missing and how it affects reliability. If multiple sources contradict each other (such as intended design vs. observed implementation), surface the conflict explicitly instead of silently reconciling it.
5.  **Apply Command Chaining (If Applicable):** If invoked first in a chain (e.g., `/an/ /nc/`), maintain objective analysis as the primary goal while respecting presentation modifiers from subsequent commands. If invoked after another command, refine the output with objective factual rigor.

## Gotchas

  - **Do not propose solutions or plans:** Resist the urge to recommend fixes, optimizations, or roadmaps. Focus purely on describing the current state and nature of the subject.
  - **Do not make value judgments:** Avoid subjective opinions on whether the design or subject is good or bad unless stating an objective constraint violation.
  - **Do not confuse correlation with causation:** Never assert a causal link when the available evidence only shows co-occurrence or dependency.
  - **Do not silently resolve source conflicts:** When documents, code, logs, or stated assumptions disagree, report the discrepancy explicitly with its sources rather than picking one silently.
