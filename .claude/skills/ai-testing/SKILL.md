---
name: ai-testing
description: >-
  Testing infrastructure for code that calls LLMs: deterministic mocking,
  recorded replay (cassettes), fake model implementations, tool-call
  fixtures, and assertion patterns for non-deterministic outputs. Use for
  unit/integration tests of AI code — NOT for quality evaluation
  (use llm-eval-patterns).
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [qa, ai-engineer, code-reviewer]
  triggers:
    - source code calls LLM APIs (Anthropic, OpenAI, etc.)
    - source code uses langgraph / pydantic-ai / agent SDKs
    - tests need to assert on LLM-driven behavior
  skip_when:
    - no LLM calls in the code under test
    - measuring quality (use llm-eval-patterns instead)
---

# Skill: ai-testing

Specialization in **deterministic testing of non-deterministic code**.
Pairs with `llm-eval-patterns` (quality measurement) and `run-tests` (general execution).

## When to use

- QA: when writing or extending tests for AI code paths
- AI-Engineer: when adding tests alongside new agent/graph code
- Code-Reviewer: when reviewing AI code for missing test isolation

## When NOT to use

- Measuring prompt or output quality → use `llm-eval-patterns`
- Tests of non-AI code → use `run-tests` and stack-specific patterns
- Generic API mocking unrelated to LLM responses → standard test patterns

## Reference resources

| Topic | URL |
|-------|-----|
| Pydantic AI testing | https://pydantic.dev/docs/ai/testing |
| Pydantic AI TestModel | https://pydantic.dev/docs/ai/api/models/test |
| Pydantic AI FunctionModel | https://pydantic.dev/docs/ai/api/models/function |
| LangChain fake LLMs | https://python.langchain.com/docs/integrations/llms/fake |
| LangGraph testing patterns | https://docs.langchain.com/oss/python/langgraph/common-errors |
| VCR.py (cassette library) | https://vcrpy.readthedocs.io/ |
| pytest-recording | https://github.com/kiwicom/pytest-recording |

---

## Patterns

### 1. Mock model implementations

#### 1.1 Pydantic AI `TestModel` for default behavior

**When to use:** Most unit tests of Pydantic AI agents — you just need a
plausible response, not specific content.

```python
import pytest
from pydantic_ai import Agent, models
from pydantic_ai.models.test import TestModel

agent = Agent("anthropic:claude-sonnet-4-6", output_type=Ticket)

@pytest.fixture(autouse=True)
def disable_real_calls():
    models.ALLOW_MODEL_REQUESTS = False
    yield
    models.ALLOW_MODEL_REQUESTS = True

def test_classify_returns_valid_ticket():
    with agent.override(model=TestModel()):
        result = agent.run_sync("Charged twice on 12345678")
    assert isinstance(result.output, Ticket)   # schema enforced
```

**Why:** `TestModel` introspects the agent's `output_type` and returns a valid
instance with placeholder fields. Perfect for testing wiring and schema
contracts without committing to specific content.

**Anti-pattern:** Hand-rolling fake response objects when `TestModel` would
auto-generate one.

#### 1.2 Pydantic AI `FunctionModel` for specific responses

**When to use:** Tests that need to control exactly what the model "says".

```python
from pydantic_ai.models.function import FunctionModel, AgentInfo
from pydantic_ai.messages import ModelMessage, ModelResponse, TextPart

def canned_response(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    return ModelResponse(parts=[TextPart('{"category": "billing", "account_id": "12345678"}')])

def test_classify_billing():
    with agent.override(model=FunctionModel(canned_response)):
        result = agent.run_sync("Charged twice on 12345678")
    assert result.output.category == "billing"
    assert result.output.account_id == "12345678"
```

**Why:** `FunctionModel` takes a function that produces responses — letting you
script specific outputs, tool calls, or multi-turn sequences.

**Anti-pattern:** Using `TestModel` and then trying to "guess" what fields it
generated — use `FunctionModel` when content matters.

#### 1.3 LangChain `FakeListLLM` for ordered responses

**When to use:** Testing LangChain / LangGraph chains where you can predict the
sequence of LLM calls.

```python
from langchain_core.language_models.fake import FakeListLLM

llm = FakeListLLM(responses=[
    "first call response",
    "second call response",
])
# After 2 calls, FakeListLLM raises — exposing unexpected extra calls
```

**Why:** Index-based fake exposes accidental extra LLM calls (silent budget burn).

**Anti-pattern:** `FakeListLLM(responses=["x"] * 100)` — defeats the purpose
of catching extra calls.

#### 1.4 LangGraph: combine fake LLM + `MemorySaver`

**When to use:** Testing LangGraph state machines without real model + without
real persistence.

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage

def build_test_graph():
    llm = FakeMessagesListChatModel(responses=[AIMessage(content="ok")])

    def node(state):
        resp = llm.invoke(state["messages"])
        return {"messages": [resp]}

    builder = StateGraph(State)
    builder.add_node("call", node)
    builder.add_edge(START, "call")
    builder.add_edge("call", END)
    return builder.compile(checkpointer=MemorySaver())

def test_graph_runs():
    graph = build_test_graph()
    result = graph.invoke(
        {"messages": [HumanMessage(content="hi")]},
        config={"configurable": {"thread_id": "t1"}},
    )
    assert result["messages"][-1].content == "ok"
```

**Why:** `FakeMessagesListChatModel` + `MemorySaver` gives you a fully isolated,
deterministic graph run. No network, no disk.

**Anti-pattern:** SqlitSaver/PostgresSaver in unit tests — adds I/O and flake.

#### 1.5 Anthropic SDK manual response

**When to use:** Direct `anthropic` client calls (no framework).

```python
from unittest.mock import MagicMock, patch
from anthropic.types import Message, TextBlock, Usage

def fake_message(text: str) -> Message:
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        model="claude-sonnet-4-6",
        content=[TextBlock(type="text", text=text)],
        stop_reason="end_turn",
        usage=Usage(input_tokens=10, output_tokens=5),
    )

def test_summarize():
    with patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = fake_message("summary text")
        result = summarize("input text")
    assert result == "summary text"
```

**Why:** Constructing real SDK response objects (not raw dicts) keeps the test
type-safe against SDK upgrades.

**Anti-pattern:** Mocking the SDK with `MagicMock()` that returns dicts —
breaks the moment the production code accesses `.content[0].text`.

---

### 2. Cassettes (record once, replay forever)

#### 2.1 pytest-recording / VCR setup

**When to use:** Integration tests that exercise the real HTTP layer once and
then replay deterministically.

```python
import pytest

@pytest.mark.vcr(
    filter_headers=["authorization", "x-api-key"],
    record_mode="once",       # record on first run, replay thereafter
)
def test_real_api_classify():
    result = real_classifier.classify("Charged twice on 12345678")
    assert result.category == "billing"
```

**Why:** First run records HTTP traffic to `cassettes/test_real_api_classify.yaml`.
All subsequent runs replay from the cassette — zero cost, deterministic.

**Anti-pattern:** `record_mode="all"` in CI — re-records on every run, defeating
determinism.

#### 2.2 Pin cassettes to prompt version

**When to use:** When the prompt is versioned.

```python
@pytest.mark.vcr(
    cassette_library_dir="cassettes/v1.4.0/",   # bump when prompt version bumps
)
def test_classify():
    ...
```

**Why:** A cassette captures responses for a specific prompt. When the prompt
changes, the cassette is stale. Pinning by version makes the invalidation explicit.

**Anti-pattern:** One flat cassette directory across all prompt versions — silent
drift between prompt and recorded response.

#### 2.3 Redact secrets and PII

**When to use:** Every cassette.

```python
@pytest.mark.vcr(
    filter_headers=["authorization", "x-api-key", "anthropic-api-key"],
    filter_query_parameters=["api_key"],
    before_record_response=redact_pii,   # custom function
)
def redact_pii(response):
    body = response["body"]["string"].decode()
    body = re.sub(r"\b\d{16}\b", "<CARD>", body)        # credit card
    body = re.sub(r"[\w.-]+@[\w.-]+", "<EMAIL>", body)  # email
    response["body"]["string"] = body.encode()
    return response
```

**Why:** Cassettes are committed to the repo. Anything that ends up in them is
public-grade data.

**Anti-pattern:** Committing cassettes without inspecting them for tokens / PII.

#### 2.4 Cassette invalidation policy

**When to use:** When the team grows.

```markdown
## CONTRIBUTING — cassette policy
- Delete and re-record any cassette when:
  - The prompt version changes
  - The model identifier changes
  - The output schema changes
- Cassettes older than 6 months get auto-flagged for re-recording (CI check).
- A cassette change in a PR is a code change — review the diff.
```

**Why:** Without an explicit policy, cassettes accumulate stale responses that
no longer match what the live API would return.

**Anti-pattern:** No policy — cassettes become a graveyard.

---

### 3. Tool-call fixtures

#### 3.1 Force specific tool call via `FunctionModel`

**When to use:** Asserting the agent invokes the right tool with the right args.

```python
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.messages import ModelResponse, ToolCallPart, TextPart

def force_lookup_tool(messages, info):
    # First call: invoke the tool. Second call: produce final text.
    if len(messages) == 1:
        return ModelResponse(parts=[
            ToolCallPart(tool_name="lookup_customer", args={"account_id": "12345678"})
        ])
    return ModelResponse(parts=[TextPart("Customer found.")])

def test_lookup_called_with_account_id():
    with agent.override(model=FunctionModel(force_lookup_tool)):
        result = agent.run_sync("Look up 12345678")
    assert "Customer found" in result.output
```

**Why:** `FunctionModel` can return `ToolCallPart` to script which tool the
"model" calls and with what args — then assert the tool was actually invoked.

**Anti-pattern:** Patching the tool function directly and never exercising the
"model decided to call it" code path.

#### 3.2 Assert full message sequence with `capture_run_messages`

**When to use:** Tests of multi-turn agent runs.

```python
from pydantic_ai import capture_run_messages

def test_tool_then_response():
    with agent.override(model=FunctionModel(force_lookup_tool)):
        with capture_run_messages() as messages:
            agent.run_sync("Look up 12345678")

    # messages = full transcript: user, tool-call, tool-return, final
    tool_calls = [m for m in messages if m.kind == "tool-call"]
    assert len(tool_calls) == 1
    assert tool_calls[0].tool_name == "lookup_customer"
    assert tool_calls[0].args["account_id"] == "12345678"
```

**Why:** Full transcript inspection beats spot-checking the final output —
catches "right answer for wrong reasons" bugs.

**Anti-pattern:** Asserting only on `result.output` when the bug is in the
tool-call args.

#### 3.3 Mock tool side effects independently

**When to use:** Tools that hit databases, networks, or external services.

```python
@agent.tool
async def lookup_customer(ctx: RunContext[Deps], account_id: str) -> dict:
    return await ctx.deps.db.fetch_customer(account_id)

# In tests, inject a fake db
class FakeDB:
    async def fetch_customer(self, account_id):
        return {"account_id": account_id, "plan": "pro"}

def test_lookup_with_fake_db():
    fake_deps = Deps(db=FakeDB())
    with agent.override(model=FunctionModel(force_lookup_tool)):
        result = agent.run_sync("Look up 12345678", deps=fake_deps)
    # Tool ran against fake DB, no real network
```

**Why:** Mocking the model AND the tool's external dependency gives a fully
hermetic test. `deps` injection in Pydantic AI is the idiomatic way.

**Anti-pattern:** Letting the tool hit a real DB / network in tests "because
it's just a small call".

---

### 4. Assertion patterns for non-deterministic output

#### 4.1 Schema first (output_type validation)

**When to use:** Always, when the output has a Pydantic / TypedDict schema.

```python
def test_output_schema():
    with agent.override(model=TestModel()):
        result = agent.run_sync("any input")
    # Pydantic raises on construction if shape is wrong — already validated
    assert isinstance(result.output, Ticket)
```

**Why:** Schema validation is free (Pydantic enforces it on construction) and
catches the most common regression class: "the model returned the wrong shape".

**Anti-pattern:** Skipping the schema check and going straight to string content.

#### 4.2 Structural keyword assertions

**When to use:** Free-text outputs where you can assert on substrings.

```python
def test_summary_mentions_account():
    with agent.override(model=FunctionModel(canned_summary)):
        result = agent.run_sync("Charged twice on 12345678")
    assert "12345678" in result.output
    assert "billing" in result.output.lower()
    assert "I think" not in result.output     # hedging banned per prompt
```

**Why:** Structural keyword presence/absence checks are robust to rewording
without being so loose that they pass garbage.

**Anti-pattern:** Asserting exact strings (`result == "..."`) on free-text
output — breaks on every minor rewording.

#### 4.3 Length / format bounds

**When to use:** When the prompt constrains length or shape.

```python
def test_summary_length():
    with agent.override(model=FunctionModel(canned_summary)):
        result = agent.run_sync("...")
    sentences = [s for s in result.output.split(".") if s.strip()]
    assert 1 <= len(sentences) <= 3, "summary must be 1-3 sentences"
    assert len(result.output) < 600
```

**Why:** Catches drift toward verbosity. Cheap and deterministic.

**Anti-pattern:** No bounds — model gradually produces longer outputs until a
downstream truncation bug pops.

#### 4.4 Property-based assertions

**When to use:** When you can express invariants that hold over many inputs.

```python
from hypothesis import given, strategies as st

@given(account_id=st.text(alphabet="0123456789", min_size=8, max_size=8))
def test_account_id_round_trip(account_id):
    with agent.override(model=FunctionModel(echo_account_id(account_id))):
        result = agent.run_sync(f"Look up {account_id}")
    assert result.output.account_id == account_id   # invariant
```

**Why:** Property tests catch edge cases (leading zeros, all-same-digit) that
example-based tests miss.

**Anti-pattern:** Property tests with no shrinking strategy on the input space
— hypothesis spins forever.

---

### 5. Test isolation for agentic code

#### 5.1 Block real model calls globally

**When to use:** Default suite setup.

```python
# conftest.py
import pytest
from pydantic_ai import models

@pytest.fixture(autouse=True)
def block_real_models():
    models.ALLOW_MODEL_REQUESTS = False
    yield
    models.ALLOW_MODEL_REQUESTS = True
```

**Why:** A single missing `agent.override(...)` would otherwise hit the real
API. Global block fails loudly instead of silently burning budget.

**Anti-pattern:** Relying on individual tests to remember to mock.

#### 5.2 In-memory checkpointer for LangGraph

**When to use:** Every LangGraph unit test.

```python
@pytest.fixture
def test_graph():
    return build_graph().compile(checkpointer=MemorySaver())
```

**Why:** `MemorySaver` is per-test instance — no cross-test pollution. Sqlite
or Postgres savers add I/O and flake.

**Anti-pattern:** Reusing a SqliteSaver across tests — state bleeds.

#### 5.3 `deps` injection for Pydantic AI

**When to use:** Whenever tools depend on external services.

```python
@dataclass
class Deps:
    db: DatabaseProtocol
    clock: ClockProtocol

# Real wiring
deps = Deps(db=real_db, clock=real_clock)

# Test wiring
test_deps = Deps(db=FakeDB(), clock=FakeClock(fixed_now=datetime(2026, 5, 11)))
agent.run_sync("...", deps=test_deps)
```

**Why:** Tools receive deps via `RunContext[Deps]`. Swapping deps is the
canonical isolation mechanism — no `unittest.mock.patch` gymnastics.

**Anti-pattern:** `@patch("module.real_db_client")` everywhere — replace with
`deps` injection.

#### 5.4 Async test fixtures

**When to use:** Pydantic AI and LangGraph are async-first.

```python
import pytest

@pytest.mark.asyncio
async def test_async_agent():
    with agent.override(model=TestModel()):
        result = await agent.run("input")
    assert isinstance(result.output, Ticket)
```

**Why:** Mixing sync and async in tests leads to "coroutine was never awaited"
warnings and false passes.

**Anti-pattern:** `asyncio.run(agent.run(...))` inside `run_sync` tests — use
`pytest-asyncio` and `await` properly.

---

### 6. CI / cost discipline

#### 6.1 Default suite: zero-cost

**When to use:** Setting up CI.

```yaml
# .github/workflows/test.yml
- run: pytest tests/unit tests/integration   # mocked, free
  env:
    ANTHROPIC_API_KEY: ""                    # empty — fails loudly if real call
```

**Why:** Empty API key turns any leaked real call into an immediate test
failure rather than a silent cost.

**Anti-pattern:** Real API key set in CI env "in case some tests need it" —
silently runs up bills on flaky tests that re-record.

#### 6.2 Gated integration suite for real API tests

**When to use:** When you need a few real-API smoke tests.

```yaml
# .github/workflows/integration-real.yml
on:
  workflow_dispatch:    # manual trigger only
  schedule:
    - cron: "0 0 * * 0"  # weekly

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/real -m real_api
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Why:** Real-API tests have value (catching upstream regressions) but should
run rarely and explicitly. Manual trigger + weekly schedule is the sweet spot.

**Anti-pattern:** Real-API tests in the default PR suite — every PR pays the bill.

#### 6.3 Cassette repo hygiene

**When to use:** Always.

```bash
# CI check: cassettes don't exceed size budget
find cassettes/ -size +100k -exec ls -lh {} \;
# Manual: periodic re-record of stale cassettes
find cassettes/ -mtime +180 -name "*.yaml"
```

**Why:** Cassettes grow. A single test recording a 10MB stream balloons the
repo. Set size + age limits and review.

**Anti-pattern:** Letting cassettes accumulate untouched for years.

---

## Output style (prescriptive)

For every test task, produce:
1. **Test file** in the project's test directory, following its conventions
2. **Mock setup** — fake model (§1), cassette (§2), or tool stub (§3)
3. **Assertions** — schema first (§4.1), then structural (§4.2), then semantic
4. **Failure message** — what a future maintainer sees on regression

## Important

- Tests that hit real LLM APIs in the default suite are auto-reject (cost + flake) — §6.1
- A test of agentic code without mock isolation is auto-reject — §5.1
- Cassettes are part of the repo — review them in PRs like any other code — §2.3
- `ai-testing` is for correctness; `llm-eval-patterns` is for quality. Do not
  conflate them. A test asserts "the code calls the right tool with the right
  args"; an eval asserts "the output is good for users".
- For Pydantic AI specifics, see `pydantic-ai-patterns`. For LangGraph
  specifics, see `langgraph-patterns`. This skill covers the test layer
  on top of both.
