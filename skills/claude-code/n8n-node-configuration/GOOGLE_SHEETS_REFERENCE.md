# Google Sheets Node — Complete Reference

The most-used output node. This covers every field, operation, gotcha, and known bug.

---

## Operations Overview

**Resource: Sheet Within Document** (what you use 99% of the time)

| Operation | What it does |
|---|---|
| `Append Row` | Inserts as a new row — no deduplication, no read. Use for logs, event trails. |
| `Append or Update Row` | Reads the sheet, finds a match on **Column to Match On**, updates if found, appends if not. The n8n upsert. |
| `Get Row(s)` | Reads rows. Filters by column value or unfiltered (all). Returns each row as a separate n8n item with `row_number` field added. |
| `Update Row` | Updates an existing row by **row index number** — not by value. You need the row number from a prior `Get Row(s)`. |
| `Delete Row(s) or Column(s)` | Deletes by row or column index. |
| `Clear` | Wipes data from range, leaves sheet tab intact. |
| `Create Sheet` | Adds a new tab to an existing spreadsheet. |
| `Delete Sheet` | Removes a tab. |

**Resource: Spreadsheet** (rarely needed)
- `Create Spreadsheet` — Creates a new Google Sheets file
- `Delete Spreadsheet` — Permanently deletes the file

---

## append vs appendOrUpdate — The Real Difference

### `Append Row`
- Calls Google Sheets API `values.append` directly
- Pure write — no read, no lookup, no deduplication
- Fastest operation
- Use for: event logs, audit trails, any case where every run = new row

### `Append or Update Row`
- **Reads the entire sheet first**, scans the **Column to Match On** column in memory
- If match found → calls `values.update` on that row
- If no match → calls `values.append`
- ⚠️ Reads the full sheet on every execution — slow + memory-heavy on large sheets (10k+ rows)
- Only matches and updates the **first** matching row. No "update all matches" mode.
- If the incoming value for **Column to Match On** is blank/null → it tries to match on empty string → unpredictable results

**Rule of thumb**: Use `Append Row` unless you specifically need deduplication. When you do need upsert, use `Append or Update Row` and make sure your match column has clean, non-null values.

---

## Column Mapping Modes

Three modes under **Mapping Column Mode**:

### Map Automatically (default)
- n8n reads sheet headers at **build time**, then matches incoming JSON field names to column names at runtime by exact name match (case-sensitive)
- **Breaks when**:
  - Column names in the sheet change after node was set up → shows "Column names were updated after the node's setup" error
  - You use a dynamic spreadsheet ID (schema is cached for the ID used at setup time, not the runtime ID)
  - Incoming field names differ by case or have extra spaces

**Fix for "Column names were updated" error**: Open the node → toggle Mapping Column Mode to a different option → switch back. Forces a schema refresh.

### Map Each Column Manually
- You explicitly wire each incoming field to a named column
- More verbose to set up but reliable — not affected by column renames triggering errors at runtime
- **Breaks when**: the column no longer exists in the sheet (you'd need to update the node config)

### Nothing
- No columns written. For structural/clearing operations only.

**When to use Manual over Auto**:
- Workflow uses dynamic sheet IDs (different sheets per execution)
- Your incoming JSON fields don't match sheet headers exactly
- You've had "column names updated" errors before

---

## Spreadsheet ID and Sheet ID Formats

Given this URL:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0
```

| Identifier | Value | Where to find it |
|---|---|---|
| **Spreadsheet ID** | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` | Between `/d/` and `/edit` in the URL |
| **Sheet ID (gid)** | `0` | After `#gid=` in the URL. First tab defaults to `0`. Additional tabs get IDs like `834521763`. |
| **Sheet Name** | `Sheet1` | The visible tab label at the bottom |

**In the node**:
- **Spreadsheet** field: paste the full URL or just the spreadsheet ID — both work
- **Sheet** field: use the dropdown to select by name (recommended), or "By URL", or "By ID (gid)"

---

## Range Specification

Under **Options → Data Location on Sheet**:

| Field | Default | What it means |
|---|---|---|
| Header Row | 1 | Row number containing column headers (1-indexed) |
| First Data Row | 2 | Row where actual data starts |
| Range | (auto) | Explicit A1 range. If omitted, n8n auto-detects to last filled cell. |

**Range format rules**:
```
A:Z                        # All rows, columns A to Z (same sheet)
A1:F500                    # Rows 1–500, columns A–F
Sheet1!A:Z                 # Cross-sheet reference (if the field supports it)
'My Sheet'!A:Z             # Sheet name with spaces — MUST use single quotes
```

⚠️ **Single quotes are required for sheet names containing spaces or special characters.** Without them: `Unable to parse range: My Sheet!A:Z`

---

## Upsert Key Configuration (Append or Update Row)

**Column to Match On**: the column whose value is used for the deduplication lookup.

- Must be a single column — no composite/multi-column key support (feature request exists, unresolved as of early 2026)
- The incoming item must have a field matching this column name (exact match in "Map Automatically" mode)
- The match is an exact string comparison — watch for type mismatches:
  - Sheet contains `"123"` (string) but incoming is `123` (number) → no match → always appends
  - Leading/trailing whitespace → no match

**Workaround for multi-column keys**: Pre-combine your key fields into a single column in the sheet using a formula (e.g., `=A2&"-"&B2`) and match on that combined column.

---

## Empty Read Results — Silent Stop Behavior

When `Get Row(s)` matches zero rows:
- n8n outputs **no items** — the downstream node simply does not execute
- This is **not an error** — there's no error message, no empty item, just silence
- The workflow branch halts without notification

**How to handle empty results**:
1. Enable **"Always Output Data"** in node Settings → outputs a single empty item if the node would otherwise return nothing, so downstream nodes still run
2. Use a Merge node with a fallback branch
3. Aggregate before the IF → check `count = 0` → route accordingly

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `Unable to parse range: My Sheet!A:Z` | Sheet name has spaces, not quoted | Wrap in single quotes: `'My Sheet'!A:Z` |
| `Unable to parse range: Sheet1!W` | Incomplete column range | Use `Sheet1!W:W` for full column |
| `The resource you are requesting could not be found (404)` | Wrong spreadsheet ID, wrong gid, or service account lacks access | Verify ID from URL; share sheet with service account email |
| `Column names were updated after the node's setup` | Sheet headers changed after node was configured | Toggle Mapping Column Mode to refresh schema |
| `Cannot read properties of undefined` | Node version bug in typeVersion 4.6 or 4.7 | See Version Bugs section below |
| `appendOrUpdate` always appends, never updates | Match value doesn't exactly match sheet content | Check for case mismatch, whitespace, number-vs-string type mismatch |
| Updates going to wrong rows | Using `Update Row` with incorrect row index | `Update Row` uses row number (sheet index), not column value — get the row number from a prior `Get Row(s)` which returns `row_number` |
| Cell with value `0` returns `null` | Known bug in some node versions | Validate numeric zero handling; workaround: use `=0` formula in sheet |

---

## Known Version Bugs

| Version | n8n version | Bug | Workaround |
|---|---|---|---|
| typeVersion 4.6 | ~v1.93 | `Cannot read properties of undefined` on Update/AppendOrUpdate | Downgrade typeVersion to `4.4` in workflow JSON |
| typeVersion 4.7 | ~v1.108 | Same regression reintroduced | Same workaround; check GitHub #18992 for patch status |

**How to downgrade typeVersion**: In the workflow JSON (via `n8n_get_workflow` → edit → `n8n_update_full_workflow`), find the Google Sheets node and change `"typeVersion": 4.7` to `"typeVersion": 4` or `"typeVersion": 3`.

---

## Performance Notes

- `Append or Update Row` reads the **entire sheet** on every execution (GitHub issue #11234, open as of late 2024)
- On sheets with 10,000+ rows this causes memory overhead and slow execution
- For high-frequency upserts on large sheets: consider batching, or using a database (Postgres) as the source of truth and writing to Sheets periodically

---

## Quick Patterns

### Pattern 1: Log all executions (no dedup)
```
Operation: Append Row
Mapping: Map Automatically
```

### Pattern 2: Upsert by unique ID
```
Operation: Append or Update Row
Column to Match On: url  (or id, or slug — must be unique)
Mapping: Map Automatically
Watch for: null values in the match column
```

### Pattern 3: Sync workflow — new rows and updated rows separately
```
1. Get Row(s) — read existing sheet
2. Merge — combine with incoming data
3. IF — check if row_number exists (update) vs not (append)
4a. Update Row — for existing rows (use row_number from step 1)
4b. Append Row — for new rows
```

### Pattern 4: Handle empty read gracefully
```
1. Get Row(s)
   Settings → Always Output Data: ON
2. IF — check if output is empty (field isEmpty)
3a. True path: handle no data
3b. False path: process rows
```

---

## Cross-References

- Configuration patterns → `n8n-node-configuration` SKILL.md
- Handling 0-item outputs with IF nodes → `n8n-workflow-patterns`
- Google Sheets credentials setup → n8n docs (OAuth2 or Service Account)
