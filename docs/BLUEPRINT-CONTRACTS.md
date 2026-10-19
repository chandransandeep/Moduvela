# Moduvela — business blueprint contracts

MicroAI's intention is to interpret business requirements, **not to generate an unrestricted executable app**.

## Layers

1. **Data objects and attributes**: Blueprint v1 entities/fields. This is implemented.
2. **Relationships**: explicit source field targeting a record in another entity. Configurable and enforced by the local relationship engine; owner must draft/activate the link. It does not come from automatically accepting an AI hypothesis.
3. **State-machine workflows**: owner-configured list of states, initial state and allowed transitions. Draft then explicit activation. The local runtime validates all transitions and logs them. **No guards, roles, approvals, webhooks or scripts.**
4. **Conditional approvals and deadlines**: only design proposals. Manager authorization and external notifications are not implemented.
5. **Security**: no login/tenant isolation, so these demo workflows and references are **not safe for real business operations**.

## Supported deterministic workflow contract

```json
{
  "entity": "Jobs",
  "initial": "new",
  "states": ["new", "in_progress", "completed"],
  "transitions": [
    {"from": "new", "to": "in_progress"},
    {"from": "in_progress", "to": "completed"}
  ]
}
```

Only the four keys above and unguarded `from`/`to` transitions are supported. Role and approval metadata fail validation. Source entity must exist with a `status` field; activation must occur before records are added. Existing records require a future migration system.

## Supported record-link contract

```json
{
  "source": "Jobs",
  "field": "customer",
  "target": "Customers"
}
```

When a link is active, a nonempty `Jobs.customer` field contains the numeric ID of a `Customers` record in the same blueprint; references are validated on creation and update, and deleting referenced targets is blocked. These are optional text-based references, not full database foreign keys. There is no automatic UI join designer or cardinality configuration yet.

## UI demo

1. Approve an application with `Customers` and `Jobs` sections; `Jobs` must have `status` and `customer` fields.
2. Under Jobs, open **Configure workflow stages**, draft and activate `new > in_progress > completed`.
3. Under Jobs, open **Configure record links**, draft a `Jobs.customer` -> `Customers` link and activate it.
4. Add a fictional customer; the list displays a record ID.
5. Add a job pointing at that ID. A nonexistent ID is rejected.
6. Use workflow buttons on the job record. Invalid status jumps are rejected.

This can be tested entirely locally without AI. It does **not** implement secure manager approvals.

## Quality gates

- A change cannot activate a design proposal implicitly.
- No arbitrary code evaluation or raw SQL supplied by customer descriptions.
- Record-status edits are blocked when an active state machine controls them.
- Reference validation applies to add/update/delete.
- Future permissions must be identity-based and server-enforced before real users.
- Workflows and relationships require migration, rollback and recovery planning before production.
