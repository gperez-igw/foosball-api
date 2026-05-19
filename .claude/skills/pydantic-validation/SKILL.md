---
name: pydantic-validation
description: >-
  Pydantic v2 core validation patterns for Python projects: BaseModel design,
  field constraints, custom validators (field/model, before/after), TypeAdapter
  for non-model validation, serialization (model_dump, custom serializers),
  generic models, settings, and performance. Use for typed I/O in any Python
  project — backend DTOs, config, request/response models. NOT for agentic
  output validation specifically — use pydantic-ai-patterns for that.
license: MIT
metadata:
  author: agentflow
  version: "0.1"
  recommended_for: [backend, architect, code-reviewer]
  triggers:
    - tech_stack includes Python AND Pydantic
    - source code imports "pydantic" (BaseModel, TypeAdapter, Field)
    - request involves typed request/response models, config validation, DTOs
  skip_when:
    - non-Python project
    - dataclasses or attrs are explicitly chosen over Pydantic
    - LLM output validation specifically (use pydantic-ai-patterns)
  docs_index: https://pydantic.dev/docs/validation/latest/llms.txt
---

# Skill: pydantic-validation

Specialization in **Pydantic v2 typed I/O** for backend Python code. Covers
model design, validation, serialization, and common gotchas.

For AI / LLM output validation specifically → use `pydantic-ai-patterns`.

## When to use

- Backend: defining request/response models, DTOs, config, ORM-adjacent types
- Architect: declaring data contracts in feature specs
- Code-Reviewer: reviewing model definitions for validation gaps, mutation
  bugs, missing constraints

## When NOT to use

- LLM agent output schemas → use `pydantic-ai-patterns` (it covers retries,
  partial outputs, discriminated unions for routing)
- Non-Python validation → use stack-specific validation skills
- Schema-less data (raw JSON pass-through) → Pydantic is overkill

## Live documentation

The patterns below cover the common cases. For edge cases not distilled here,
fetch the official docs via `WebFetch`. **Do NOT fetch the full index unless
you need to discover an unknown section** — go straight to the targeted page.

**Documentation index**: <https://pydantic.dev/docs/validation/latest/llms.txt>

**Direct URLs by topic**:

| Topic | URL |
|-------|-----|
| Models (BaseModel, inheritance, config) | <https://pydantic.dev/docs/validation/latest/concepts/models/index.md> |
| Configuration (ConfigDict, frozen, extra) | <https://pydantic.dev/docs/validation/latest/concepts/config/index.md> |
| Fields (Field constraints, Annotated) | <https://pydantic.dev/docs/validation/latest/concepts/fields/index.md> |
| Validators (field_validator, model_validator) | <https://pydantic.dev/docs/validation/latest/concepts/validators/index.md> |
| Types (custom types, Annotated) | <https://pydantic.dev/docs/validation/latest/concepts/types/index.md> |
| Unions (discriminated unions, tagged) | <https://pydantic.dev/docs/validation/latest/concepts/unions/index.md> |
| TypeAdapter | <https://pydantic.dev/docs/validation/latest/concepts/type_adapter/index.md> |
| Serialization (model_dump, by_alias) | <https://pydantic.dev/docs/validation/latest/concepts/serialization/index.md> |
| Alias (snake_case ↔ camelCase) | <https://pydantic.dev/docs/validation/latest/concepts/alias/index.md> |
| JSON | <https://pydantic.dev/docs/validation/latest/concepts/json/index.md> |
| JSON Schema | <https://pydantic.dev/docs/validation/latest/concepts/json_schema/index.md> |
| Strict mode | <https://pydantic.dev/docs/validation/latest/concepts/strict_mode/index.md> |
| Performance (TypeAdapter caching, model_construct) | <https://pydantic.dev/docs/validation/latest/concepts/performance/index.md> |
| Settings management (BaseSettings) | <https://pydantic.dev/docs/validation/latest/concepts/pydantic_settings/index.md> |
| Dataclasses | <https://pydantic.dev/docs/validation/latest/concepts/dataclasses/index.md> |
| API: BaseModel | <https://pydantic.dev/docs/validation/latest/api/pydantic/base_model/index.md> |
| API: Fields | <https://pydantic.dev/docs/validation/latest/api/pydantic/fields/index.md> |
| API: Functional Validators | <https://pydantic.dev/docs/validation/latest/api/pydantic/functional_validators/index.md> |
| API: Functional Serializers | <https://pydantic.dev/docs/validation/latest/api/pydantic/functional_serializers/index.md> |
| API: TypeAdapter | <https://pydantic.dev/docs/validation/latest/api/pydantic/type_adapter/index.md> |
| API: Configuration | <https://pydantic.dev/docs/validation/latest/api/pydantic/config/index.md> |
| API: Errors / PydanticCustomError | <https://pydantic.dev/docs/validation/latest/api/pydantic/errors/index.md> |
| API: Pydantic Settings | <https://pydantic.dev/docs/validation/latest/api/pydantic_settings/index.md> |
| Validation errors reference | <https://pydantic.dev/docs/validation/latest/errors/validation_errors/index.md> |
| ORM integration example | <https://pydantic.dev/docs/validation/latest/examples/orms/index.md> |
| Web/API request example | <https://pydantic.dev/docs/validation/latest/examples/requests/index.md> |
| v1 → v2 migration | <https://pydantic.dev/docs/validation/latest/get-started/migration/index.md> |

For ANY other section (network types, extra types, internals), fetch the
index above first to discover the right URL.

## Patterns

### 1. Model basics

#### Pattern: BaseModel with required and optional fields
**When**: Standard DTO/config model with type safety and validation.
```python
from typing import Optional
from pydantic import BaseModel, ValidationError

class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None
    is_active: bool = True

    model_config = {"extra": "forbid"}

user = User(id=1, name="Alice", email="alice@example.com")
# Extra field is rejected
try:
    User(id=1, name="Bob", email="bob@example.com", role="admin")
except ValidationError:
    pass
```
**Why this vs alternatives**: `BaseModel` is the core primitive — use for all typed I/O contracts. `Optional[T]` + `= None` is clearer than `| None` in older codebases (both work). `extra='forbid'` catches accidental schema drift.
**Anti-pattern**: Using Python `dataclass` for API models — lacks Pydantic's validation/serialization hooks.

#### Pattern: Immutable models with `frozen=True`
**When**: Config values, DTOs at service boundaries, hash-needing collections.
```python
from pydantic import BaseModel, ConfigDict

class FeatureFlag(BaseModel):
    name: str
    enabled: bool

    model_config = ConfigDict(frozen=True)

flag = FeatureFlag(name="beta", enabled=True)
# flag.enabled = False  # raises ValidationError
feature_set = {flag}  # hashable
```
**Why this vs alternatives**: Frozen models generate `__hash__` and prevent mutation — safe for caching/memoization. Small overhead; use only when immutability is a contract requirement.
**Anti-pattern**: `frozen=True` defensively everywhere — adds cost without benefit.

#### Pattern: Model inheritance for shared fields
**When**: Sharing common fields (timestamps, audit) across multiple models.
```python
from datetime import datetime
from pydantic import BaseModel

class BaseEntity(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime

class BlogPost(BaseEntity):
    title: str
    content: str

class Comment(BaseEntity):
    post_id: int
    author: str
    text: str
```
**Why this vs alternatives**: Validators and config from parent classes are inherited and can be overridden — DRY without sacrificing safety.

#### Pattern: Extra field policy (`allow` with typed `__pydantic_extra__`)
**When**: Dynamic fields are genuinely needed (rare); want them typed.
```python
from pydantic import BaseModel, ConfigDict, Field

class FlexModel(BaseModel):
    x: int
    __pydantic_extra__: dict[str, int] = Field(init=False)
    model_config = ConfigDict(extra="allow")

m = FlexModel(x=1, y=2)
assert m.__pydantic_extra__ == {"y": 2}
```
**Why this vs alternatives**: `extra='forbid'` is safest for APIs. Use `extra='allow'` only when dynamic fields are required, and ALWAYS type `__pydantic_extra__`. `ignore` (default) is lenient but hides schema mismatches.
**Anti-pattern**: `extra='allow'` without typing `__pydantic_extra__` — untyped extras defeat validation.

### 2. Field constraints

#### Pattern: Numeric constraints with `Annotated`
**When**: Enforce numeric bounds (age > 0, port 1–65535, multiples).
```python
from typing import Annotated
from pydantic import BaseModel, Field

class Product(BaseModel):
    price: Annotated[float, Field(gt=0)] = 10.0
    discount_percent: Annotated[float, Field(ge=0, le=100)] = 0
    inventory: Annotated[int, Field(ge=0)] = 0
    quantity_steps: Annotated[int, Field(multiple_of=5)] = 5
```
**Why this vs alternatives**: Inline `Annotated[T, Field(...)]` keeps constraints on the type hint — composable and discoverable. Alternative: bare `Field()` call (verbose) or custom validator (overkill for simple bounds).

#### Pattern: String constraints (length, regex)
**When**: Enforce string format (username length, postal code regex).
```python
from typing import Annotated
from pydantic import BaseModel, Field

class Profile(BaseModel):
    username: Annotated[str, Field(min_length=3, max_length=20)]
    postal_code: Annotated[str, Field(pattern=r'^\d{5}$')]
    bio: Annotated[str, Field(max_length=500)] = ""
```
**Why this vs alternatives**: Declarative, composable. `pattern` accepts strings or compiled regex (compiled is faster if reused). Global `ConfigDict` `str_min_length` / `str_max_length` only for universal rules.

#### Pattern: Collection constraints
**When**: Bounding array/dict sizes (max 100 items in bulk).
```python
from typing import Annotated
from pydantic import BaseModel, Field

class BulkRequest(BaseModel):
    ids: Annotated[list[int], Field(min_length=1, max_length=100)]
    metadata: Annotated[dict[str, str], Field(max_length=50)] = {}
```
**Why this vs alternatives**: Pydantic shorthand for sequence/dict bounds. Cleaner than custom validators.

#### Pattern: Composable custom types
**When**: Reuse a constraint across multiple models (e.g., `EvenNumber`).
```python
from typing import Annotated
from pydantic import BaseModel, Field, AfterValidator

def validate_even(v: int) -> int:
    if v % 2 != 0:
        raise ValueError("must be even")
    return v

EvenNumber = Annotated[int, Field(ge=0), AfterValidator(validate_even)]
StrictEmail = Annotated[str, Field(pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')]

class Config(BaseModel):
    port: EvenNumber
    admin_email: StrictEmail
```
**Why this vs alternatives**: Reusable, composable, type-safe. Constraints + validators compose left-to-right.
**Anti-pattern**: Bare `Field()` without `Annotated` — harder to reuse.

### 3. Validators

#### Pattern: `@field_validator` with `mode='after'` (default)
**When**: Validate a single field AFTER type coercion (most common).
```python
from pydantic import BaseModel, field_validator, ValidationError

class User(BaseModel):
    username: str
    password: str

    @field_validator('username', mode='after')
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("username must be alphanumeric")
        return v

    @field_validator('password', mode='after')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be >= 8 chars")
        return v
```
**Why this vs alternatives**: `mode='after'` is safest — type is guaranteed valid. Use before/wrap only when you need raw input access or short-circuit logic.
**Anti-pattern**: `mode='before'` for post-parse checks — error messages become confusing when raw input is malformed.

#### Pattern: `@field_validator` with `mode='before'` (preprocessing)
**When**: Coerce raw input before parsing (string → list, normalization).
```python
from typing import Any
from pydantic import BaseModel, field_validator

class SearchQuery(BaseModel):
    tags: list[str]

    @field_validator('tags', mode='before')
    @classmethod
    def ensure_list(cls, v: Any) -> Any:
        if isinstance(v, str):
            return [v]
        return v
```
**Why this vs alternatives**: `mode='before'` runs before type parsing. Avoid mutations if you're raising errors — side effects leak to other validators in unions.

#### Pattern: `@model_validator` for cross-field invariants
**When**: Enforce relationships between multiple fields (password match).
```python
from typing_extensions import Self
from pydantic import BaseModel, model_validator

class PasswordReset(BaseModel):
    password: str
    password_repeat: str

    @model_validator(mode='after')
    def passwords_match(self) -> Self:
        if self.password != self.password_repeat:
            raise ValueError("passwords do not match")
        return self
```
**Why this vs alternatives**: `mode='after'` is an instance method — access to all fields, aggregated errors. Cleaner than `@field_validator` with `info.data` (requires field ordering).

#### Pattern: Custom structured errors with `PydanticCustomError`
**When**: Structured error codes for programmatic handling (frontend retry logic).
```python
from pydantic_core import PydanticCustomError
from pydantic import BaseModel, field_validator

class Order(BaseModel):
    quantity: int

    @field_validator('quantity', mode='after')
    @classmethod
    def check_stock(cls, v: int) -> int:
        if v > 1000:
            raise PydanticCustomError(
                'insufficient_stock',
                'only {available} units available',
                {'available': 1000}
            )
        return v
```
**Why this vs alternatives**: Reusable error codes with templated messages. `ValueError` is simpler for one-offs but loses semantic info.

#### Pattern: Validator composition with `Annotated`
**When**: Reuse validators across models without repeating decorator code.
```python
from typing import Annotated
from pydantic import BaseModel, AfterValidator

def is_positive(v: int) -> int:
    if v <= 0:
        raise ValueError("must be positive")
    return v

def clamp_to_100(v: int) -> int:
    return min(v, 100)

PositiveScore = Annotated[int, AfterValidator(is_positive), AfterValidator(clamp_to_100)]

class Quiz(BaseModel):
    user_score: PositiveScore
    passing_score: PositiveScore
```
**Why this vs alternatives**: Reusable, composable, discoverable. Decorator pattern is better only for multi-field rules in one model.

#### Anti-pattern: Pydantic v1 `@validator`
Pydantic v2 uses `@field_validator` / `@model_validator`. Code-Reviewer
auto-rejects v1-style `@validator` in v2 projects.

### 4. TypeAdapter (validating without a BaseModel)

#### Pattern: Validate primitives and generics
**When**: Validate a single type without wrapping in a model.
```python
from pydantic import TypeAdapter, ValidationError

int_list_adapter = TypeAdapter(list[int])
result = int_list_adapter.validate_python([1, 2, 3])
# Fails on mixed types
try:
    int_list_adapter.validate_python([1, "two", 3])
except ValidationError:
    pass
```
**Why this vs alternatives**: Avoids wrapper-model boilerplate. Faster for simple schema validation (JSON endpoint responses).

#### Pattern: JSON validation in one pass
**When**: Validate raw JSON bytes/strings without first decoding to dict.
```python
from pydantic import TypeAdapter

UserListAdapter = TypeAdapter(list[dict[str, str]])

json_str = '[{"name": "Alice", "email": "alice@example.com"}]'
users = UserListAdapter.validate_json(json_str)
# Also works with bytes
users = UserListAdapter.validate_json(b'[{"name": "Bob"}]')
```
**Why this vs alternatives**: `validate_json()` is faster than decode-then-validate — Pydantic-core parses in a single pass. Use for streaming or hot-path I/O.

#### Pattern: TypeAdapter with config
**When**: Apply validation config (strict, extra) to a non-model type.
```python
from pydantic import TypeAdapter, ConfigDict

strict_adapter = TypeAdapter(dict[str, int], config=ConfigDict(strict=True))
# Coercion rejected
try:
    strict_adapter.validate_python({"x": "1"})
except Exception:
    pass
```
**Why this vs alternatives**: Config mirrors BaseModel — consistent rules across wrapper and non-wrapper paths.

### 5. Serialization

#### Pattern: `model_dump()` with mode, exclude flags
**When**: Convert model to dict for API response, logging, or storage.
```python
from pydantic import BaseModel

class BlogPost(BaseModel):
    id: int
    title: str
    author_id: int | None = None
    draft: bool = False

post = BlogPost(id=1, title="Hello")
post.model_dump()                       # python objects
post.model_dump(mode='json')            # JSON-safe (datetime → str, etc.)
post.model_dump(exclude_none=True)      # trim None values
post.model_dump(exclude_defaults=True)  # trim defaults
```
**Why this vs alternatives**: Built-in flags are cleaner than manual dict comprehension. `mode='json'` ensures JSON-safety.
**Anti-pattern**: Dumping all fields without filtering — exposes internal defaults to clients.

#### Pattern: `@field_serializer` for custom output
**When**: Reformat a single field on output (set → sorted list, secret redaction).
```python
from pydantic import BaseModel, field_serializer

class UserProfile(BaseModel):
    name: str
    skills: set[str]
    password: str

    @field_serializer('skills', when_used='json')
    def serialize_skills(self, value: set[str]) -> list[str]:
        return sorted(value)

    @field_serializer('password', when_used='json')
    def redact_password(self, value: str) -> str:
        return "***"
```
**Why this vs alternatives**: Applies only on output — input validation stays separate. `when_used='json'` differs between Python and JSON modes (common for APIs).

#### Pattern: `exclude_unset` for PATCH semantics
**When**: Serializing only user-provided fields, omitting defaults.
```python
class Settings(BaseModel):
    theme: str = "light"
    language: str = "en"
    notifications_enabled: bool = True

update = Settings(theme="dark")
update.model_dump(exclude_unset=True)
# {'theme': 'dark'}
```
**Why this vs alternatives**: PATCH-style updates send only changed fields. Cleaner than tracking changes manually.

#### Pattern: `by_alias` for snake_case ↔ camelCase
**When**: Backend uses snake_case, frontend expects camelCase.
```python
from pydantic import BaseModel, Field

class Product(BaseModel):
    product_id: int = Field(alias='productId')
    product_name: str = Field(alias='productName')

product = Product(productId=1, productName="Widget")
product.model_dump(by_alias=True)
# {'productId': 1, 'productName': 'Widget'}
```
**Why this vs alternatives**: Decouples internal naming from external contract. Cleaner than separate serializer classes.

### 6. Generic models

#### Pattern: `Generic[T]` for reusable containers
**When**: Paginated response, result wrapper, anything parameterized.
```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int = 1
    page_size: int = 10

class User(BaseModel):
    id: int
    name: str

UserPaginatedResponse = PaginatedResponse[User]
resp = UserPaginatedResponse(items=[User(id=1, name="Bob")], total=1)
```
**Why this vs alternatives**: Type-safe and reusable. Avoids `PaginatedUsers`, `PaginatedProducts`, etc.

#### Pattern: Discriminated unions for polymorphic payloads
**When**: Routing based on a type field (event type, message type).
```python
from typing import Annotated, Union, Literal
from pydantic import BaseModel, Field

class UserCreated(BaseModel):
    type: Literal["user_created"]
    user_id: int

class OrderPlaced(BaseModel):
    type: Literal["order_placed"]
    order_id: int
    amount: float

Event = Annotated[Union[UserCreated, OrderPlaced], Field(discriminator='type')]
```
**Why this vs alternatives**: Discriminator enables O(1) dispatch and clear schema. Non-discriminated unions try all branches (slow, poor errors).

### 7. Custom types and validation contexts

#### Pattern: Reusable domain types with `Annotated` validators
**When**: Build `UserId`, `Email`, `PhoneNumber` with embedded validation.
```python
from typing import Annotated
from pydantic import BaseModel, AfterValidator

def validate_phone(v: str) -> str:
    digits = ''.join(c for c in v if c.isdigit())
    if len(digits) != 10:
        raise ValueError("must be 10 digits")
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"

def validate_email(v: str) -> str:
    if "@" not in v:
        raise ValueError("invalid email")
    return v.lower()

PhoneNumber = Annotated[str, AfterValidator(validate_phone)]
Email = Annotated[str, AfterValidator(validate_email)]

class Contact(BaseModel):
    name: str
    email: Email
    phone: PhoneNumber
```
**Why this vs alternatives**: Composable, reusable, type-safe. Cleaner than separate validator classes or app-level normalization.

#### Pattern: Validation context for request-scoped data
**When**: Pass runtime info (user role, request ID) into validators.
```python
from pydantic import BaseModel, field_validator, ValidationInfo

class Document(BaseModel):
    title: str
    is_public: bool

    @field_validator('is_public', mode='after')
    @classmethod
    def check_visibility(cls, v: bool, info: ValidationInfo) -> bool:
        if isinstance(info.context, dict):
            role = info.context.get('user_role', 'guest')
            if v and role == 'guest':
                raise ValueError("guests cannot create public documents")
        return v

# Use via model_validate
Document.model_validate(
    {"title": "A", "is_public": True},
    context={"user_role": "admin"}
)
```
**Why this vs alternatives**: Pass runtime state into validators without globals or monkey-patching.

### 8. Settings (pydantic-settings)

#### Pattern: `BaseSettings` with `SettingsConfigDict`
**When**: Configuration driven by environment variables / `.env`. Use
`SettingsConfigDict` (not plain dict) for type safety and IDE completion.
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    database_url: str
    api_key: str
    debug: bool = False
    max_connections: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

class ServiceSettings(BaseSettings):
    host: str = "localhost"
    port: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SERVICE_",  # SERVICE_HOST, SERVICE_PORT
    )
```
**Why this vs alternatives**: Reads env vars with type coercion ("8000" → 8000). `SettingsConfigDict` is the recommended modern config style (plain dict works but lacks type hints).
**Anti-pattern**: Manual `os.getenv` + casting — loses validation and type safety.

#### Pattern: Nested settings via `env_nested_delimiter`
**When**: Settings have nested structure and you want each leaf as a flat env var.
```python
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

class DatabaseSettings(BaseModel):
    host: str
    port: int = 5432
    user: str

class AppSettings(BaseSettings):
    database: DatabaseSettings
    api_key: str

    model_config = SettingsConfigDict(env_nested_delimiter="__")

# Env vars:
#   DATABASE__HOST=db.example.com
#   DATABASE__PORT=5432
#   DATABASE__USER=admin
#   API_KEY=...
settings = AppSettings()
```
**Why this vs alternatives**: Flat env vars are easier in 12-factor / container deployments. Alternative: a single JSON string in one env var (less ergonomic).

#### Pattern: `SecretStr` for sensitive values
**When**: Passwords, API keys that should not appear in logs or repr.
```python
from pydantic import BaseModel, SecretStr

class Credentials(BaseModel):
    username: str
    password: SecretStr

creds = Credentials(username="alice", password="supersecret")
print(creds)
#> username='alice' password=SecretStr('**********')
actual = creds.password.get_secret_value()
creds.model_dump(mode='json')
#> {'username': 'alice', 'password': '**********'}
```
**Why this vs alternatives**: Redacts on repr/serialization by default. Prevents accidental exposure.

### 9. Performance and gotchas

#### Pattern: `model_validate` vs constructor
**When**: Distinguish: model_validate = always validate (dict/JSON source); constructor = validate by default (programmatic creation).
```python
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str

user1 = User(id=1, name="Alice")                              # validates
user2 = User.model_validate({"id": 1, "name": "Bob"})         # validates
```
**Why this vs alternatives**: Both paths validate identically. Use `model_validate()` for dict/JSON to be explicit. `model_construct()` skips validation — only on trusted data on hot paths.

#### Pattern: `model_copy(deep=True)` for mutable fields
**When**: Modify a copy without affecting the original; mutable collections inside.
```python
class Config(BaseModel):
    name: str
    tags: list[str]

original = Config(name="prod", tags=["important"])

# Shallow (default): mutable fields share references — DANGEROUS
shallow = original.model_copy(update={"name": "dev"})
shallow.tags.append("debug")
# original.tags is also affected!

# Deep: truly independent
deep = original.model_copy(update={"name": "staging"}, deep=True)
```
**Why this vs alternatives**: `deep=True` is safer but slower. Use only if you'll mutate collections; immutable primitives don't need it.

#### Pattern: `default_factory` for mutable defaults
**When**: Field has a mutable default (list, dict) — MUST use factory.
```python
from pydantic import BaseModel, Field

# WRONG: shared mutable default
class BadModel(BaseModel):
    tags: list[str] = []

# CORRECT
class GoodModel(BaseModel):
    tags: list[str] = Field(default_factory=list)
```
**Why this vs alternatives**: `default_factory` creates a new instance per model. Bare mutable defaults are shared across instances.
**Anti-pattern**: Bare `list`/`dict` as default. Code-Reviewer auto-rejects.

#### Pattern: Cache `TypeAdapter` at module level
**When**: Validating the same type repeatedly in a hot path (API loop).
```python
from pydantic import TypeAdapter

# Module-level: cached, no schema rebuild
UserListAdapter = TypeAdapter(list[dict[str, str]])

def process_batch(json_data: str):
    users = UserListAdapter.validate_json(json_data)
    return [u['name'] for u in users]
```
**Why this vs alternatives**: Cached adapter avoids rebuilding schema on every call. Creating new `TypeAdapter()` per call is wasteful in tight loops.

#### Pattern: `model_construct` for trusted, pre-validated data
**When**: Rare — data from trusted source (ORM, cached validation), want to skip re-validation.
```python
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str

orm_row = {"id": 1, "name": "Alice"}
user = User.model_construct(**orm_row)  # 2-5x faster, NO validation
# bad_user = User.model_construct(id="string", name=123)  # accepted! dangerous
```
**Why this vs alternatives**: 2-5x faster but unsafe. Only when input is guaranteed elsewhere.
**Anti-pattern**: `model_construct()` on user input. Code-Reviewer auto-rejects unless documented on a hot path.

#### Pattern: `from_attributes=True` for ORM conversion
**When**: Converting ORM objects (SQLAlchemy, Django) to Pydantic models.
```python
from pydantic import BaseModel, ConfigDict

class UserModel(BaseModel):
    id: int
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)

user = UserModel.model_validate(orm_user)  # reads attributes, not dict keys
```
**Why this vs alternatives**: Extracts object attributes. Cleaner than manual `__dict__` (misses properties, lazy attrs).
**Anti-pattern**: Missing `from_attributes=True` when validating ORM objects — validation fails silently.

### 10. Common patterns

#### Pattern: Request / response models for FastAPI / Litestar
**When**: Type-safe DTOs for web APIs.
```python
from pydantic import BaseModel, Field

class CreatePostRequest(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    content: str = Field(min_length=10)
    tags: list[str] = Field(default_factory=list, max_length=10)
    draft: bool = False

class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    tags: list[str]
    draft: bool
    created_at: str
```
**Why this vs alternatives**: Frameworks auto-validate request bodies and serialize responses. Validation errors → 422. Cleaner than dataclasses or manual handlers.

#### Pattern: Response model with `@computed_field`
**When**: Output includes derived fields not in DB (age from birthdate, display_name).
```python
from datetime import date
from pydantic import BaseModel, computed_field

class UserResponse(BaseModel):
    first_name: str
    last_name: str
    birthdate: date

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
```
**Why this vs alternatives**: Calculates on output without storing in DB. Cleaner than manual dict assembly; avoids data consistency risk.

#### Pattern: Strict mode for type safety
**When**: Forbid coercion (`"1"` → `1`) to catch client mistakes early.
```python
from typing import Annotated
from pydantic import BaseModel, Field, ConfigDict

class StrictRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    id: int
    count: int

# Per-field strict
class MixedRequest(BaseModel):
    id: Annotated[int, Field(strict=True)]
    count: int  # lax
```
**Why this vs alternatives**: Catches schema violations early (string IDs from clients). Lax mode is forgiving but hides bugs.

## Output style (prescriptive, not descriptive)

For every modeling task, produce:
1. **Model code** — runnable, with Annotated constraints inline
2. **Validators** — only the ones the contract actually needs
3. **Serialization config** — explicit about exclude_none / by_alias / etc.
4. **Test stub** — `model_validate({...})` happy path + at least one
   constraint-violation case
5. **Anti-pattern note** — if there's a wrong way that looks tempting

Do NOT produce academic explanations. Produce code + decisions.

## Documentation source

- Distilled patterns: this skill file (the 30+ patterns above cover the
  common cases)
- Edge cases / advanced topics: fetch via `WebFetch` from the direct URLs
  in the **Live documentation** section above
- Pydantic v2 evolves across minor versions — if a behavior surprises you,
  verify against the current docs before debugging further

## Important

- Code-Reviewer auto-rejects:
  - Pydantic v1-style validators (`@validator` instead of `@field_validator`) in v2 projects
  - `BaseModel.__init__` overrides instead of `model_validator(mode='before')`
  - Skipping validation via `model_construct` outside a documented hot-path
  - Mutable default values without `default_factory`
  - Missing `from_attributes=True` when validating from ORM objects
  - Catching `ValidationError` and silently passing — always log or re-raise
