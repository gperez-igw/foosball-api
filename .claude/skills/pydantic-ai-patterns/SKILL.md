---
name: pydantic-ai-patterns
description: >-
  Definition and composition of single typed agents with Pydantic AI: agent
  design, output models, tool registration with RunContext, dependency
  injection, structured output validation, and testing harness. Use for
  individual agent definition. NOT for multi-step orchestration — use
  langgraph-patterns for that.
license: MIT
metadata:
  author: agentflow
  version: "0.1"
  recommended_for: [architect, ai-engineer, code-reviewer]
  triggers:
    - tech_stack includes "Pydantic AI"
    - tech_stack includes "pydantic-ai"
    - source code imports "pydantic_ai"
  skip_when:
    - project has no typed-agent component
    - multi-step orchestration only (use langgraph-patterns)
  docs_index: https://pydantic.dev/docs/ai/llms.txt
---

# Skill: pydantic-ai-patterns

Specialization in **single-agent typed I/O**: defining agents, structured outputs,
tools with dependency injection, validation, and replayable testing.

## When to use

- Architect: when designing agent contracts, output schemas, tool surface
- AI-Engineer: when implementing agents, tools, validators, retry logic
- Code-Reviewer: when reviewing for untyped tool returns, missing validators,
  broken DI, retry-loop misuse

## When NOT to use

- Multi-step state machines / orchestration → use `langgraph-patterns`
- Prompt eval / A-B testing → use `llm-eval-patterns`
- Generic Pydantic v2 usage outside the AI agent context → use language skills

## Live documentation

The patterns below cover the common cases. For edge cases not distilled here,
fetch the official docs via `WebFetch`. **Do NOT fetch the full index unless
you need to discover an unknown section** — go straight to the targeted page.

**Documentation index**: <https://pydantic.dev/docs/ai/llms.txt>

**Direct URLs by topic**:

| Topic | URL |
|-------|-----|
| Agents (concept) | <https://pydantic.dev/docs/ai/core-concepts/agent/index.md> |
| Agent specs / output_type | <https://pydantic.dev/docs/ai/core-concepts/agent-spec/index.md> |
| Dependencies (deps_type, RunContext) | <https://pydantic.dev/docs/ai/core-concepts/dependencies/index.md> |
| Output (validators, retries, streaming) | <https://pydantic.dev/docs/ai/core-concepts/output/index.md> |
| Function tools | <https://pydantic.dev/docs/ai/tools-toolsets/tools/index.md> |
| Advanced tool features (prepare_tools, retries) | <https://pydantic.dev/docs/ai/tools-toolsets/tools-advanced/index.md> |
| Toolsets | <https://pydantic.dev/docs/ai/tools-toolsets/toolsets/index.md> |
| Third-party tools (LangChain bridge) | <https://pydantic.dev/docs/ai/tools-toolsets/third-party-tools/index.md> |
| Testing (TestModel, FunctionModel) | <https://pydantic.dev/docs/ai/guides/testing/index.md> |
| HTTP retries | <https://pydantic.dev/docs/ai/advanced-features/retries/index.md> |
| Multi-agent patterns | <https://pydantic.dev/docs/ai/guides/multi-agent-applications/index.md> |
| API: `pydantic_ai.agent` | <https://pydantic.dev/docs/ai/api/pydantic-ai/agent/index.md> |
| API: `pydantic_ai.tools` | <https://pydantic.dev/docs/ai/api/pydantic-ai/tools/index.md> |
| API: `pydantic_ai.output` | <https://pydantic.dev/docs/ai/api/pydantic-ai/output/index.md> |
| API: `pydantic_ai.models.test` (TestModel) | <https://pydantic.dev/docs/ai/api/models/test/index.md> |
| API: `pydantic_ai.models.function` (FunctionModel) | <https://pydantic.dev/docs/ai/api/models/function/index.md> |
| API: `pydantic_ai.messages` | <https://pydantic.dev/docs/ai/api/pydantic-ai/messages/index.md> |
| Upgrade / changelog | <https://pydantic.dev/docs/ai/project/changelog/index.md> |

For ANY other section (models, MCP, examples, evals, graph), fetch the index
above first to discover the right URL.

## Patterns

### 1. Agent design

#### Pattern: Basic typed agent with system prompt
**When**: Simple agent with fixed instructions and a known model contract.
```python
from pydantic_ai import Agent
from pydantic import BaseModel

class WeatherForecast(BaseModel):
    location: str
    date: str
    forecast: str

agent = Agent(
    'anthropic:claude-sonnet-4-6',
    system_prompt='You are a weather forecast assistant.',
    output_type=WeatherForecast,
)

result = agent.run_sync('What is the weather in Paris tomorrow?')
print(result.output)
#> WeatherForecast(location='Paris', date='2030-01-02', forecast='Sunny')
```
**Why this vs alternatives**: Declares the output contract upfront; type checker sees `result.output: WeatherForecast`. Static system prompts cache efficiently.
**Anti-pattern**: Agent with no `output_type` when structured data is expected — loses type safety, forces manual parsing.

#### Pattern: `defer_model_check=True` for test-friendly module-level agents

**When**: The agent is a module-level singleton (no factory function), and tests need to import the module before any provider credentials exist (CI environments, fresh dev machines, sandboxed test runners).

```python
import os
from pydantic_ai import Agent
from src.prompts.loader import load_prompt

_llm_model = os.environ.get("LLM_MODEL", "anthropic:claude-sonnet-4-6")

code_reviewer_agent: Agent[AgentDeps, ReviewResult] = Agent(
    model=_llm_model,
    output_type=ReviewResult,
    deps_type=AgentDeps,
    system_prompt=load_prompt("code-reviewer"),
    output_retries=2,
    # Defers provider credential check to first call — allows import without API key.
    # Tests override the model with TestModel/FunctionModel before any run.
    defer_model_check=True,
)
```

**Why**: Without `defer_model_check`, importing the module attempts to instantiate the provider client immediately and fails in environments without API keys — even for tests that will only ever use `agent.override(model=TestModel())`. Setting `defer_model_check=True` makes provider instantiation lazy; tests can override before the first `run()` and never touch the real provider.

**Anti-pattern**: Wrapping the agent in a `make_agent()` factory just to enable test isolation, or adding `try/except ImportError` around the Agent constructor. `defer_model_check=True` is the idiomatic Pydantic AI solution.

**ref:** https://pydantic.dev/docs/ai/agents

#### Pattern: Dynamic system prompt via decorator
**When**: System prompt depends on runtime context (user, DB state, deps).
```python
from datetime import date
from pydantic_ai import Agent, RunContext

agent = Agent(
    'openai:gpt-5.2',
    deps_type=str,
    system_prompt="Use the customer's name while replying.",
)

@agent.system_prompt
def add_users_name(ctx: RunContext[str]) -> str:
    return f"The user's name is {ctx.deps}."

@agent.system_prompt
def add_date() -> str:
    return f'The date is {date.today()}.'

result = agent.run_sync('What is the date?', deps='Frank')
```
**Why this vs alternatives**: System prompts are cached; dynamic decorators run only on `run_sync/run_async`. Use `@agent.instructions` for rules that should NOT be cached across calls.
**Anti-pattern**: Concatenating prompts as strings in `run_sync` — loses caching, hard to test.

#### Pattern: Tool registration with dependency injection
**When**: Agent needs access to external services, databases, or shared state.
```python
from dataclasses import dataclass
from datetime import date
from pydantic_ai import Agent, RunContext

@dataclass
class WeatherService:
    async def get_forecast(self, location: str, d: date) -> str:
        return f'Sunny in {location} on {d}'

agent = Agent[WeatherService, str](
    'openai:gpt-5.2',
    deps_type=WeatherService,
    system_prompt='Forecast weather at requested locations.',
)

@agent.tool
async def weather_forecast(
    ctx: RunContext[WeatherService],
    location: str,
    forecast_date: date,
) -> str:
    """Get weather forecast for a location on a date."""
    return await ctx.deps.get_forecast(location, forecast_date)

result = agent.run_sync('Paris on Jan 2?', deps=WeatherService())
```
**Why this vs alternatives**: `RunContext.deps` is typed; mypy catches missing methods. Avoids globals, allows test mocking via `deps=...`.
**Anti-pattern**: Globals or singletons inside tools — non-reentrant, hard to test.

#### Pattern: Output type selection via list (multiple types)
**When**: Agent can produce multiple output types; model chooses which fits.
```python
from pydantic import BaseModel
from pydantic_ai import Agent

class Box(BaseModel):
    width: int; height: int; depth: int; units: str

agent = Agent(
    'openai:gpt-5-mini',
    output_type=[Box, str],  # structured data OR plain text
    instructions='Extract box dimensions. If incomplete, ask user to try again.',
)
```
**Why this vs alternatives**: Each type becomes a separate output tool — simpler schemas, clearer dispatch. Prefer `[Foo, Bar]` over `Foo | Bar` for type-checker compatibility.
**Anti-pattern**: `Union` without testing that the model can consistently discriminate.

### 2. Pydantic models for LLM output

#### Pattern: Validation constraints + field validators
**When**: Enforce format, range, or custom logic on LLM output before it returns.
```python
from pydantic import BaseModel, field_validator, Field
from pydantic_ai import Agent

class Value(BaseModel):
    x: int = Field(ge=0, le=100, description='Must be 0-100')

    @field_validator('x')
    @classmethod
    def round_to_ten(cls, v: int) -> int:
        return (v // 10) * 10

agent = Agent('openai:gpt-5.2', output_type=Value)
result = agent.run_sync('Give me a value of 57.')
#> Value(x=50)
```
**Why this vs alternatives**: Pydantic validators run on LLM output BEFORE the agent returns. Failures trigger `ModelRetry` automatically. Constraints `Field(ge=, le=)` are passed to the model schema.
**Anti-pattern**: Post-processing output after `agent.run()` — the model has no chance to self-correct.

#### Pattern: Validation context for dynamic constraints
**When**: Validation rules depend on runtime data (user permissions, config).
```python
from pydantic import BaseModel, field_validator, ValidationInfo
from pydantic_ai import Agent

class Value(BaseModel):
    x: int

    @field_validator('x')
    @classmethod
    def increment_value(cls, v: int, info: ValidationInfo) -> int:
        ctx_val = info.context or 0
        return v + ctx_val

agent = Agent(
    'google-gla:gemini-3-flash-preview',
    output_type=Value,
    validation_context=10,
)
```
**Why this vs alternatives**: Context flows into validators without polluting the prompt. Use lambda for per-run context: `validation_context=lambda ctx: ctx.deps.config_value`.

#### Pattern: Retry on validation failure with `ModelRetry`
**When**: Tool or output validation fails; want LLM to fix it intelligently.
```python
from pydantic_ai import Agent, ModelRetry

def run_sql_query(query: str) -> list[dict]:
    if 'DROP' in query.upper():
        raise ModelRetry("DROP not allowed. Try SELECT instead.")
    if 'SELECT *' not in query:
        raise ModelRetry("Only 'SELECT *' supported. Filter columns post-processing.")
    return [{'result': 'data'}]

agent = Agent(
    'openai:gpt-5.2',
    output_type=[run_sql_query, str],
    output_retries=3,
)
```
**Why this vs alternatives**: `raise ModelRetry(msg)` tells the model WHY it failed and what to try next. Model sees the message and regenerates. Set `output_retries` at agent level or per-run.
**Anti-pattern**: Silent failures or generic error messages — model can't recover.

#### Pattern: Partial models for streaming output
**When**: Large response; want to return partial data while streaming.
```python
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext

class DatabaseRecord(BaseModel):
    name: str
    value: int | None = Field(None)

def save_to_database(ctx: RunContext, record: DatabaseRecord) -> DatabaseRecord:
    if ctx.partial_output:
        return record  # skip side effects on partials
    print(f'Saving: {record.name} = {record.value}')
    return record

agent = Agent('openai:gpt-5.2', output_type=save_to_database)

async def main():
    async with agent.run_stream('Create record name="test" value=42') as result:
        async for output in result.stream_output(debounce_by=None):
            print(f'Streamed: {output}')
```
**Why this vs alternatives**: `ctx.partial_output` gates side effects. Only final output triggers them. Reactive UIs show incremental results.
**Anti-pattern**: Side effects on every partial — wastes resources, can corrupt state.

### 3. Tool patterns

#### Pattern: Sync and async tools — `@agent.tool` vs `@agent.tool_plain`
**When**: Tool interacts with async I/O (DB, HTTP) or sync resources. Use
`@agent.tool` when the tool needs `RunContext` (deps, model info, retry counter).
Use `@agent.tool_plain` when the tool is fully self-contained.
```python
from pydantic_ai import Agent, RunContext
from datetime import datetime

agent = Agent('openai:gpt-5.2', deps_type=dict)

@agent.tool_plain
def get_time() -> str:
    """No context needed — use tool_plain."""
    return datetime.now().isoformat()

@agent.tool
async def fetch_user(ctx: RunContext[dict], user_id: int) -> str:
    """Needs ctx.deps — use tool."""
    user = await ctx.deps['db'].get_user(user_id)
    return f'{user.name}: {user.email}'
```
**Why this vs alternatives**: `tool_plain` skips the context plumbing — cleaner signature, slightly less overhead. Both support sync and async. Async tools integrate with the event loop.
**Anti-pattern**: Using `@agent.tool` with an unused `ctx` parameter — use `tool_plain` instead. Blocking I/O (requests.get) in async tools without `asyncio.to_thread` — blocks the event loop.

#### Pattern: Tool result types with `ModelRetry`
**When**: Tool can fail gracefully; want LLM to retry with corrected inputs.
```python
from pydantic_ai import Agent, ModelRetry

agent = Agent('openai:gpt-5.2')

@agent.tool(retries=3)
def divide(a: float, b: float) -> float:
    if b == 0:
        raise ModelRetry('Cannot divide by zero. Try a non-zero divisor.')
    if abs(a / b) > 1_000_000:
        raise ModelRetry(f'Result {a/b} too large. Adjust inputs.')
    return a / b
```
**Why this vs alternatives**: `@agent.tool(retries=N)` sets per-tool retry budget. `ModelRetry` is caught and replayed; unhandled exceptions propagate.
**Anti-pattern**: Returning error strings (`{'error': '...'}`) instead of raising `ModelRetry` — model doesn't know to retry.

#### Pattern: Tool argument validation with Pydantic models
**When**: Tool arguments are complex; want validation before execution.
```python
from pydantic import BaseModel, Field
from pydantic_ai import Agent

class QueryParams(BaseModel):
    table: str
    limit: int = Field(10, ge=1, le=1000)
    where: str | None = None

agent = Agent('openai:gpt-5.2')

@agent.tool
def query_database(params: QueryParams) -> list[dict]:
    """Query a table with validated, typed parameters."""
    ...
```
**Why this vs alternatives**: Pydantic validates tool args before your function runs. Type hints become the tool schema.
**Anti-pattern**: `def tool(query: str)` with no structure — model has no guidance.

#### Pattern: `prepare_tools` for dynamic tool filtering
**When**: Available tools depend on user role, request state, or config.
```python
from pydantic_ai import Agent, RunContext
from pydantic_ai.tools import ToolDefinition

async def prepare_tools(
    ctx: RunContext[dict],
    tool_defs: list[ToolDefinition],
) -> list[ToolDefinition] | None:
    user_role = ctx.deps.get('role', 'guest')
    if user_role == 'admin':
        return tool_defs
    safe = {'query_database', 'get_time'}
    return [t for t in tool_defs if t.name in safe]

agent = Agent('openai:gpt-5.2', deps_type=dict, prepare_tools=prepare_tools)
```
**Why this vs alternatives**: Filter by role, request state, or rate limit. Cleaner than multiple agents. Return `None` to disable all tools for that step.
**Anti-pattern**: Permission checks inside tools — model doesn't know to avoid them upfront.

### 4. Structured output advanced

#### Pattern: Discriminated union for routing decisions
**When**: Multiple output types with overlapping fields; need explicit discriminator.
```python
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field
from pydantic_ai import Agent

class Success(BaseModel):
    type: Literal['success'] = 'success'
    result: list[dict]; count: int

class Failure(BaseModel):
    type: Literal['failure'] = 'failure'
    reason: str; suggestion: str

QueryResult = Annotated[Union[Success, Failure], Field(discriminator='type')]

agent = Agent('openai:gpt-5.2', output_type=QueryResult)
```
**Why this vs alternatives**: Discriminator tells Pydantic and model schema how to distinguish branches. Faster parsing, clearer intent.
**Anti-pattern**: Large unions without discriminators — schema hard to parse, model picks wrong branch.

#### Pattern: Nested models with recursive schemas
**When**: Response is hierarchical (org > teams > users; recipe > ingredients).
```python
from pydantic import BaseModel
from pydantic_ai import Agent

class Ingredient(BaseModel):
    name: str; amount: float; unit: str

class Recipe(BaseModel):
    name: str
    ingredients: list[Ingredient]
    instructions: list[str]
    servings: int

agent = Agent('openai:gpt-5.2', output_type=Recipe)
```
**Why this vs alternatives**: Validated recursively. Schema sent to model. Type hints end-to-end.
**Anti-pattern**: Flat dicts with nested dicts — loses validation and type safety.

#### Pattern: `ToolOutput` for custom names + per-tool retry limits
**When**: Multiple output types; need control over schema names or retry budgets.
```python
from pydantic import BaseModel
from pydantic_ai import Agent, ToolOutput

class Fruit(BaseModel):
    name: str; color: str

class Vehicle(BaseModel):
    name: str; wheels: int

agent = Agent(
    'openai:gpt-5.2',
    output_type=[
        ToolOutput(Fruit, name='return_fruit', max_retries=2),
        ToolOutput(Vehicle, name='return_vehicle', max_retries=3),
    ],
    output_retries=1,
)
```
**Why this vs alternatives**: Override tool name (for logs/UI) and per-tool retry budgets when some types are harder to validate.

### 5. Testing patterns

#### Pattern: Unit test with `TestModel` (deterministic mock)
**When**: Testing agent logic without calling a real LLM.
```python
import pytest
from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from my_agent import weather_agent, WeatherService

models.ALLOW_MODEL_REQUESTS = False  # catch real LLM calls

@pytest.fixture
def override_model():
    with weather_agent.override(model=TestModel()):
        yield

async def test_forecast(override_model):
    result = await weather_agent.run(
        'Weather in London on 2024-11-28?',
        deps=WeatherService(),
    )
    assert result.output is not None
```
**Why this vs alternatives**: `TestModel` returns consistent output (hardcoded tool calls + summary). Fast, no rate limits, deterministic.
**Anti-pattern**: Real models in CI — cost, latency, flakiness.

#### Pattern: Integration test with `FunctionModel` (scripted behavior)
**When**: Testing tools with specific inputs; need fine-grained control.
```python
import re
from pydantic_ai.models.function import FunctionModel, AgentInfo
from pydantic_ai import ModelMessage, ModelResponse, ToolCallPart, TextPart

def call_weather_forecast(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    if len(messages) == 1:
        user_text = messages[0].parts[-1].content
        m = re.search(r'(\d{4}-\d{2}-\d{2})', user_text)
        if m:
            return ModelResponse(parts=[
                ToolCallPart(tool_name='weather_forecast',
                             args={'location': 'London', 'forecast_date': m.group(1)})
            ])
    return ModelResponse(parts=[TextPart('It will be sunny.')])

async def test_forecast_with_custom_logic():
    with weather_agent.override(model=FunctionModel(call_weather_forecast)):
        result = await weather_agent.run('Weather in London on 2032-01-01?')
        assert 'sunny' in str(result.output).lower()
```
**Why this vs alternatives**: Full control over tool calls and responses per step. Test branching, edge cases.
**Anti-pattern**: Over-mocking until tests don't reflect real model behavior.

#### Pattern: Message capture for assertion on agent I/O
**When**: Verify exact messages sent to/from model; check system prompts, tool invocations.
```python
import pytest
from pydantic_ai import capture_run_messages, models
from pydantic_ai.models.test import TestModel

@pytest.mark.anyio
async def test_captured_messages():
    with capture_run_messages() as messages:
        with weather_agent.override(model=TestModel()):
            await weather_agent.run('Weather?', deps=WeatherService())

    assert any(
        hasattr(part, 'tool_name') and part.tool_name == 'weather_forecast'
        for msg in messages for part in msg.parts
    )
```
**Why this vs alternatives**: `capture_run_messages()` records all requests/responses. Audit prompts, schemas, token usage.
**Anti-pattern**: Relying only on final output — misses intermediate failures.

### 6. Migration patterns

#### Pattern: Wrap LangChain tools in Pydantic AI
**When**: Migrating from LangChain; reuse existing tool library.
```python
from pydantic_ai import Agent
from pydantic_ai.ext.langchain import tool_from_langchain, LangChainToolset
from langchain_community.tools import DuckDuckGoSearchRun

search_tool = DuckDuckGoSearchRun()
pydantic_search = tool_from_langchain(search_tool)

agent = Agent('openai:gpt-5.2', tools=[pydantic_search])
```
**Why this vs alternatives**: Avoids rewriting tools. LangChain tools are NOT validated by Pydantic AI — the tool itself must validate.
**Anti-pattern**: Rewriting all LangChain tools from scratch — high effort, easy to introduce bugs.

#### Pattern: Gradual migration from untyped to typed agent
**When**: Legacy codebase has agents without structured output; add type safety incrementally.
```python
from pydantic import BaseModel
from pydantic_ai import Agent

class FactExtraction(BaseModel):
    title: str
    key_facts: list[str]

new_agent = Agent(
    'openai:gpt-5.2',
    system_prompt='Extract key facts.',
    output_type=FactExtraction,
)
# Can fall back per-call: new_agent.run_sync('...', output_type=str)
```
**Why this vs alternatives**: Add `output_type` without rewriting. Migrate incrementally.

### 7. External project mapping

If the project has its own agent/tool primitives, map each to Pydantic AI
equivalents. Read project-specific docs from `references/` or
`.agentflow/references/` before producing code. Pydantic AI's `Agent` is a
lightweight composable core — avoid wrapping it in custom classes unless the
project has documented patterns that require it.

For factory-style abstractions, prefer Pydantic AI's `instructions` parameter
over `system_prompt` when behavior should differ per call (instructions are
not cached).

For tool registries, register via `tools=[...]` at instantiation or via
`@agent.tool` decorator. Avoid hardcoding tools into every agent — use
`prepare_tools` for runtime filtering.


## Version notes

- Examples assume `pydantic-ai >= 0.16.0`
- Python 3.10+ for `int | None` syntax (use `Optional[int]` on older Python)
- `async` examples require `asyncio.run()` or pytest with `pytest-anyio`

## Output style (prescriptive, not descriptive)

For every requirement, produce:
1. **Agent definition** — full instantiation with output_type and tools
2. **Pydantic models** — output and tool schemas with validators
3. **Tool functions** — sync/async, with `RunContext` typing
4. **DI wiring** — `deps_type` and how callers pass deps
5. **Test stub** — how to invoke with `TestModel`

Do NOT produce academic explanations. Produce code + decisions.

## Documentation source

Consult live docs via `WebFetch` (not training data — Pydantic AI evolves
fast). Direct URLs are in the **Live documentation** section above. The
public API has changed across minor versions; if the code you write fails
against the installed version, fetch the `pydantic_ai.agent` API page and
verify the current signatures before debugging further.

## Important

- Code-Reviewer auto-rejects:
  - Tool function with untyped return (raw `Any` or untyped dict)
  - Agent without `output_type` when the caller expects structure
  - `RunContext` ignored when tool needs deps
  - Validation bypass (post-processing structured output by hand)
  - Missing retry strategy on a tool that can validation-fail
