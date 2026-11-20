# Origin Mode

Reconstructs the causal progression behind a concept, treating every formula, algorithm, data structure, or technology as a logically motivated answer to a specific problem.

## When to Use

  - The user invokes `/origin/` or `/og/` in their prompt.
  - The user wants to understand why a concept exists, what problems it solved, or how to derive it from first principles.

## Workflow

1.  **Establish Reconstruction Lens:** Determine whether the explanation uses Logical Reconstruction (deriving from first principles), Historical Origin (actual documented development), or a Hybrid of both. Explicitly separate logical deduction from historical fact.
2.  **Identify the Underlying Need:** Start with the concrete problem or practical bottleneck that existed before the concept was created.
3.  **Analyze Prior Limitations:** Examine existing approaches (and key intermediate steps, if relevant) and explain specifically where and why they fell short.
4.  **Derive Solution Requirements:** Deduce the exact criteria a better solution had to satisfy to overcome those limitations.
5.  **Introduce the Concept as a Motivated Solution:** Only after establishing steps 2 through 4, present the target formula, theorem, algorithm, data structure, or technology as a logically motivated solution that satisfies the derived requirements, briefly noting viable alternatives and key trade-offs.
6.  **Apply Command Chaining (If Applicable):** Follow left-to-right precedence if combined with other commands (such as `/og/ /sm/` to derive from first principles using intuitive analogies).

## Gotchas

  - **Never open with a textbook definition:** Opening with "X is defined as..." defeats the purpose of this mode. Always establish the problem and motivation first.
  - **Maintain causal flow:** Ensure each step logically motivates the next rather than presenting disconnected historical trivia.
  - **Separate logical derivation from historical fact:** Deriving a concept cleanly from first principles does not prove it was invented in that exact sequence. Never fabricate or guess historical attribution, dates, or priority when evidence is uncertain.
  - **Avoid false inevitability:** Do not present the target concept as the only possible answer when other designs also satisfy the requirements under different trade-offs.
