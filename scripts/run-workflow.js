require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.N8N_API_KEY;
const BASE_URL = (process.env.N8N_URL || '').replace(/\/$/, '');
const API_BASE = BASE_URL ? `${BASE_URL}/api/v1` : '';

function fail(message) {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (err) {
    fail(`Invalid JSON for ${label}. ${err.message}`);
  }
}

function parseArgs(argv) {
  const options = {
    target: null,
    input: null,
    method: null,
    mode: 'test',
    trigger: null,
    nodeName: null,
    timeout: 120000,
    raw: false,
  };

  const args = [...argv];
  if (args.length === 0) return options;

  options.target = args.shift();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--input') {
      const value = args[++i];
      if (!value) fail('Missing value for --input');
      options.input = value;
      continue;
    }

    if (arg === '--method') {
      const value = args[++i];
      if (!value) fail('Missing value for --method');
      options.method = value.toUpperCase();
      continue;
    }

    if (arg === '--mode') {
      const value = args[++i];
      if (!value) fail('Missing value for --mode');
      options.mode = value.toLowerCase();
      continue;
    }

    if (arg === '--trigger') {
      const value = args[++i];
      if (!value) fail('Missing value for --trigger');
      options.trigger = value.toLowerCase();
      continue;
    }

    if (arg === '--node') {
      const value = args[++i];
      if (!value) fail('Missing value for --node');
      options.nodeName = value;
      continue;
    }

    if (arg === '--timeout') {
      const value = args[++i];
      if (!value) fail('Missing value for --timeout');
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) fail('Timeout must be a positive number');
      options.timeout = parsed;
      continue;
    }

    if (arg === '--raw') {
      options.raw = true;
      continue;
    }

    fail(`Unknown option: ${arg}`);
  }

  return options;
}

function usage() {
  console.log(`\nUsage: npm run run -- <workflowId|workflowFile> [options]\n\nOptions:\n  --input <path|json>   JSON file path or inline JSON string\n  --method <HTTP>        Override HTTP method (for webhook)\n  --mode <test|prod>     Webhook mode (default: test)\n  --trigger <webhook>    Force trigger type (default: auto)\n  --node <nodeName>      Select trigger node by name if multiple\n  --timeout <ms>         Request timeout (default: 120000)\n  --raw                  Print raw response (no formatting)\n\nExamples:\n  npm run run -- 123 --input data.json\n  npm run run -- workflows/example_123.json --input '{"foo": "bar"}'\n  npm run run -- 123 --mode prod --method POST\n`);
}

async function apiRequest(endpoint, options = {}) {
  if (!API_KEY) fail('Missing N8N_API_KEY in .env');
  if (!API_BASE) fail('Missing N8N_URL in .env');

  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error [${response.status}]: ${text}`);
  }

  return response.json();
}

function loadJsonInput(value) {
  if (!value) return null;
  const resolved = path.resolve(value);
  if (fs.existsSync(resolved)) {
    const content = fs.readFileSync(resolved, 'utf8');
    return parseJson(content, `file ${value}`);
  }
  return parseJson(value, 'inline JSON');
}

function selectTrigger(nodes, options) {
  const triggerTypes = {
    webhook: ['n8n-nodes-base.webhook'],
    form: ['n8n-nodes-base.n8nFormTrigger', 'n8n-nodes-base.formTrigger'],
    chat: ['n8n-nodes-base.chatTrigger'],
  };

  const allTriggers = nodes.filter((node) => {
    return Object.values(triggerTypes).some((types) => types.includes(node.type));
  });

  if (!allTriggers.length) return null;

  if (options.nodeName) {
    const match = allTriggers.find((node) => node.name === options.nodeName);
    if (!match) fail(`No trigger node named "${options.nodeName}" found.`);
    return match;
  }

  if (options.trigger) {
    const allowed = triggerTypes[options.trigger];
    if (!allowed) fail(`Unsupported trigger type: ${options.trigger}`);
    const match = allTriggers.find((node) => allowed.includes(node.type));
    if (!match) fail(`No ${options.trigger} trigger node found in workflow.`);
    return match;
  }

  if (allTriggers.length > 1) {
    console.log('Multiple trigger nodes found. Using the first one.');
    console.log('Use --node "Node Name" to pick a specific trigger.');
  }

  return allTriggers[0];
}

function resolveWebhookUrl(node, options) {
  const pathValue = (node.parameters && node.parameters.path) || '';
  const trimmedPath = String(pathValue).replace(/^\//, '');
  const webhookId = node.webhookId || node.parameters?.webhookId || null;
  const baseUrl = BASE_URL.replace(/\/$/, '');

  if (options.mode === 'prod') {
    if (!trimmedPath) fail('Webhook node has no path configured.');
    return `${baseUrl}/webhook/${trimmedPath}`;
  }

  if (webhookId) {
    return `${baseUrl}/webhook-test/${webhookId}`;
  }

  if (!trimmedPath) fail('Webhook node has no path configured.');
  console.log('Warning: webhookId missing; falling back to /webhook-test/<path>.');
  return `${baseUrl}/webhook-test/${trimmedPath}`;
}

async function runWebhook(node, options, inputData) {
  const method = (options.method || node.parameters?.httpMethod || 'POST').toUpperCase();
  const url = resolveWebhookUrl(node, options);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout);

  let requestUrl = url;
  let body = undefined;
  const headers = {};

  if (method === 'GET' || method === 'DELETE') {
    if (inputData && typeof inputData === 'object') {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(inputData)) {
        if (value === undefined) continue;
        if (typeof value === 'object') {
          params.append(key, JSON.stringify(value));
        } else {
          params.append(key, String(value));
        }
      }
      const query = params.toString();
      if (query) requestUrl = `${url}?${query}`;
    }
  } else {
    body = inputData ? JSON.stringify(inputData) : '{}';
    headers['Content-Type'] = 'application/json';
  }

  console.log(`\nTrigger: Webhook (${method})`);
  console.log(`URL: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (options.raw) {
      console.log(rawText || '<empty response>');
      return;
    }

    if (contentType.includes('application/json')) {
      const parsed = rawText ? parseJson(rawText, 'response body') : null;
      console.log(JSON.stringify(parsed, null, 2));
      return;
    }

    console.log(rawText || '<empty response>');
  } catch (err) {
    if (err.name === 'AbortError') {
      fail(`Request timed out after ${options.timeout}ms.`);
    }
    throw err;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.target) {
    usage();
    process.exit(1);
  }

  if (!API_KEY || !BASE_URL) {
    fail('Missing N8N_URL or N8N_API_KEY in .env');
  }

  let workflowId = options.target;
  const resolvedTarget = path.resolve(options.target);
  if (fs.existsSync(resolvedTarget)) {
    const content = fs.readFileSync(resolvedTarget, 'utf8');
    const data = parseJson(content, `file ${options.target}`);
    if (!data.id) {
      fail('Workflow file does not include an id. Push the workflow first.');
    }
    workflowId = String(data.id);
  }

  const inputData = loadJsonInput(options.input);

  const workflow = await apiRequest(`/workflows/${workflowId}`);
  console.log(`\nWorkflow: ${workflow.name} (ID: ${workflow.id})`);
  console.log(`Active: ${workflow.active ? 'Yes' : 'No'}`);

  const triggerNode = selectTrigger(workflow.nodes || [], options);
  if (!triggerNode) {
    fail('No supported trigger nodes found. This script currently supports Webhook triggers only.');
  }

  if (triggerNode.type !== 'n8n-nodes-base.webhook') {
    fail(`Trigger type "${triggerNode.type}" not supported yet. Use a Webhook trigger for terminal runs.`);
  }

  await runWebhook(triggerNode, options, inputData || {});
}

main().catch((err) => {
  console.error(`\nRun failed: ${err.message}`);
  process.exit(1);
});
