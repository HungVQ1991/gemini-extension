# Brainstorm Mode

Generate high-quality, context-grounded ideas from available information, focusing on genuinely distinct mechanisms or superior implementations of established concepts rather than generic filler.

## When to Use

  - The user invokes `/brainstorm/` or `/br/` in their prompt.
  - The user asks to brainstorm ideas, explore alternative mechanisms, or propose creative improvements based on existing code, architecture, or notes.

## Workflow

1.  **Audit Available Context & Constraints:** Inspect all provided code, architectures, requirements, and constraints to identify underutilized assets, bottlenecks, and unspoken assumptions. If critical context is missing or the problem space is too underspecified to ground meaningful ideas, stop and explicitly inform the user what information is needed instead of guessing.

2.  **Define Novelty Broadly (Mechanism & Execution):** Treat an idea as genuinely new if it either introduces a distinct operating principle or adapts an established pattern with a significantly cleaner, higher-leverage implementation tailored to the user's specific constraints. Reject superficial variations of the same approach.

3.  **Prioritize Quality Over Quota (No Lower Bound):** Enforce no minimum number of ideas. Present only ideas that clear a high bar for technical feasibility, concrete value, and non-obviousness within the given context - even if only one or two strong ideas qualify. If no genuinely novel or worthwhile ideas emerge beyond what already exists, explicitly state this to the user rather than padding the list.

4.  **Structure Each Qualified Idea:** For every idea that passes the quality bar, present:

      - **Core Concept & Mechanism:** How it works and why it qualifies as a novel approach or superior implementation.
      - **Context Leverage:** Which existing components, APIs, data structures, or constraints it builds upon.
      - **Key Advantages & Trade-offs:** Concrete gains paired with honest costs, risks, or edge cases.

5.  **Apply Command Chaining (If Applicable):** Respect left-to-right chaining rules when paired with modifiers such as `/no code/`, `/analyze/`, `/review/`, or `/plan/`.

## Gotchas

  - **Never pad to hit an arbitrary count:** Having zero or one strong idea is strictly better than diluting the output with generic textbook suggestions.
  - **Do not conflate "novel" with "exotic":** Well-known engineering patterns (such as state machines, caching layers, or shader uniforms) count as high-value new ideas when applied to solve a specific friction point in the user's existing setup in a markedly better way.
  - **Be candid when context is insufficient:** If the user asks to brainstorm without providing the target artifact, goal, or constraints, ask for the missing details upfront.
  - **Keep implementation code minimal unless requested:** Focus on ideation, mechanisms, and architectural trade-offs; if chained with `/no code/` or `/nc/`, suppress all source code blocks completely.
