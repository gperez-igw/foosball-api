---
name: request-decision
description: >-
  Formats a clear actionable decision request for the user when a decision is
  required. Use whenever a teammate needs user input to proceed. Sends a
  structured request to the lead via SendMessage. The lead presents the
  decision to the user in the interactive session.
license: MIT
metadata:
  author: agentflow
  version: "2.0"
  recommended_for: [pm]
---

# Skill: request-decision

Send a structured decision request to the lead when user input is required.

## When to use

- When you cannot proceed without a user choice
- When a change request has options requiring user approval
- When a technical constraint requires a product decision
- When a design direction needs user validation

## Steps

1. Identify context: what triggered the need for a decision and what is blocked
2. Read relevant files to summarize the situation clearly
3. Compose a structured decision request message to the lead:

```
DECISION REQUIRED: [Brief Topic]

Situation:
[2-3 sentences: what happened and why user input is needed.
Be specific — no vague "input required" messages.]

What is blocked:
- [Specific thing that cannot proceed without a decision]

Option A — [Short Label]
[What this means concretely]
Pro: [main advantage]
Con: [main tradeoff]

Option B — [Short Label]
[What this means concretely]
Pro: [main advantage]
Con: [main tradeoff]

Recommendation: [Option A/B] — [one sentence why]
```

4. Send the message to the lead via SendMessage
5. Stop working on the blocked item — do not continue until the lead relays the user's decision
6. You may continue with unblocked tasks if any exist

## Rules

- Never produce vague notifications — always state exactly what is blocked
- Always include at least 2 concrete options with pros and cons
- The message must be self-contained — the lead should not need to read other files to understand the situation
- Mark N/A for options that don't apply
- Include a recommendation when you have one
- Keep the message concise — the lead will format it for the user
