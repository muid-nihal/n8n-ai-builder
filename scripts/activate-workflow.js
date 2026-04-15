#!/usr/bin/env node
require('dotenv').config();

const API_KEY = process.env.N8N_API_KEY;
const BASE_URL = (process.env.N8N_URL || '').replace(/\/$/, '');
const API_BASE = BASE_URL ? `${BASE_URL}/api/v1` : '';

async function apiRequest(endpoint, options = {}) {
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

async function activateWorkflow(workflowId, activate = true) {
  console.log(`${activate ? 'Activating' : 'Deactivating'} workflow: ${workflowId}`);

  const result = await apiRequest(`/workflows/${workflowId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: activate }),
  });

  console.log(`Status: ${result.active ? 'Active' : 'Inactive'}`);
  return result;
}

const workflowId = process.argv[2];
const action = process.argv[3];

if (!workflowId) {
  console.log('Usage: node scripts/activate-workflow.js <workflowId> [on|off]');
  process.exit(1);
}

const activate = action !== 'off';

activateWorkflow(workflowId, activate)
  .then(() => console.log('Done!'))
  .catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
