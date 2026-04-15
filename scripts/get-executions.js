#!/usr/bin/env node
require('dotenv').config();

const API_KEY = process.env.N8N_API_KEY;
const BASE_URL = (process.env.N8N_URL || '').replace(/\/$/, '');
const API_BASE = BASE_URL ? `${BASE_URL}/api/v1` : '';

async function apiRequest(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error [${response.status}]: ${text}`);
  }

  return response.json();
}

function formatResults(execution) {
  console.log('\n===================================================================');
  console.log('EXECUTION RESULTS');
  console.log('===================================================================\n');

  console.log(`Execution ID: ${execution.id}`);
  console.log(`Status: ${execution.status || execution.mode}`);
  console.log(`Started: ${execution.startedAt}`);
  console.log(`Finished: ${execution.finishedAt || execution.stoppedAt || 'Still running...'}`);

  const runData = execution.data?.resultData?.runData;
  if (!runData) {
    console.log('\nNo execution data available yet');
    return;
  }

  console.log('\nNode Execution Summary:\n');

  for (const [nodeName, nodeRuns] of Object.entries(runData)) {
    if (!nodeRuns || nodeRuns.length === 0) continue;

    const lastRun = nodeRuns[nodeRuns.length - 1];
    const data = lastRun?.data?.main?.[0] || [];

    console.log(`  ${nodeName.padEnd(30)} -> ${data.length} item(s)`);
  }

  if (execution.data?.resultData?.error) {
    console.log(`\nError: ${execution.data.resultData.error.message}`);
  }

  console.log('\n===================================================================\n');
}

async function main() {
  const workflowId = process.argv[2];
  const limit = process.argv[3] || '5';

  if (!workflowId) {
    console.log('Usage: node scripts/get-executions.js <workflowId> [limit]');
    console.log('\nExample: node scripts/get-executions.js abc123 5');
    process.exit(1);
  }

  console.log(`\nFetching last ${limit} execution(s) for workflow: ${workflowId}\n`);

  const executions = await apiRequest(`/executions?workflowId=${workflowId}&limit=${limit}`);

  if (!executions.data || executions.data.length === 0) {
    console.log('No executions found for this workflow');
    return;
  }

  console.log(`Found ${executions.data.length} execution(s)\n`);

  for (const execution of executions.data) {
    formatResults(execution);
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
