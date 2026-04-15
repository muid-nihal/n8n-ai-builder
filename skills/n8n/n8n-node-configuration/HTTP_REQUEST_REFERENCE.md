# n8n HTTP Request Node — Complete Reference

Last verified: March 2026 against n8n docs (cloud + self-hosted current versions).

---

## 1. Authentication

### Credential Strategy

| Mode | When to Use |
|------|-------------|
| **Predefined Credential Type** | When n8n has a built-in node for the service (Asana, GitHub, Slack). Reuses saved OAuth creds without re-entering secrets. |
| **Generic Credential Type** | Everything else — custom APIs, internal services, any non-standard auth. |

### Generic Credential Types

| Type | What It Does | Key Fields |
|------|-------------|-----------|
| **None** | No auth header | — |
| **Basic Auth** | `Authorization: Basic base64(user:pass)` | Username, Password |
| **Bearer Auth** (Header variant) | `Authorization: Bearer <token>` | Token |
| **Header Auth** | One arbitrary header | Name (e.g., `X-API-Key`), Value |
| **Query Auth** | Appends one key/value to query string | Name, Value |
| **Custom Auth** | JSON with `headers`, `qs`, `body` keys | JSON blob |
| **Digest Auth** | HTTP Digest challenge-response | Username, Password |
| **OAuth1 API** | HMAC-SHA1 signed requests | Consumer Key/Secret, Access Token/Secret |
| **OAuth2 API** | Full OAuth2 with auto-refresh | See below |

### OAuth2 Generic Credential Fields

| Field | Notes |
|-------|-------|
| Grant Type | `Authorization Code`, `Client Credentials`, `Password` |
| Authorization URL | Authorization Code flow only |
| Access Token URL | Required for all flows |
| Client ID / Secret | Required for all flows |
| Scope | Space-separated |
| Client Authentication | `Send in Header` (default) or `Send in Request Body` |

n8n handles token refresh automatically. If refresh fails, re-authorize from the Credentials UI.

### Custom Auth JSON Example

```json
{
  "headers": {
    "X-API-Key": "{{$credentials.apiKey}}",
    "X-Tenant-ID": "acme-corp"
  },
  "qs": {
    "format": "json"
  }
}
```

Use Custom Auth when you need more than one query param or a mix of header + query auth.

---

## 2. Request Configuration

### URL Construction (Dynamic)

```
https://api.example.com/users/{{ $json.userId }}/orders
```

Use `$node["NodeName"].json.field` for cross-branch data.

### Query Parameters

Enable via **Send Query Parameters** toggle:
- **Using Fields Below** — name/value pairs (expressions supported)
- **Using JSON** — paste a JSON object

**Gotcha**: If the API needs `ids[]=1&ids[]=2`, set the **Array Format** option: `brackets`, `indices`, `repeat`, or `comma`. Sending a plain array without this is a very common failure.

### Body / Request Body Types

| Body Content Type | When to Use | Notes |
|-------------------|-------------|-------|
| **JSON** | REST APIs expecting `application/json` | Use "Using JSON" mode for raw JSON with expressions; "Using Fields Below" for key/value pairs |
| **Form Urlencoded** | Legacy form submissions, some OAuth token endpoints | Name/value pairs only, no file upload |
| **Form Data** | File uploads, multipart APIs | Each param can be `Form Data` (text) or `n8n Binary File` (file) |
| **Binary** | Sending a raw file as the entire body | Set Input Data Field Name to the binary property name from upstream (e.g., `data`) |
| **Raw / Custom** | XML, YAML, CSV, plain text | Specify Content-Type manually |

**JSON body with expression example:**

```json
{
  "userId": "{{ $json.id }}",
  "message": "{{ $json.body }}",
  "timestamp": "{{ $now.toISO() }}"
}
```

---

## 3. Pagination

Enable via **Add Option > Pagination**.

### Pagination Modes

| Mode | How It Works |
|------|-------------|
| **Update a Parameter in Each Request** | Increments/updates a query param, header, or body param per page |
| **Response Contains Next URL** | Reads next URL from response body or header |

### Pagination Built-in Variables (only available in pagination expression fields)

| Variable | Description |
|----------|-------------|
| `$pageCount` | Pages fetched so far, starting at **0** (add +1 for 1-based APIs) |
| `$response.body` | Full body of the most recent response |
| `$response.headers` | Headers of the most recent response |
| `$response.statusCode` | Status code of the most recent response |

### Pagination Complete When

| Option | Expression Example |
|--------|-------------------|
| Response Is Empty | Auto-stops when response array is empty |
| Receive Specific Status Code(s) | Stops on a defined status |
| Other (Complete Expression) | `{{ !$response.body.has_more }}` or `{{ $response.body.cursor === null }}` |

### Pagination Examples

**Offset-based (page number):**
```
Mode:              Update a Parameter in Each Request
Type:              Query Parameter
Parameter Name:    page
Value:             {{ $pageCount + 1 }}
Complete When:     Response Is Empty
```

**Cursor-based:**
```
Parameter Name:    cursor
Value:             {{ $response.body.next_cursor ?? null }}
Complete When:     Other
Expression:        {{ $response.body.next_cursor === null || $response.body.next_cursor === undefined }}
```

**Gotcha for nested JSON pagination** (e.g., GraphQL variables): n8n cannot properly update nested body params like `variables.cursor`. Set the parameter name to the parent key (`variables`) and replace the entire object per page:

```
Parameter Name:  variables
Value:           {{ { "projectId": $json.projectId, "cursor": $response.body?.data?.pageInfo?.endCursor || null } }}
```

**Next URL from response header** (e.g., GitHub Link header):
```
Mode:       Response Contains Next URL
Next URL:   {{ $response.headers["link"].match(/<([^>]+)>;\s*rel="next"/)?.[1] }}
```

**Always set Max Requests** as a safety ceiling to prevent runaway loops.

---

## 4. Response Handling

### Response Format Options

| Format | What Happens |
|--------|-------------|
| **Autodetect** | n8n inspects Content-Type. JSON parsed, binary types become binary data, else string. Default. |
| **JSON** | Forces JSON parse regardless of Content-Type |
| **Text** | Returns body as raw string under `$json.data` |
| **File** | Returns body as binary data. Access via `$binary.data`. Use for downloads. |

### Including Headers and Status Code

Enable **Include Response Headers and Status** (under Options). Output becomes:

```json
{
  "headers": { "content-type": "application/json", "x-ratelimit-remaining": "99" },
  "statusCode": 200,
  "statusMessage": "OK",
  "body": { ... }
}
```

Access downstream:
```
{{ $json.statusCode }}
{{ $json.headers["x-ratelimit-remaining"] }}
{{ $json.body.someField }}
```

Without this option, `$json` IS the parsed body directly.

---

## 5. Error Handling

### Settings Panel Options

| Setting | Description |
|---------|-------------|
| **Stop Workflow** | Default. Any non-2xx throws and halts execution |
| **Continue** | Passes error item through main output. Response body becomes error string, not JSON. |
| **Continue (Error Output)** | Routes failed items to a second output pin. Best for per-item error routing. |
| **Never Error** | Forces success regardless of status code. Use with Include Response Headers to check `statusCode` manually. |

**Known issue**: "Continue" mode breaks normal JSON body format on errors — error message becomes the body string. For reliable error handling, use **Never Error** + Include Response Headers + IF node on `statusCode`.

**Gotcha**: "Retry on Fail" + any "Continue" error mode conflict — retries are skipped. Use one or the other.

### Recommended Robust Error Pattern

```
Node:           HTTP Request
Settings:       Never Error + Include Response Headers
↓
IF node:        {{ $json.statusCode >= 400 }}
  True branch:  error handling (log, alert, retry)
  False branch: continue with $json.body
```

### Accessing Error Details (Continue Error Output)

```
$json.error.message    — human-readable error
$json.statusCode       — only if Include Response Headers is also enabled
```

---

## 6. Binary Data and File Handling

### Downloading a File

1. Set **Response Format** to `File`
2. Binary data available as `$binary.data` with `.mimeType`, `.fileName`, `.fileSize`
3. Pipe to Write Binary File node, email attachment, or another upload

### Uploading a File (Multipart Form Data)

1. Set **Body Content Type** to `Form Data`
2. Add parameter with **Type: n8n Binary File**
3. Set **Input Data Field Name** to the binary property from upstream (default: `data`)

```
Body Content Type:    Form Data
Parameter:
  Type:               n8n Binary File
  Name:               file             ← field name the API expects
  Input Data Field:   data             ← binary property key in n8n
```

### Sending Raw Binary as Body

1. Set **Body Content Type** to `Binary`
2. Set **Input Data Field Name** to the binary property name
3. Manually add `Content-Type` header matching the file type

**Multiple file upload**: n8n's HTTP node does not natively support multiple files in one multipart request. Workaround: use a Code node to construct the multipart body manually, or loop with individual requests.

---

## 7. Rate Limiting Patterns

### Built-in Batching (Simplest Approach)

**Add Option > Batching:**
```
Items per Batch:    10     (how many input items per group)
Batch Interval:     1000   (ms delay between batches)
```

For simple rate limits (e.g., 60 req/min): `Items per Batch: 1, Batch Interval: 1000`.

### 429 Handling with Retry-After

1. Enable **Never Error** + **Include Response Headers**
2. IF node: `{{ $json.statusCode === 429 }}`
3. On 429 branch: Wait node with `{{ parseInt($json.headers["retry-after"]) * 1000 }}` ms
4. Loop back to HTTP Request

### Loop Over Items + Wait Node Pattern

```
Loop Over Items (batch size: 10)
  → HTTP Request
  → Wait (1s fixed, or read Retry-After header)
  → back to Loop
```

---

## 8. Chaining HTTP Requests

### Sequential Chaining

Output of Request 1 flows into Request 2. Reference with `$json`:

```
Request 1 returns: { "id": "abc123", "token": "xyz" }
Request 2 URL:     https://api.example.com/items/{{ $json.id }}
Request 2 Header:  Authorization: Bearer {{ $json.token }}
```

### Cross-Branch Data Access

When requests are on parallel branches:
```
$node["Get User"].json.id
$node["Get Token"].json.access_token
```

Use a **Merge node** (mode: Combine) before referencing cross-branch data.

### Fan-out then Aggregate

```
HTTP 1 → returns array → Split Out → HTTP 2 (once per item) → Aggregate → one item with array
```

---

## 9. Common Integration Patterns

### GraphQL Request

```
Method:     POST
URL:        https://api.example.com/graphql
Body Type:  JSON
Body:
  {
    "query": "query GetUser($id: ID!) { user(id: $id) { name email } }",
    "variables": { "id": "{{ $json.userId }}" }
  }
Headers:    Content-Type: application/json
```

For GraphQL pagination: use `variables` as the parameter name (parent key), not `variables.cursor`.

### OAuth2 Client Credentials Token Fetch

```
Method:     POST
URL:        https://auth.example.com/oauth/token
Body Type:  Form Urlencoded
Params:
  grant_type:     client_credentials
  client_id:      {{ $credentials.clientId }}
  client_secret:  {{ $credentials.clientSecret }}
  scope:          read:data write:data
```

---

## 10. Common Gotchas Quick Reference

| Gotcha | Fix |
|--------|-----|
| Arrays in query params malformed | Set Array Format option (`brackets`, `indices`, `repeat`, `comma`) |
| Nested JSON body pagination fails | Replace entire parent object per page, not nested key |
| "Continue" + "Retry on Fail" conflict | Use only one — they cancel each other |
| Response body inaccessible on 4xx | Use Never Error + Include Response Headers + IF on statusCode |
| Binary data field name mismatch | Check upstream binary property key in output inspector |
| Pagination runs forever | Set Max Requests or a Complete Expression safety ceiling |
| First page cursor pagination fails | Use optional chaining: `$response.body?.cursor ?? null` |
| Wrong Content-Type for Raw body | Add explicit Content-Type header |
| OAuth2 not refreshing | Ensure credential was set up via n8n's OAuth2 flow, not a static token |
| 401 after 429 retry | Handle 429 and 401 as separate branches |
| Cross-branch expression returns empty | Use `$node["NodeName"].json.field` instead of `$json` |

---

## 11. Performance Tips

| Tip | Setting |
|-----|---------|
| Set Request Timeout | Options > Timeout (ms) — 10000–30000 ms typical |
| Use built-in Batching for simple rate limits | Options > Batching — avoids extra Loop + Wait nodes |
| Cap pagination | Always set Max Requests |
| Prefer Predefined Credentials | Auto-refreshes OAuth tokens |
| Only enable Include Response Headers when needed | Adds nesting complexity; skip if you don't need header values |

---

## 12. Known Issues (as of early 2026)

- **Retry + Continue conflict**: Retries are skipped when any Continue error mode is active. Test in your environment.
- **Multiple file upload**: No native multipart multi-file support — use Code node workaround.
- **OAuth2 with HTTP Request Tool node** (AI agent sub-node): Known issues with generic OAuth2 credentials. Use predefined credentials or Bearer Header Auth instead.
- **GraphQL node vs HTTP Request node**: For simple queries, use the dedicated GraphQL node. Use HTTP Request when you need pagination, custom headers, or file upload mutations.
