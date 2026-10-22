---
name: sequential-thinking
description: Dynamic step-by-step reasoning decomposition for complex planning, architectural refactoring, and multi-step tool execution. Use whenever a goal requires high precision, multi-stage verification, or resolving ambiguities before taking irreversible actions.
---

# Sequential Thinking & Problem Decomposition

## Core Process

1. **Problem Formulation:** Break down the overarching user objective into distinct, atomic sub-goals.
2. **Hypothesis & Strategy:** Formulate an approach and explicitly identify dependencies, unknowns, and potential failure modes.
3. **Execution Steps:** For each sub-goal:
   - Identify pre-conditions and required tool calls.
   - Execute the action or calculation.
   - Verify post-conditions against expected outputs.
4. **Refinement & Course Correction:** If an intermediate step fails or returns unexpected data, pause and re-evaluate rather than compounding errors.
5. **Synthesis:** Aggregate the verified sub-goal results into a cohesive final outcome.
