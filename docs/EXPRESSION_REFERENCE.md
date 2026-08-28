# Vegam Expression Reference

Vegam's `SynthesisEngine` parses lightweight expressions to generate dynamic payload data for your event scenarios. This reference lists all supported expressions you can use in the **Visual Studio** or **Scenario YAML**.

## Core Synthesizer Rules

| Expression | Example | Output Description |
|---|---|---|
| **UUID** | `uuid()` | Standard v4 UUID string. Example: `"f47ac10b-58cc-4372-a567-0e02b2c3d479"` |
| **Timestamp (ms)** | `$NOW_MS` | Current epoch time in milliseconds. Example: `1753456789000` |
| **Timestamp (ISO)** | `$NOW_ISO` | Current ISO-8601 string. Example: `"2026-07-19T14:30:00Z"` |
| **Inherit upstream** | `$PREV.orderId` | Correlates value from the parent event packet. (Must match a field from the upstream node). |
| **Concatenation** | `"PREFIX-" + $PREV.id` | Combines literal strings with `$PREV` values. Example: `"ORD-1234"` |

## Statistical Distributions

| Expression | Example | Output Description |
|---|---|---|
| **Gaussian (Normal)** | `gaussian(200, 50)` | Normally distributed random float (Mean=200, StdDev=50). Example: `~183.4` |
| **Weighted Pick** | `weighted(["A","B","C"])` | Uniformly selects one item from the array. Example: `"B"` |

## Faker.js Integrations

You can use the full power of Faker.js to generate rich data.

| Expression | Example | Output Description |
|---|---|---|
| **Float Range** | `faker.number.float({min:10,max:500,fractionDigits:2})` | Float between 10 and 500 with 2 decimals. Example: `143.67` |
| **Integer Range** | `faker.number.int({min:1,max:100})` | Integer between 1 and 100. Example: `42` |
| **Email** | `faker.internet.email()` | Random email address. Example: `"user@example.com"` |
| **UUID (faker)** | `faker.string.uuid()` | Faker-generated UUID. Example: `"f47ac10b..."` |
| **Weighted Faker** | `faker.helpers.weighted([{v:"A",w:0.8}, {v:"B",w:0.2}])` | Weighted categorical selection (80% "A", 20% "B"). |

## Pattern Synthesis (Regex)

Use the powerful `randexp` engine to synthesize strings that match a specific Regular Expression.

| Expression | Example | Output Description |
|---|---|---|
| **Regex Match** | `/^ORD-[0-9]{4}$/` | String matching pattern. Example: `"ORD-4821"` |

## Static Primitives

| Expression | Example | Output Description |
|---|---|---|
| **Static String** | `"SETTLED"` | Literal string `"SETTLED"` |
| **Static Number** | `42` | Literal number `42` |
| **Boolean** | `true` | Boolean `true` or `false` |
