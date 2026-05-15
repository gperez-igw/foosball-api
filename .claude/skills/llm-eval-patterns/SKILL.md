---
name: llm-eval-patterns
description: >-
  Evaluation patterns for LLM applications: golden datasets, eval rubrics
  (LLM-as-judge and deterministic), A/B comparison between prompt or model
  versions, regression detection, and CI integration. Use when measuring
  prompt or agent quality, not when designing the prompt itself.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [prompt-engineer, qa]
  triggers:
    - project has evals/ or .agentflow/evals/ directory
    - briefing declares LLM components as production-critical
    - request involves measuring prompt or model output quality
  skip_when:
    - one-shot script, not a versioned product
    - no LLM in the stack
---

# Skill: llm-eval-patterns

Specialization in **measuring** LLM application quality. Pairs with `prompt-design`
(authoring) and `ai-testing` (mocking infrastructure).

## When to use

- Prompt-Engineer: every prompt revision must produce or update an eval set
- QA: when running eval suites as part of milestone gate
- Architect: when defining acceptance criteria for an LLM feature

## When NOT to use

- Mocking model calls for deterministic unit tests → use `ai-testing`
- Authoring or rewording a prompt → use `prompt-design`
- Generic test execution → use `run-tests`

## Reference resources

| Topic | URL |
|-------|-----|
| Anthropic evals cookbook | https://github.com/anthropics/anthropic-cookbook |
| OpenAI evals framework | https://github.com/openai/evals |
| Pydantic AI evals | https://pydantic.dev/docs/ai/evals |
| LangSmith evaluation | https://docs.langchain.com/langsmith/evaluation-concepts |
| Inspect AI (UK AISI) | https://inspect.ai-safety-institute.org.uk/ |

Evals frameworks vary by stack — pick one that's idiomatic for the project.
This skill captures patterns that hold across frameworks.

---

## Patterns

### 1. Golden dataset construction

#### 1.1 JSONL with explicit schema

**When to use:** Any structured eval set.

```jsonl
{"id": "ex_001", "input": "Charged twice for 12345678", "expected": {"category": "billing", "account_id": "12345678"}, "category": "golden", "source": "prod_ticket_4823"}
{"id": "ex_002", "input": "App crashes on export", "expected": {"category": "technical", "account_id": null}, "category": "golden", "source": "manual"}
{"id": "ex_003", "input": "Charged 12345678 dollars", "expected": {"category": "billing", "account_id": null}, "category": "edge", "source": "bug_report_2024_11_03"}
```

**Why:** JSONL is line-addressable (one example per line), diff-friendly, and
streamable. Explicit `category` and `source` fields make the matrix and
provenance visible.

**Anti-pattern:** YAML-with-nested-arrays datasets — hard to diff, hard to stream,
hard to grep.

#### 1.2 Coverage matrix

**When to use:** Designing a new eval set.

```markdown
## Coverage matrix
| Category    | Count | Source                          |
|-------------|-------|---------------------------------|
| golden      | 30    | prod tickets, sampled by volume |
| edge        | 15    | bug reports + manually crafted  |
| adversarial | 10    | prompt-injection attempts       |
| regression  | 5     | one per fixed bug               |
```

**Why:** Forcing a category breakdown reveals gaps before they bite in prod.
"How many adversarial examples do we have?" should have a fast answer.

**Anti-pattern:** All examples from the same source (e.g., all from the
marketing demo) — model passes evals but fails prod.

#### 1.3 Provenance field

**When to use:** Always.

```jsonl
{"id": "ex_003", "source": "bug_report_2024_11_03", "added_by": "prompt-engineer", "added_at": "2026-04-22"}
```

**Why:** Every example must be traceable to *why* it's in the set. Without
provenance, no one will delete obsolete examples — the set just grows.

**Anti-pattern:** Anonymous examples that no one remembers adding.

#### 1.4 Held-out split

**When to use:** Whenever the eval set is also being used to iterate on the prompt.

```python
# datasets/
#   ticket-classifier.jsonl          (visible during iteration)
#   ticket-classifier-holdout.jsonl  (sealed; only run at milestone)
```

**Why:** Tuning a prompt against an eval set leaks the set into the prompt.
A sealed holdout catches that leak.

**Anti-pattern:** Single set used both for iteration and final gate. Overfits silently.

---

### 2. Rubric layers

#### 2.1 Deterministic check (prefer this layer first)

**When to use:** Whenever the expected output has structure.

```python
def check_ticket(actual: dict, expected: dict) -> tuple[bool, str]:
    if actual.get("category") != expected["category"]:
        return False, f"category mismatch: {actual.get('category')} != {expected['category']}"
    if actual.get("account_id") != expected["account_id"]:
        return False, f"account_id mismatch: {actual.get('account_id')} != {expected['account_id']}"
    if not isinstance(actual.get("confidence"), (int, float)):
        return False, "confidence not numeric"
    if not (0 <= actual["confidence"] <= 1):
        return False, "confidence out of range"
    return True, "ok"
```

**Why:** Deterministic checks are cheap, fast, and explain *what* failed in
plain English. Schema mismatch, range violations, missing fields — all should
be caught here before any judge runs.

**Anti-pattern:** Going straight to LLM-as-judge for a check that a `==` would handle.

#### 2.2 Heuristic check

**When to use:** When the output has soft structural expectations.

```python
def check_summary_format(text: str) -> tuple[bool, str]:
    sentences = [s for s in text.split(".") if s.strip()]
    if len(sentences) > 3:
        return False, f"too many sentences: {len(sentences)}"
    if any(c in text for c in ("•", "*", "#")):
        return False, "contains forbidden markdown"
    if len(text) > 600:
        return False, f"too long: {len(text)} chars"
    return True, "ok"
```

**Why:** Catches drift (length explosions, sneaky bullet points) without needing
a judge. Cheap to run on every example.

**Anti-pattern:** Heuristics that try to score *quality* — that's the judge's job.
Keep heuristics structural.

#### 2.3 LLM-as-judge (last resort)

**When to use:** Open-ended outputs where structural checks aren't enough.

```python
JUDGE_PROMPT = """
You are evaluating a customer support response.

Score on three dimensions, each 1-5:
- accuracy: facts match the source ticket
- tone: warm, professional, not condescending
- actionability: contains a concrete next step

Return JSON: {"accuracy": int, "tone": int, "actionability": int, "rationale": str}

Source ticket:
<ticket>{ticket}</ticket>

Response to evaluate:
<response>{response}</response>
"""

def judge(ticket: str, response: str) -> dict:
    result = judge_client.complete(JUDGE_PROMPT.format(ticket=ticket, response=response))
    return json.loads(result)
```

**Why:** When you can't write a `==` for "is this a good response?", a judge
with a concrete rubric is the next best thing. Anchor every dimension to an
observable criterion.

**Anti-pattern:** Judge prompt that says "is this good?" — produces noise.
Decompose into observable axes (accuracy, tone, format, etc.).

#### 2.4 Multi-dimensional scoring

**When to use:** When "pass/fail" hides which dimension regressed.

```python
def score(actual: dict, expected: dict) -> dict:
    return {
        "format_ok": check_schema(actual),
        "category_correct": actual["category"] == expected["category"],
        "extraction_correct": actual["account_id"] == expected["account_id"],
        "confidence_calibrated": confidence_within_band(actual, expected),
    }
```

**Why:** Aggregating to a single number throws away signal. Per-dimension
scoring exposes "category accuracy went up 5%, but account_id extraction went
down 10%" — which a single score would hide.

**Anti-pattern:** Reporting only `pass_rate=0.87` without per-dimension breakdown.

---

### 3. LLM-as-judge discipline

#### 3.1 Different judge model than generator

**When to use:** Always.

```python
GENERATOR_MODEL = "claude-sonnet-4-6"
JUDGE_MODEL = "claude-opus-4-7"   # different family / size
```

**Why:** A model evaluating itself shares biases — it gives high marks to
outputs that look like what it would have written. A different model breaks
that loop.

**Anti-pattern:** Same model + same prompt scoring its own output.

#### 3.2 Calibration against a human-labeled subset

**When to use:** Before trusting a judge for go/no-go decisions.

```markdown
## Calibration set
50 examples scored by a human (1-5 on each dimension), saved as a fixed JSONL.

## Calibration metric
For each new judge variant, compute:
- exact-match agreement with human label (per dimension)
- mean absolute error in score

Reject a judge that drops below 80% exact-match on the calibration set.
```

**Why:** Judges drift with model updates. Without a calibration check, you
don't know if a regression in eval scores is the prompt's fault or the judge's.

**Anti-pattern:** Rolling out a new judge model and assuming the scores are
comparable to the previous run.

#### 3.3 Concrete observable language in the rubric

**When to use:** Always.

```markdown
# BAD rubric
- 5: response is excellent
- 1: response is poor

# GOOD rubric
- 5: response cites the exact account_id from the ticket AND proposes a specific next action
- 4: response cites the account_id but next action is generic ("we'll look into it")
- 3: response addresses the right category but does not cite the account_id
- 2: response addresses a different category
- 1: response is empty, off-topic, or factually wrong
```

**Why:** Concrete anchors produce stable inter-run scores. Vague anchors
produce noise.

**Anti-pattern:** Rubric written in adjectives ("good", "clear", "helpful").

#### 3.4 Avoid self-judging in production gates

**When to use:** When the eval result blocks deploy.

**Why:** Self-judge bias inflates pass rates by 10-30% in published research.
For production gates, use a different model and ideally a different vendor.

**Anti-pattern:** Same-model judge in a CI gate.

---

### 4. A/B comparison

#### 4.1 Pairwise scoring

**When to use:** Comparing two prompt or model versions on the same inputs.

```python
def pairwise_judge(input_: str, output_a: str, output_b: str) -> str:
    # Randomize order to remove position bias
    if random.random() < 0.5:
        first, second, swapped = output_a, output_b, False
    else:
        first, second, swapped = output_b, output_a, True

    prompt = f"""
    Input: <input>{input_}</input>
    Response 1: <r1>{first}</r1>
    Response 2: <r2>{second}</r2>

    Which is better? Reply with exactly "1", "2", or "tie".
    """
    result = judge.complete(prompt).strip()
    if swapped:
        result = {"1": "2", "2": "1", "tie": "tie"}[result]
    return result   # always in terms of A/B
```

**Why:** Pairwise is more sensitive than absolute scoring for small deltas, and
order randomization removes the "first one wins" bias.

**Anti-pattern:** Pairwise without order randomization — judge's position bias
dominates the signal.

#### 4.2 Stratified sampling across categories

**When to use:** When the eval set is heterogeneous.

```python
# Don't average over all categories — stratify
results_by_category = defaultdict(list)
for ex in dataset:
    results_by_category[ex["category"]].append(run_eval(ex))

for cat, results in results_by_category.items():
    pass_rate = sum(r["pass"] for r in results) / len(results)
    print(f"{cat}: {pass_rate:.2%} ({len(results)} examples)")
```

**Why:** Aggregating golden + adversarial together hides regressions in the
small-but-critical adversarial subset.

**Anti-pattern:** Single pass-rate number across mixed categories.

#### 4.3 Effect-size threshold

**When to use:** Deciding whether an A/B delta is meaningful.

```python
# Don't ship a change for a +0.5% absolute delta on 50 examples
SHIP_THRESHOLD = 0.03    # +3% absolute on the golden set
MIN_EXAMPLES = 100       # minimum dataset size for the threshold to apply

if (b_score - a_score) >= SHIP_THRESHOLD and len(dataset) >= MIN_EXAMPLES:
    print("ship B")
else:
    print("insufficient evidence to ship B")
```

**Why:** Small dataset + small delta = noise. Set an effect-size threshold up
front so you don't fool yourself.

**Anti-pattern:** Shipping based on a p-value computed on 30 examples.

---

### 5. Regression detection

#### 5.1 Diff-based eval (current vs last release)

**When to use:** Every milestone.

```bash
python -m evals.run ticket-classifier --version=current > runs/current.jsonl
python -m evals.diff runs/last-release.jsonl runs/current.jsonl

# Output highlights:
# - examples that PASSED in last release but FAIL now (regressions)
# - examples that FAILED in last release but PASS now (improvements)
# - examples that still FAIL (known issues, not regressions)
```

**Why:** Aggregate scores hide which *specific* examples regressed. Per-example
diffs make the regression list actionable.

**Anti-pattern:** "Score went from 0.87 to 0.85, must investigate" — without
knowing which 2 examples regressed, the investigation is a fishing trip.

#### 5.2 Per-category regression tracking

**When to use:** Reporting eval results.

```markdown
## Run 2026-05-11 (prompt v1.4.0)

| Category     | Pass | Total | Δ vs v1.3.0 |
|--------------|------|-------|-------------|
| golden       | 28   | 30    | +1          |
| edge         | 13   | 15    | +2          |
| adversarial  | 7    | 10    | -1          |  ← regression
| regression   | 5    | 5     | 0           |

Investigate: 1 adversarial regression (ex_042 — prompt-injection variant)
```

**Why:** A single example dropping in `adversarial` is a security regression
worth blocking the release. Same example dropping in `golden` is annoying but
recoverable.

**Anti-pattern:** Only reporting the overall pass rate.

#### 5.3 Failure-mode taxonomy

**When to use:** Reporting failures.

```python
def classify_failure(actual: dict, expected: dict) -> str:
    if not isinstance(actual, dict):
        return "format"
    if actual.get("category") != expected["category"]:
        if actual.get("category") == "escalate":
            return "over_eager_escalate"
        return "category_wrong"
    if actual.get("account_id") and not expected["account_id"]:
        return "hallucinated_account_id"
    if not actual.get("account_id") and expected["account_id"]:
        return "missed_account_id"
    return "other"
```

**Why:** Tagging each failure with a mode lets you say "we fixed 4 of 5
hallucinations but introduced 1 new format error" — actionable detail.

**Anti-pattern:** Counting failures without classifying them.

---

### 6. CI integration

#### 6.1 Milestone gate, not per-commit

**When to use:** Setting up CI for LLM evals.

```yaml
# .github/workflows/eval.yml
on:
  push:
    branches: [main]
  pull_request:
    types: [closed]    # only on merge — not on every commit

jobs:
  eval:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - run: python -m evals.run --suite=milestone
```

**Why:** Each eval run costs money + latency. Per-commit runs blow the budget
without catching anything per-PR runs miss.

**Anti-pattern:** Eval suite running on every push to every branch.

#### 6.2 Cost cap

**When to use:** Always.

```python
# evals/run.py
MAX_USD = 5.00

total_cost = 0.0
for ex in dataset:
    cost = run_one(ex)
    total_cost += cost
    if total_cost > MAX_USD:
        print(f"COST CAP EXCEEDED at {total_cost:.2f}, stopping")
        sys.exit(2)
```

**Why:** A runaway eval (loop, infinite retry, huge dataset) can cost
hundreds in minutes. Hard cap prevents bill surprises.

**Anti-pattern:** Trusting the dataset size to keep cost bounded.

#### 6.3 Result report file

**When to use:** Every eval run.

```markdown
# .agentflow/evals/runs/2026-05-11-ticket-classifier-1.4.0.md

## Summary
- Prompt: ticket-classifier v1.4.0
- Generator: claude-sonnet-4-6
- Judge: claude-opus-4-7
- Total cost: $0.42
- Pass rate: 28/30 golden, 13/15 edge, 7/10 adversarial

## Regressions vs v1.3.0
- ex_042 (adversarial): prompt-injection variant now bypasses refusal — INVESTIGATE

## Improvements vs v1.3.0
- ex_007 (edge): now correctly returns null account_id for dollar amount
```

**Why:** Eval results are PR review material. A markdown report alongside the
PR is the most reviewer-friendly format.

**Anti-pattern:** Eval results buried in CI logs that nobody reads.

---

## Output style (prescriptive)

For every eval task, produce:
1. **Dataset file** at `evals/{name}.jsonl` (or `.agentflow/evals/{name}.jsonl`) — see §1.1
2. **Rubric** as code or as a judge prompt (paired with calibration if LLM-judge) — §2, §3
3. **Run script** — how QA / CI executes the eval — §6.2 cost cap mandatory
4. **Result report** at `.agentflow/evals/runs/{date}-{name}-{version}.md` — §6.3

## Important

- An eval without a deterministic part is suspicious. Always include at least
  one deterministic check (schema, regex, keyword) before falling back to a judge (§2.1)
- Eval datasets are versioned assets. Treat schema changes as breaking
- Never tune the prompt against the eval set used to measure it — keep a
  held-out set (§1.4)
- Judges must be calibrated against human labels before they gate releases (§3.2)
- Every eval run must include a cost cap (§6.2)
