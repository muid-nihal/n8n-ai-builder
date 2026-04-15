require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.N8N_API_KEY;
const BASE_URL = process.env.N8N_URL.replace(/\/$/, "") + '/api/v1';

async function apiRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'X-N8N-API-KEY': API_KEY,
            'accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error [${response.status}]: ${text}`);
    }

    return response.json();
}

async function pullWorkflows() {
    console.log('Pulling workflows from n8n...');
    const workflowsDir = path.join(__dirname, 'workflows');
    if (!fs.existsSync(workflowsDir)) fs.mkdirSync(workflowsDir);

    const data = await apiRequest('/workflows');
    const archivedIds = new Set(
        data.data.filter(wf => wf.isArchived).map(wf => String(wf.id))
    );
    const activeWorkflows = data.data.filter(wf => !wf.isArchived);

    // Remove locally saved archived workflows to keep folder clean
    const localFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json'));
    for (const file of localFiles) {
        const match = file.match(/_([^_]+)\.json$/);
        if (!match) continue;
        const id = match[1];
        if (archivedIds.has(id)) {
            fs.unlinkSync(path.join(workflowsDir, file));
            console.log(`Removed archived: ${file}`);
        }
    }

    for (const wf of activeWorkflows) {
        // Fetch full workflow details including nodes
        const fullWf = await apiRequest(`/workflows/${wf.id}`);
        const filename = `${fullWf.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${wf.id}.json`;
        fs.writeFileSync(
            path.join(workflowsDir, filename),
            JSON.stringify(fullWf, null, 2)
        );
        console.log(`Saved: ${filename}`);
    }

    console.log(`\nDone. ${activeWorkflows.length} workflows pulled.`);
}

async function pushWorkflow(filePath) {
    console.log(`Pushing workflow from ${filePath}...`);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const id = content.id;

    // Strip read-only fields that the API rejects
    const readOnlyFields = [
        'updatedAt', 'createdAt', 'active', 'isArchived', 'description',
        'versionId', 'activeVersionId', 'versionCounter', 'triggerCount',
        'shared', 'tags', 'activeVersion', 'staticData', 'meta', 'pinData'
    ];

    const cleanContent = { ...content };
    readOnlyFields.forEach(field => delete cleanContent[field]);

    // Strip settings sub-properties the API rejects
    if (cleanContent.settings) {
        const allowedSettings = ['executionOrder', 'errorWorkflow', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'saveManualExecutions', 'executionTimeout'];
        for (const key of Object.keys(cleanContent.settings)) {
            if (!allowedSettings.includes(key)) {
                delete cleanContent.settings[key];
            }
        }
    }

    // Always remove id from body (it goes in URL for updates)
    delete cleanContent.id;

    if (!id) {
        // Create new
        const result = await apiRequest('/workflows', {
            method: 'POST',
            body: JSON.stringify(cleanContent)
        });
        console.log(`Created workflow: ${result.name} (ID: ${result.id})`);

        // Write the assigned ID back into the file so future pushes do a PUT (update)
        content.id = result.id;
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));

        // Rename file to include the workflow ID (convention: name_ID.json)
        const dir = path.dirname(filePath);
        const base = path.basename(filePath, '.json');
        // Remove any existing trailing ID segment before appending the new one
        const cleanBase = base.replace(/_[a-zA-Z0-9]{10,}$/, '');
        const newFilename = `${cleanBase}_${result.id}.json`;
        const newPath = path.join(dir, newFilename);
        if (newPath !== filePath) {
            fs.renameSync(filePath, newPath);
            console.log(`Renamed to: ${newFilename}`);
        }
    } else {
        // Check if workflow is currently active on the server
        let wasActive = false;
        try {
            const current = await apiRequest(`/workflows/${id}`);
            wasActive = current.active === true;
        } catch (e) {
            // Ignore - workflow may not exist yet
        }

        // Newer n8n versions block PUT on active workflows. Deactivate first.
        if (wasActive) {
            await apiRequest(`/workflows/${id}/deactivate`, { method: 'POST' });
            console.log(`Deactivated workflow before update`);
        }

        // Update existing
        const result = await apiRequest(`/workflows/${id}`, {
            method: 'PUT',
            body: JSON.stringify(cleanContent)
        });
        console.log(`Updated workflow: ${result.name} (ID: ${result.id})`);

        if (wasActive) {
            console.log(`Workflow was active. Re-activate it in the n8n UI if needed.`);
        }
    }
}

const command = process.argv[2];
const arg = process.argv[3];

if (command === 'pull') {
    pullWorkflows().catch(console.error);
} else if (command === 'push' && arg) {
    pushWorkflow(arg).catch(console.error);
} else {
    console.log('Usage:');
    console.log('  node n8n-manager.js pull          - Download all workflows to ./workflows');
    console.log('  node n8n-manager.js push [file]   - Upload/Update a workflow file to n8n');
}
