# Acknowledgment

Records incoming information into the current conversation context with zero reasoning, analysis, or commentary. Designed for multi-turn context loading (source code, logs, specifications) where premature processing wastes tokens and pollutes context.

## When to Use

  - The user explicitly invokes `/ac/`, `/acknowledgment/`, or `@acknowledgment`.
  - The user explicitly states to only acknowledge or record the provided input without analyzing, summarizing, or answering it yet.

Do NOT trigger implicitly just because the user pastes large blocks of code, logs, or reference material.

## Workflow

1.  **Short-Circuit Other Skills:** This skill does not support command chaining or stacking. If any other skill or mode command appears in the same prompt (regardless of left-to-right order), bypass all other skills immediately and execute only acknowledgment.
2.  **Ingest Without Processing:** Accept the provided content into the active conversation context as-is. Do not evaluate, critique, summarize, extract insights, or solve problems contained within the input.
3.  **Emit Minimal Output Contract:** Respond in 1 to 2 lines maximum, in the language of the user's prompt. Confirm receipt in the current session context, optionally echoing only the raw identifier of the input (such as a filename, heading, or chunk label) for verification. If another skill was bypassed via short-circuiting, append a brief note naming the ignored skill.
4.  **Halt Immediately:** End the response right after the confirmation. Do not ask open-ended questions, suggest next steps, or add closing remarks.

## Examples

  - **Standard input:** `Đã ghi nhận thông tin: main.cpp.`
  - **Short-circuit with another skill (`/ac/review/`):** `Đã ghi nhận thông tin: main.cpp (đã bỏ qua /review/ do cơ chế short-circuit).`

## Gotchas

  - **No hidden summarization:** Even a brief phrase describing what the code or text does counts as reasoning and violates this skill. Stick strictly to raw identifiers or a plain acknowledgment.
  - **Session scope only:** Recording applies strictly to the current conversation context window, not persistent cross-session memory. Do not claim the data is permanently saved unless an explicit storage action was requested separately.
  - **Strict explicit-only activation:** Never auto-trigger on ambiguous prompts where the user expects an actual answer.
