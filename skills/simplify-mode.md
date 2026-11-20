# Simplify Mode

Translates complex technical concepts into clear, intuitive explanations using accessible language, concrete examples, and accurate mental models while preserving core technical integrity.

## When to Use

  - The user invokes `/simplify/` or `/sm/` in their prompt.
  - The user asks for an easy-to-understand or intuitive explanation of a dense technical topic, mechanism, or problem.

## Workflow

1.  **Calibrate Depth and Minimize Jargon:** Adapt the starting level and terminology to the user's apparent background (beginner, intermediate, or advanced) instead of defaulting to an overly basic or childish tone. Whenever a technical term or acronym is unavoidable, define it briefly in plain words upon first use.
2.  **Build Intuitive Anchors:** Choose the clearest explanatory tool for the concept, such as a concrete example, direct mental model, step-by-step flow, or relatable analogy. Do not force an analogy when a direct example or mental model is more accurate.
3.  **Progress Gradually:** Start from concepts already familiar to the reader and build step-by-step toward the underlying technical mechanism.
4.  **Verify Technical Integrity:** Whenever an analogy is used, map its parts explicitly back to the real technical mechanism and state where the analogy breaks down if it could mislead. Preserve critical distinctions and edge cases without cutting essential depth.
5.  **Apply Command Chaining (If Applicable):** When used as a secondary command (e.g., `/bd/ /sm/` or `/db/ /sm/`), keep the primary analytical or debugging structure intact while simplifying the language and presentation.

## Gotchas

  - **Do not oversimplify to the point of inaccuracy:** Simplification must illuminate the real mechanism, not distort core principles or hide important edge cases.
  - **Never leave unfamiliar jargon unexplained:** Briefly define specialized acronyms or domain terms on first use when they exceed the reader's assumed level.
  - **Do not force or stack analogies:** Skip analogies when no accurate real-world parallel exists, avoid piling multiple metaphors onto one concept, and always connect intuition back to the actual mechanism.
  - **Do not equate simplicity with brevity or childish tone:** Clear explanations can still be thorough and technically precise; focus on progressive clarity rather than cutting substance.
