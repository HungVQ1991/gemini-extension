# Plan Mode

Converts an objective into a practical, dependency-ordered execution roadmap with clear milestones, decision gates, risk mitigation, and trade-off analysis.

## When to Use

  - The user invokes `/plan/` or `/pl/` in their prompt.
  - The user needs a structured sequence of steps to build a system, solve a multi-stage problem, or execute a project.

## Workflow

1.  **Establish Scope and Baseline:** Define the end goal, constraints, available resources, and success criteria. Explicitly state any assumptions made due to missing information.
2.  **Structure into Phases, Tasks, and Decision Gates:** Group work into major phases and milestones before breaking them down into actionable tasks at an appropriate granularity. Insert explicit decision gates where high-impact choices or unverified assumptions determine the next direction.
3.  **Specify Step Contracts:** For each step, define its objective, required inputs, expected outputs, and the exit condition required to proceed. Ensure the final phase validates the overall outcome against the original success criteria.
4.  **Order by Dependency and Parallelism:** Sequence tasks strictly by technical dependencies (prerequisites first) rather than perceived importance. Prioritize early validation spikes to reduce high-impact uncertainty, identify independent branches that can run in parallel within resource limits, and highlight bottlenecks or the critical path when duration data is available.
5.  **Assess Risks and Trade-offs:** Identify primary risks, failure causes, and mitigation strategies for each phase. When multiple implementation paths exist, compare their trade-offs objectively so the user can choose.
6.  **Apply Command Chaining (If Applicable):** When paired with `/no code/` or `/nc/`, keep the entire plan at the architectural and procedural level without writing implementation code.

## Gotchas

  - **Avoid premature optimization:** Do not over-specify low-level details when high-level requirements remain uncertain.
  - **Respect dependencies:** Never place a task before its required inputs or foundational setup steps are complete.
  - **Do not invent estimates or assume unlimited resources:** Never fabricate durations, budgets, or effort estimates without basis, and do not schedule tasks in parallel if available resources or capacity cannot support it.
  - **Distinguish task completion from objective achievement:** Completing all tasks does not guarantee the goal is met; always tie final exit criteria back to the original success criteria.
  - **Preserve valid completed work when revising a plan:** When updating an existing roadmap due to new constraints or changes, update only affected phases and dependencies instead of discarding still-valid completed work.
