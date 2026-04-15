#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');

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

async function main() {
  const executionId = process.argv[2];

  if (!executionId) {
    console.log('Usage: node scripts/get-execution-detail.js <executionId>');
    process.exit(1);
  }

  console.log(`\nFetching execution details for: ${executionId}\n`);

  const execution = await apiRequest(`/executions/${executionId}`);

  // Save raw response
  fs.writeFileSync('execution-detail.json', JSON.stringify(execution, null, 2));
  console.log('Saved raw response to: execution-detail.json\n');

  console.log('===================================================================');
  console.log('EXECUTION DETAILS');
  console.log('===================================================================\n');

  console.log(`ID: ${execution.id}`);
  console.log(`Status: ${execution.status}`);
  console.log(`Mode: ${execution.mode}`);
  console.log(`Started: ${execution.startedAt}`);
  console.log(`Finished: ${execution.finishedAt}`);
  console.log(`Workflow ID: ${execution.workflowId}`);

  if (execution.data) {
    console.log(`\nHas data: Yes`);
    console.log(`Result data available: ${execution.data.resultData ? 'Yes' : 'No'}`);

    if (execution.data.resultData?.runData) {
      const nodeNames = Object.keys(execution.data.resultData.runData);
      console.log(`\nNodes executed: ${nodeNames.length}`);
      console.log(`Node list: ${nodeNames.join(', ')}`);
    }

    if (execution.data.resultData?.error) {
      console.log(`\nError: ${execution.data.resultData.error.message}`);
    }
  } else {
    console.log(`\nHas data: No`);
  }

  console.log('\n===================================================================\n');
  console.log('Check execution-detail.json for full details');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
