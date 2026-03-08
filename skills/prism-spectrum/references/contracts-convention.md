# Contracts Convention

The `.prism/shared/contracts/` directory holds structured cross-domain contracts that stories read and write during Spectrum execution. Contracts formalize the interfaces between domains so that stories implemented in separate sessions can coordinate without shared context.

## Directory Structure

```
.prism/shared/contracts/
├── interfaces.json       # Type shapes shared between domains
├── api-endpoints.json    # API endpoint contracts (routes, methods, payloads)
├── component-props.json  # UI component prop contracts
├── dependencies.json     # Cross-domain dependency graph
└── test-obligations.json # What each domain must verify
```

## Contract Lifecycle

### 1. Proposed

A story's manifest declares `contracts_to_write: ["interfaces.json"]`. During implementation, the story creates or updates the contract file with its proposed shapes.

### 2. Agreed

When multiple stories depend on the same contract (one writes, others read), the contract becomes an agreement. The writing story defines the shape; reading stories implement against it.

### 3. Verified

After all stories that reference a contract are complete, the contract is considered verified. Quality gates confirm both sides of the interface work together.

## Contract File Format

Each contract file is a JSON object. The structure depends on the contract type:

### interfaces.json

```json
{
  "UserProfile": {
    "defined_by": "STORY-001",
    "consumed_by": ["STORY-003", "STORY-005"],
    "shape": {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "admin | user | guest"
    }
  }
}
```

### api-endpoints.json

```json
{
  "/api/users/:id": {
    "method": "GET",
    "defined_by": "STORY-002",
    "consumed_by": ["STORY-004"],
    "request": {},
    "response": { "$ref": "UserProfile" }
  }
}
```

### dependencies.json

```json
{
  "STORY-003": {
    "reads": ["interfaces.json#UserProfile"],
    "writes": ["api-endpoints.json#/api/users/:id"]
  }
}
```

## When to Create Contracts

Contracts are needed when:

- Multiple stories touch the same interface (type, API, component props)
- A story produces output consumed by a later story
- Cross-domain boundaries exist (backend/frontend, service/service)

Contracts are NOT needed for:

- Stories that are self-contained
- Internal implementation details
- Single-story changes to existing interfaces

## Integration with Spectrum

Since Spectrum executes stories sequentially in fresh sessions:

1. The writing story creates the contract file
2. The contract is committed to git
3. The reading story loads it in a later session via `contracts_to_read`
4. No runtime coordination needed — git is the transport layer
