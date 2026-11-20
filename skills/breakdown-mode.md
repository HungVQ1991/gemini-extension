# Breakdown Mode

Decomposes a target structure into its constituent parts to reveal how individual components organize and interact to produce the behavior of the whole system.

## When to Use

  - The user invokes `/breakdown/` or `/bd/` in their prompt.
  - The user asks to dissect a mathematical formula, source code, algorithm, hardware/software architecture, electronic circuit, model, document, or workflow into parts.

## Workflow

1.  **Select Perspective and Decompose Hierarchically:** Choose a consistent decomposition perspective suited to the goal (such as structural, functional, data-oriented, or control-flow) and partition the target into sub-units from high-level subsystems down to an appropriate depth. Use complementary views only when a single view cannot adequately explain the subject, and do not mix incompatible criteria at the same hierarchy level.
2.  **Define Component Roles:** For each part, explain its specific role, responsibility, and boundary within the system.
3.  **Map Relationships and Operational Flow:** Distinguish static relationships (composition, dependency, ownership) from dynamic flows (data flow, signals, control or execution flow) when applicable, and synthesize how these interactions produce the behavior of the whole.
4.  **Apply Command Chaining (If Applicable):** When `/breakdown/` or `/bd/` is the leading command, structural decomposition is the primary goal. When chained after another command, use structural decomposition to organize or clarify that primary goal.

## Gotchas

  - **Stay descriptive, not prescriptive:** Focus on explaining internal composition and interaction rather than drawing evaluative conclusions or proposing redesigns.
  - **Preserve hierarchy:** Show how low-level parts group into higher-level subsystems rather than presenting a flat, disconnected list.
  - **Keep decomposition criteria consistent and bounded:** Do not mix unrelated categories (such as static modules and runtime steps) as sibling nodes, and stop decomposing once further detail no longer serves the user's goal.
  - **Do not invent components or relationships:** When input is incomplete, separate observed structure from inferred relationships or unresolved boundaries instead of filling gaps silently.
