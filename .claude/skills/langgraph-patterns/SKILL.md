---
name: langgraph-patterns
description: >-
  Orchestration patterns for LangGraph: state design, conditional routing,
  parallel branches (Send API), checkpointing, human-in-the-loop with
  interrupt/Command, streaming, and subgraph composition (Deep Agents wrap).
  Use when designing or implementing agentic workflows as state machines.
  NOT for single-agent typed I/O — use pydantic-ai-patterns for that.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [architect, ai-engineer, code-reviewer]
  triggers:
    - tech_stack includes "LangGraph"
    - tech_stack includes "Deep Agents"
    - source code imports "langgraph"
  skip_when:
    - project has no agentic/state-machine component
    - single-agent project without orchestration
  docs_index: https://langchain-ai.github.io/langgraph/llms.txt
---

# Skill: langgraph-patterns

Specialization in **orchestration of multi-step agentic workflows**: state machines,
graph composition, runtime behaviors. Covers LangGraph and Deep Agents as a wrapped subgraph.

## When to use

- Architect: when designing state schema, node decomposition, edge logic,
  checkpointing strategy, HITL gates
- AI-Engineer: when implementing nodes, conditional edges, parallel fan-out/fan-in,
  recovery loops, streaming
- Code-Reviewer: when reviewing graph code for state mutation antipatterns,
  missing checkpointer, untyped reducers, deadlock loops

## When NOT to use

- Single-agent design with typed I/O → use `pydantic-ai-patterns`
- Prompt design / eval → use `prompt-design` / `llm-eval-patterns`
- Generic Python style → use language-level skills

## Live documentation

LangGraph evolves fast — verify against canonical docs before non-trivial work.
The `docs_index` in frontmatter points to the official `llms.txt`.

| Topic | URL |
|-------|-----|
| Overview | https://docs.langchain.com/oss/python/langgraph/overview |
| Why LangGraph? | https://docs.langchain.com/oss/python/langgraph/why-langgraph |
| Graph API (state, nodes, edges, Send) | https://docs.langchain.com/oss/python/langgraph/graph-api |
| Streaming (stream_mode, subgraphs, v2) | https://docs.langchain.com/oss/python/langgraph/streaming |
| Persistence (checkpointers, threads, store) | https://docs.langchain.com/oss/python/langgraph/persistence |
| Add Memory (short / long-term) | https://docs.langchain.com/oss/python/langgraph/add-memory |
| Workflows & Agents (router, parallel, orchestrator-worker) | https://docs.langchain.com/oss/python/langgraph/workflows-agents |
| Use Subgraphs | https://docs.langchain.com/oss/python/langgraph/use-subgraphs |
| Interrupts (HITL, Command(resume=)) | https://docs.langchain.com/oss/python/langgraph/interrupts |
| Observability | https://docs.langchain.com/oss/python/langgraph/observability |
| Common Errors | https://docs.langchain.com/oss/python/langgraph/common-errors |
| Agentic RAG tutorial | https://docs.langchain.com/oss/python/langgraph/agentic-rag |
| SQL Agent tutorial | https://docs.langchain.com/oss/python/langgraph/sql-agent |
| API Reference | https://reference.langchain.com/python/langgraph/ |

When a pattern in this skill seems off, fetch the canonical page above with
WebFetch before acting.

---

## Patterns

### 1. State design

#### 1.1 TypedDict with Annotated reducers

**When to use:** State keys need accumulation (append, merge) instead of overwrite.

```python
from typing import Annotated
from typing_extensions import TypedDict
import operator
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    messages: Annotated[list, operator.add]   # appends
    tasks: list                                # overwrites

def node_a(state: State) -> dict:
    return {"messages": ["new"]}

builder = StateGraph(State)
builder.add_node("a", node_a)
builder.add_edge(START, "a")
builder.add_edge("a", END)
graph = builder.compile()
```

**Why:** `Annotated[T, reducer]` controls how state keys merge across node updates.
Without `operator.add`, returning `{"messages": ["x"]}` overwrites the entire list.

**Anti-pattern:** Bare list field + manual `state["messages"] + [new]` in every node — defeats reducers and breaks parallel branches.

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

#### 1.2 Pydantic state for validated schemas

**When to use:** State has nested objects or you want validation errors at update time.

```python
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph

class Task(BaseModel):
    id: str
    status: str

class State(BaseModel):
    tasks: list[Task] = Field(default_factory=list)
    user_id: str

builder = StateGraph(State)
```

**Why:** Pydantic validates state shape on every node update — catches schema drift early. Trade-off: slower than TypedDict, no per-field reducers (use `Annotated` form for that).

**Anti-pattern:** Mixing Pydantic state with `Annotated[..., operator.add]` — Pydantic does not honor those reducers natively; use TypedDict if you need reducers.

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

#### 1.3 `add_messages` reducer for chat history

**When to use:** Building an agent with conversation history; need upsert-by-ID semantics.

```python
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict, Annotated

class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
```

**Why:** `add_messages` appends new messages and replaces messages with matching `id` — the idiomatic pattern for LLM conversation state.

**Anti-pattern:** Hand-rolled message dedup in nodes. Use `add_messages`.

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

#### 1.4 State must be JSON-serializable

**When to use:** Always. This is the invariant.

```python
# OK
class State(TypedDict):
    user_id: str
    items: list[dict]
    count: int

# NOT OK — checkpointer cannot serialize this
class BadState(TypedDict):
    db_connection: Any   # raw connection object
    callback: Callable   # arbitrary function
```

**Why:** Checkpointers serialize state at every super-step. Non-serializable values fail at runtime.

**Anti-pattern:** Stashing connections, sockets, or callbacks in state. Hold them in the runtime config or close over them in node closures.

**ref:** https://docs.langchain.com/oss/python/langgraph/persistence

---

### 2. Routing patterns

#### 2.1 Conditional edges via routing function

**When to use:** Next node depends on state (e.g., "route to escalation vs FAQ").

```python
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    escalated: bool

def route(state: State) -> str:
    return "escalation" if state["escalated"] else "faq"

builder = StateGraph(State)
builder.add_node("classifier", classifier_fn)
builder.add_node("escalation", escalate_fn)
builder.add_node("faq", faq_fn)
builder.add_edge(START, "classifier")
builder.add_conditional_edges("classifier", route, {
    "escalation": "escalation",
    "faq": "faq",
})
builder.add_edge("escalation", END)
builder.add_edge("faq", END)
```

**Why:** Routing function is pure — it inspects state and returns the next node name. Keeps routing decoupled from node side effects.

**Anti-pattern:** Routing functions with side effects (writing files, calling LLMs). Move those into nodes.

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

#### 2.2 Loop guards with iteration counter

**When to use:** Reflection / refine loops that must terminate.

```python
class State(TypedDict):
    iteration: int
    quality: float

MAX_ITER = 5

def keep_refining(state: State) -> str:
    if state["iteration"] >= MAX_ITER or state["quality"] >= 0.9:
        return END
    return "refine"

builder.add_conditional_edges("evaluate", keep_refining, {
    END: END,
    "refine": "refine",
})

def refine(state: State) -> dict:
    return {"iteration": state["iteration"] + 1, "quality": new_quality}
```

**Why:** Explicit counter + threshold makes termination testable. LangGraph also enforces a global `recursion_limit` (default 25) as a fail-safe — but rely on it only as a guardrail.

**Anti-pattern:** Unconditional self-edge (`add_edge("refine", "refine")`) — runs until recursion_limit kills the graph.

**ref:** https://docs.langchain.com/oss/python/langgraph/common-errors

#### 2.3 Command for combined update + goto from a node

**When to use:** Node needs to both write state AND choose next node in one return.

```python
from langgraph.types import Command
from typing import Literal

def classifier(state: State) -> Command[Literal["faq", "escalation"]]:
    if "urgent" in state["query"].lower():
        return Command(update={"escalated": True}, goto="escalation")
    return Command(update={"escalated": False}, goto="faq")

builder.add_node("classifier", classifier)
# No add_conditional_edges needed — goto inside Command drives routing
```

**Why:** `Command(update=..., goto=...)` from a node replaces the conditional-edge pattern when you also need to mutate state.

**Anti-pattern:** Returning Command from a routing function — Command is for nodes, routing functions return node names (strings).

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

---

### 3. Parallelism patterns

#### 3.1 Send API for dynamic fan-out

**When to use:** Spawn N parallel invocations of the same node, one per item in a list (N unknown at graph-build time).

```python
from langgraph.types import Send
from langgraph.graph import StateGraph, START, END
import operator
from typing import Annotated

class State(TypedDict):
    subjects: list[str]
    jokes: Annotated[list, operator.add]   # collects parallel results

def continue_to_jokes(state: State):
    return [Send("generate_joke", {"subject": s}) for s in state["subjects"]]

def generate_joke(state: dict) -> dict:
    return {"jokes": [f"joke about {state['subject']}"]}

builder = StateGraph(State)
builder.add_node("generate_joke", generate_joke)
builder.add_node("collect", lambda s: s)
builder.add_conditional_edges(START, continue_to_jokes, ["generate_joke"])
builder.add_edge("generate_joke", "collect")
builder.add_edge("collect", END)
```

**Why:** `Send(node_name, state)` schedules a dynamic edge at runtime. Returning a list of `Send` from a **conditional edge** (not a regular node) creates one parallel invocation per item. The receiving node sees only the per-Send state.

**Anti-pattern:** Returning `[Send(...)]` from a regular node — Send must come from a conditional edge function. Use `add_conditional_edges(source, fn)`.

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

#### 3.2 Fan-in with accumulating reducer

**When to use:** Collect results from parallel Send branches into one downstream node.

```python
class State(TypedDict):
    jokes: Annotated[list, operator.add]   # reducer accumulates per-branch lists

def collect(state: State) -> dict:
    # state["jokes"] already contains all parallel outputs, merged by operator.add
    return {"final": "\n".join(state["jokes"])}
```

**Why:** The `Annotated[..., operator.add]` reducer is what enables fan-in — LangGraph applies it across all parallel returns automatically.

**Anti-pattern:** Bare `list` field — only the last parallel branch's write survives.

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

#### 3.3 Static parallel branches (no Send)

**When to use:** Fixed, known number of parallel paths.

```python
builder.add_node("split", split_fn)
builder.add_node("path_a", path_a_fn)
builder.add_node("path_b", path_b_fn)
builder.add_node("merge", merge_fn)
builder.add_edge("split", "path_a")
builder.add_edge("split", "path_b")
builder.add_edge("path_a", "merge")
builder.add_edge("path_b", "merge")
```

**Why:** Multiple `add_edge` calls from the same source run those targets in parallel super-steps. Simpler than Send when topology is static.

**Anti-pattern:** Reaching for Send when static edges suffice — Send adds runtime complexity for a problem you don't have.

**ref:** https://docs.langchain.com/oss/python/langgraph/workflows-agents

---

### 4. Persistence & recovery

#### 4.1 Thread-scoped checkpointing for conversation memory

**When to use:** Multi-turn agent where each user/session has a continuing thread.

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph

graph = builder.compile(checkpointer=MemorySaver())

config = {"configurable": {"thread_id": "user_123"}}
for user_input in user_inputs:
    state = graph.invoke({"query": user_input}, config=config)
    # Prior state restored automatically; reducers accumulate
```

**Why:** `thread_id` partitions checkpoints. Same thread always resumes from last saved state. Checkpointer saves after every super-step.

**Anti-pattern:** Re-passing the full message history on every invoke when you already have a checkpointer — let LangGraph reload it.

**ref:** https://docs.langchain.com/oss/python/langgraph/persistence

#### 4.2 Checkpointer choice by environment

**When to use:** Pick the saver per deployment target.

```python
# Dev / tests
from langgraph.checkpoint.memory import MemorySaver
checkpointer = MemorySaver()

# Single-process small app
from langgraph.checkpoint.sqlite import SqliteSaver
checkpointer = SqliteSaver.from_conn_string(":memory:")

# Production
from langgraph.checkpoint.postgres import PostgresSaver
checkpointer = PostgresSaver.from_conn_string("postgresql://...")
checkpointer.setup()   # one-time migration
```

**Why:** Same API, different durability. `MemorySaver` loses state on restart; `SqliteSaver` survives but doesn't scale across processes; `PostgresSaver` is the production default.

**Anti-pattern:** `MemorySaver` in production — every restart wipes all in-flight HITL sessions.

**ref:** https://docs.langchain.com/oss/python/langgraph/persistence

#### 4.3 Time-travel via state history

**When to use:** Inspecting prior steps for debugging or forking from a past checkpoint.

```python
config = {"configurable": {"thread_id": "user_123"}}

for snapshot in graph.get_state_history(config):
    print(snapshot.config["configurable"]["checkpoint_id"], snapshot.values)

# Fork: invoke with a past checkpoint_id in config
fork_config = {"configurable": {
    "thread_id": "user_123",
    "checkpoint_id": "<chosen-id>",
}}
graph.update_state(fork_config, {"query": "alternate input"})
graph.invoke(None, config=fork_config)
```

**Why:** Every super-step writes a checkpoint with an id. You can re-invoke at any past point — useful for A/B branching and debugging non-determinism.

**Anti-pattern:** Logging state manually for replay — `get_state_history` is the authoritative source.

**ref:** https://docs.langchain.com/oss/python/langgraph/persistence

#### 4.4 Cross-thread memory via Store

**When to use:** Shared knowledge that should persist across threads (user prefs, learned facts, RAG corpus).

```python
from langgraph.store.memory import InMemoryStore
from langgraph.config import get_store

store = InMemoryStore()
graph = builder.compile(checkpointer=checkpointer, store=store)

def remember(state: State) -> dict:
    s = get_store()
    s.put(("user", state["user_id"]), "favorite_color", {"value": "blue"})
    return {}

def recall(state: State) -> dict:
    s = get_store()
    item = s.get(("user", state["user_id"]), "favorite_color")
    return {"color": item.value["value"] if item else None}
```

**Why:** Checkpointer is per-thread; Store is global with namespaced keys. Use Store for facts that survive across threads.

**Anti-pattern:** Stuffing user-level prefs into thread state and copying them between threads. Use Store.

**ref:** https://docs.langchain.com/oss/python/langgraph/add-memory

---

### 5. Human-in-the-loop (HITL)

#### 5.1 `interrupt()` halts execution at a node

**When to use:** Pause graph mid-run, surface a question, wait for a human to resume.

```python
from langgraph.types import interrupt
from langgraph.checkpoint.memory import MemorySaver

def approval(state: State) -> dict:
    decision = interrupt("Approve action: " + state["action"])
    return {"approved": decision}

graph = builder.compile(checkpointer=MemorySaver())   # checkpointer REQUIRED
```

**Why:** `interrupt(payload)` is positional — it takes any JSON-serializable value, surfaces it to the caller via the run's interrupt event, and the function returns whatever the resumer passes back. Checkpointer is mandatory; without it the resume cannot find the paused state.

**Anti-pattern:** `interrupt(value="...")` — there is no `value=` kwarg; pass positionally.

**ref:** https://docs.langchain.com/oss/python/langgraph/interrupts

#### 5.2 Resume with `Command(resume=...)`

**When to use:** Continue execution after a human reviews an interrupt.

```python
from langgraph.types import Command

config = {"configurable": {"thread_id": "1"}}

# First invocation pauses at interrupt()
result = graph.invoke({"action": "delete row 42"}, config=config)
# result["__interrupt__"] contains the payload passed to interrupt()

# Human inspects, decides, resumes
final = graph.invoke(Command(resume=True), config=config)
# The value passed in resume= becomes the return value of interrupt() inside the node
```

**Why:** `Command(resume=X)` as the first positional arg to `invoke`/`stream` re-enters the paused node; `X` becomes the return value of the original `interrupt(...)` call.

**Anti-pattern:** `config={"resuming": True}` — no such config key exists. Always use `Command(resume=value)`.

**ref:** https://docs.langchain.com/oss/python/langgraph/interrupts

#### 5.3 Multi-step approval gates

**When to use:** Several sequential human checkpoints (e.g., draft → review → publish).

```python
def review_gate(state: State) -> dict:
    feedback = interrupt({
        "stage": state["stage"],
        "content": state["content"],
    })
    return {
        "stage": next_stage(state["stage"]),
        "feedback": [feedback],   # if list reducer
    }

def is_done(state: State) -> str:
    return END if state["stage"] == "published" else "review"

builder.add_conditional_edges("review_gate", is_done)
```

**Why:** Each `interrupt()` pauses; each `Command(resume=...)` resumes with the human's response captured back into state via the node's return.

**Anti-pattern:** One mega-interrupt collecting all decisions at the start — kills the iterative review flow.

**ref:** https://docs.langchain.com/oss/python/langgraph/interrupts

---

### 6. Streaming patterns

#### 6.1 `stream_mode="updates"` — state deltas per node

**When to use:** Show "which node just changed what" — small payloads, ideal for progress UIs.

```python
for chunk in graph.stream(inputs, config=config, stream_mode="updates"):
    # chunk shape: {"node_name": {"changed_key": value, ...}}
    for node_name, delta in chunk.items():
        print(node_name, "→", delta)
```

**Why:** Updates mode emits only the keys a node returned — minimal bandwidth, easy to project into UI deltas.

**Anti-pattern:** Streaming `values` (full state) when you only need deltas — wastes bandwidth.

**ref:** https://docs.langchain.com/oss/python/langgraph/streaming

#### 6.2 `stream_mode="messages"` — LLM token streaming

**When to use:** Streaming chat-style token output to a UI.

```python
for msg_chunk, metadata in graph.stream(inputs, config=config, stream_mode="messages"):
    if msg_chunk.content:
        print(msg_chunk.content, end="", flush=True)
    # metadata = {"langgraph_node": "...", "langgraph_step": N, ...}
```

**Why:** Messages mode yields `(AIMessageChunk, metadata)` tuples token-by-token from LLM nodes. Metadata identifies the source node.

**Anti-pattern:** Polling node output after completion when you wanted live tokens.

**ref:** https://docs.langchain.com/oss/python/langgraph/streaming

#### 6.3 `stream_mode="custom"` with `get_stream_writer()`

**When to use:** Emit domain-specific progress events from inside a node (file processed, retry attempted) without polluting state.

```python
from langgraph.config import get_stream_writer

def process(state: State) -> dict:
    writer = get_stream_writer()
    for i, item in enumerate(state["items"]):
        writer({"event": "item_start", "i": i, "id": item["id"]})
        run_expensive(item)
        writer({"event": "item_done", "i": i})
    return {"done": True}

for evt in graph.stream(inputs, config=config, stream_mode="custom"):
    print(evt)   # {"event": "item_start", "i": 0, ...}
```

**Why:** Custom writer bypasses state — emit ephemeral events without bloating checkpoints.

**Anti-pattern:** Adding `progress_log: list` to state just to emit UI events. Use the custom stream.

**ref:** https://docs.langchain.com/oss/python/langgraph/streaming

#### 6.4 `stream_mode=[...]` (multiple modes)

**When to use:** Need both deltas and tokens in one stream.

```python
for mode, chunk in graph.stream(
    inputs, config=config, stream_mode=["updates", "messages"]
):
    if mode == "updates":
        # chunk = {node: delta}
        ...
    elif mode == "messages":
        # chunk = (msg_chunk, metadata)
        ...
```

**Why:** When `stream_mode` is a list, each yielded item is a `(mode, chunk)` tuple — the mode tells you how to interpret the chunk.

**Anti-pattern:** Assuming flat chunks when passing a list of modes — the shape changes.

**ref:** https://docs.langchain.com/oss/python/langgraph/streaming

#### 6.5 `subgraphs=True` to surface subgraph events

**When to use:** Parent graph contains subgraphs and you want their stream events too.

```python
for namespace, chunk in graph.stream(
    inputs, config=config, stream_mode="updates", subgraphs=True,
):
    # namespace = () for parent, (subgraph_node_name, ...) for subgraph
    print(namespace, chunk)
```

**Why:** `subgraphs=True` opens streaming into nested subgraphs; each chunk arrives with its namespace path.

**Anti-pattern:** Compiling a subgraph but never seeing its progress because you forgot `subgraphs=True`.

**ref:** https://docs.langchain.com/oss/python/langgraph/streaming

#### 6.6 `version="v2"` — unified chunk format

**When to use:** You want a single uniform chunk shape regardless of mode / subgraph / single-vs-multi.

```python
for chunk in graph.stream(inputs, config=config, stream_mode="updates", version="v2"):
    # chunk shape: {"type": "updates", "ns": (...), "data": ...}
    print(chunk["type"], chunk["ns"], chunk["data"])
```

**Why:** v2 normalizes every chunk to `{type, ns, data}` — no more "is it a dict or a tuple?" branching.

**Anti-pattern:** Confusing `version="v2"` (chunk format) with `subgraphs=True` (event source). They are independent: enable both if you want unified shape + subgraph visibility.

**ref:** https://docs.langchain.com/oss/python/langgraph/streaming

---

### 7. Subgraphs & composition

#### 7.1 Subgraph with shared state schema (direct `add_node`)

**When to use:** Parent and subgraph use the same `State` type.

```python
class State(TypedDict):
    query: str
    answer: str

subgraph = subgraph_builder.compile()
parent.add_node("search", subgraph)   # passed directly
```

**Why:** When schemas match, LangGraph wires the subgraph as a transparent step — state flows through without adapters.

**Anti-pattern:** Writing a wrapper node when the schemas already align — unnecessary indirection.

**ref:** https://docs.langchain.com/oss/python/langgraph/use-subgraphs

#### 7.2 Subgraph with isolated state schema (wrapper node)

**When to use:** Subgraph has its own `State` that differs from the parent's.

```python
class SubState(TypedDict):
    query: str
    answer: str

class ParentState(TypedDict):
    user_request: str
    sub_answer: str

sub = sub_builder.compile()   # no checkpointer — default isolation

def call_sub(state: ParentState) -> dict:
    out = sub.invoke({"query": state["user_request"]})
    return {"sub_answer": out["answer"]}

parent.add_node("call_sub", call_sub)
```

**Why:** Wrapper node owns the schema translation. Subgraph compiled **without** its own checkpointer inherits the parent's for the duration of a single call — that's the official "per-invocation isolation" mode and it's the recommended default.

**Anti-pattern:** Compiling the subgraph with `MemorySaver()` + a synthetic UUID thread_id "for isolation". The docs explicitly say: omit the checkpointer; default mode already provides per-call isolation.

**ref:** https://docs.langchain.com/oss/python/langgraph/use-subgraphs

#### 7.3 Subgraph with independent persistent thread

**When to use:** Subgraph maintains its own multi-call memory, independent from the parent thread.

```python
sub = sub_builder.compile(checkpointer=True)   # explicit own checkpointer
# Parent's checkpointer is not shared; sub has its own thread namespace
```

**Why:** `checkpointer=True` tells the subgraph to own its persistence — useful when the subgraph IS the long-running agent and the parent is just a router.

**Anti-pattern:** Mixing `checkpointer=True` and parent thread inheritance — pick one model per subgraph.

**ref:** https://docs.langchain.com/oss/python/langgraph/use-subgraphs

#### 7.4 Deep Agents as a wrapped subgraph

**When to use:** Integrating a `deepagents` agent (planner + filesystem + subagents) into a larger LangGraph workflow.

```python
from deepagents import create_deep_agent

deep_agent = create_deep_agent(
    tools=[search_tool, write_tool],
    instructions="Plan and execute research tasks.",
)

# deep_agent is already a compiled LangGraph — treat it as a subgraph
def research_node(state: ParentState) -> dict:
    result = deep_agent.invoke({
        "messages": [{"role": "user", "content": state["topic"]}],
    })
    return {"research_summary": result["messages"][-1].content}

parent.add_node("research", research_node)
```

**Why:** Deep Agents return a compiled LangGraph. Wrap-and-translate is the same pattern as §7.2. Stream with `subgraphs=True` to see planner steps surface in the parent stream.

**Anti-pattern:** Treating Deep Agents as a special kind of node that needs custom interrupt propagation — it's a subgraph; standard subgraph rules apply.

**ref:** https://docs.langchain.com/oss/python/langgraph/use-subgraphs

---

### 8. Common pitfalls (auto-reject in code review)

#### 8.1 Mutating state in-place inside a node or reducer

```python
# WRONG
def bad_reducer(a, b):
    a.extend(b)        # mutates input
    return a

# RIGHT
def good_reducer(a, b):
    return [*a, *b]    # new list
```

**Why:** State must be immutable for checkpointer snapshots and parallel super-steps to work correctly. In-place mutation breaks both.

**ref:** https://docs.langchain.com/oss/python/langgraph/common-errors

#### 8.2 `interrupt()` without checkpointer

```python
# WRONG
graph = builder.compile()
graph.invoke(...)   # interrupt() will raise

# RIGHT
graph = builder.compile(checkpointer=MemorySaver())
```

**Why:** Resume requires the paused state to be persisted somewhere. No checkpointer = no resume path.

**ref:** https://docs.langchain.com/oss/python/langgraph/interrupts

#### 8.3 Unconditional self-edges (infinite loop)

```python
# WRONG
builder.add_edge("refine", "refine")

# RIGHT
builder.add_conditional_edges("refine", lambda s:
    END if s["iter"] >= 5 else "refine")
```

**Why:** Loops require explicit termination. LangGraph's `recursion_limit` is a fail-safe, not a design tool.

**ref:** https://docs.langchain.com/oss/python/langgraph/common-errors

#### 8.4 Node returning non-dict (or wrong keys)

```python
# WRONG
def node(state):
    return "some string"   # not a state delta

# RIGHT
def node(state: State) -> dict:
    return {"key": "value"}   # keys must exist in State
```

**Why:** Node returns are state deltas merged via reducers. Non-dict crashes the run; unknown keys silently no-op.

**ref:** https://docs.langchain.com/oss/python/langgraph/common-errors

#### 8.5 `interrupt(value=...)` (kwarg) or `Command(resume=True)` via `config`

```python
# WRONG
decision = interrupt(value="Approve?")
graph.invoke(None, config={"resuming": True, ...})

# RIGHT
decision = interrupt("Approve?")
graph.invoke(Command(resume=True), config={...})
```

**Why:** `interrupt` takes a positional payload; resume always travels as a `Command(resume=...)` argument to `invoke` / `stream`. No alternative config-based path exists.

**ref:** https://docs.langchain.com/oss/python/langgraph/interrupts

#### 8.6 `Send` returned from a regular node

```python
# WRONG
def my_node(state) -> list:
    return [Send("worker", {"item": i}) for i in state["items"]]
builder.add_node("my_node", my_node)
builder.add_edge("start", "my_node")

# RIGHT — Send must come from a conditional edge function
def fanout(state):
    return [Send("worker", {"item": i}) for i in state["items"]]
builder.add_conditional_edges("start", fanout, ["worker"])
```

**Why:** Send schedules dynamic edges — it has to live in the edge layer, not the node layer.

**ref:** https://docs.langchain.com/oss/python/langgraph/graph-api

#### 8.7 Confusing `subgraphs=True` with `version="v2"`

```python
# Mixed up
for chunk in graph.stream(inputs, stream_mode="updates", version="v2"):
    # Subgraph events do NOT appear unless subgraphs=True is also set

# Correct combination if you want both
for chunk in graph.stream(
    inputs, stream_mode="updates", subgraphs=True, version="v2",
):
    ...
```

**Why:** `subgraphs=True` controls event source (parent only vs parent + nested). `version="v2"` controls chunk format. Independent flags.

**ref:** https://docs.langchain.com/oss/python/langgraph/streaming

---

## Output style (prescriptive, not descriptive)

For every requirement, produce:
1. **Node / edge implementation** — runnable code with real imports
2. **State field additions** — typed delta
3. **Graph wiring** — `add_node`, `add_edge`, `add_conditional_edges`
4. **Pattern rationale** — why this over alternatives (1-2 sentences)
5. **Test points** — what to assert

Do NOT produce academic explanations. Produce code + decisions.

## Documentation source

Consult live docs (not training data — LangGraph evolves fast). The
`docs_index` URL in the frontmatter points to the canonical `llms.txt`.
For any specific question, fetch the URL from the Live documentation table.

If running offline or the docs are unreachable, fall back to the patterns in
this skill — they were distilled and spot-checked against the canonical pages
listed above.

## Important — Code-Reviewer auto-rejects

- Mutation of state inside a node or reducer (see §8.1)
- Missing checkpointer in a graph that uses `interrupt()` (see §8.2)
- Untyped state (raw `dict`) on multi-node graphs — use TypedDict or Pydantic
- Unconditional self-edge / missing loop guard (see §8.3)
- Node returning non-dict or keys not present in the State schema (see §8.4)
- `interrupt(value=...)` kwarg syntax or `config={"resuming": ...}` resume attempt (see §8.5)
- `Send` returned from a regular node instead of a conditional edge (see §8.6)
- Subgraph compiled with synthetic per-call thread_id + MemorySaver "for isolation" — default mode already isolates (see §7.2)
