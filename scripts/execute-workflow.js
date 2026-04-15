#!/usr/bin/env node
/**
 * Execute n8n workflow directly via API (not via webhook)
 * This allows running workflows without needing to activate webhook listeners
 */

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

async function executeWorkflow(workflowId, inputData) {
  console.log(`\nExecuting workflow: ${workflowId}`);
  console.log(`Input data: ${inputData ? 'Provided' : 'Using pinned data'}\n`);

  const payload = {};
  if (inputData) {
    payload.data = inputData;
  }

  const result = await apiRequest(`/workflows/${workflowId}/run`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return result;
}

async function pollExecution(executionId, maxAttempts = 60, interval = 2000) {
  console.log(`Polling execution ${executionId}...`);

  for (let i = 0; i < maxAttempts; i++) {
    const execution = await apiRequest(`/executions/${executionId}`);

    if (execution.finished) {
      console.log(`Execution completed!\n`);
      return execution;
    }

    if (execution.stoppedAt) {
      console.log(`Execution stopped at ${execution.stoppedAt}\n`);
      return execution;
    }

    process.stdout.write(`Still running... (${i + 1}/${maxAttempts})\r`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Execution timed out');
}

function formatExecutionResults(execution) {
  console.log('===================================================================');
  console.log('EXECUTION RESULTS');
  console.log('===================================================================\n');

  console.log(`Status: ${execution.status || 'unknown'}`);
  console.log(`Mode: ${execution.mode || 'unknown'}`);
  console.log(`Started: ${execution.startedAt || 'N/A'}`);
  console.log(`Finished: ${execution.finishedAt || execution.stoppedAt || 'N/A'}`);

  if (execution.data?.resultData?.error) {
    console.log(`\nError: ${execution.data.resultData.error.message}`);
    return;
  }

  const runData = execution.data?.resultData?.runData;
  if (!runData) {
    console.log('\nNo execution data available');
    return;
  }

  console.log('\nNode Results:\n');

  for (const [nodeName, nodeRuns] of Object.entries(runData)) {
    if (!nodeRuns || nodeRuns.length === 0) continue;

    const lastRun = nodeRuns[nodeRuns.length - 1];
    const data = lastRun?.data?.main?.[0] || [];

    console.log(`  ${nodeName}`);
    console.log(`    Items: ${data.length}`);

    if (data.length > 0) {
      const firstItem = data[0].json;
      const keys = Object.keys(firstItem);
      console.log(`    Fields: ${keys.slice(0, 8).join(', ')}${keys.length > 8 ? '...' : ''}`);
    }
  }

  console.log('\n===================================================================\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node scripts/execute-workflow.js <workflowId|workflowFile> [--input <file|json>] [--wait]

Examples:
  node scripts/execute-workflow.js abc123
  node scripts/execute-workflow.js workflows/my_workflow_abc123.json
  node scripts/execute-workflow.js abc123 --wait
  node scripts/execute-workflow.js abc123 --input '{"key": "value"}' --wait
    `);
    process.exit(1);
  }

  let target = args[0];
  let inputData = null;
  let wait = args.includes('--wait');

  const resolvedTarget = path.resolve(target);
  let workflowId = target;

  if (fs.existsSync(resolvedTarget)) {
    const content = fs.readFileSync(resolvedTarget, 'utf8');
    const data = parseJson(content, `file ${target}`);
    if (!data.id) {
      fail('Workflow file does not include an id. Push the workflow first.');
    }
    workflowId = String(data.id);
  }

  const inputIndex = args.indexOf('--input');
  if (inputIndex !== -1 && args[inputIndex + 1]) {
    const inputArg = args[inputIndex + 1];
    const inputPath = path.resolve(inputArg);

    if (fs.existsSync(inputPath)) {
      const content = fs.readFileSync(inputPath, 'utf8');
      inputData = parseJson(content, `input file ${inputArg}`);
    } else {
      inputData = parseJson(inputArg, 'input JSON');
    }
  }

  const result = await executeWorkflow(workflowId, inputData);

  if (wait && result.data?.executionId) {
    const execution = await pollExecution(result.data.executionId);
    fs.writeFileSync('execution-result.json', JSON.stringify(execution, null, 2));
    formatExecutionResults(execution);
    console.log('Full execution data saved to: execution-result.json');
  } else {
    console.log('Execution started successfully!');
    console.log(`Execution ID: ${result.data?.executionId || 'N/A'}`);
    console.log('\nRun with --wait to poll for results automatically.');
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(`\nExecution failed: ${err.message}`);
  process.exit(1);
});
