const fs = require('fs');
const path = require('path');

/**
 * Validates n8n workflow JSON files
 * Usage: node validate-workflow.js <file-path>
 *        node validate-workflow.js --all
 */

function validateWorkflow(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\nValidating: ${fileName}`);

    try {
        if (!fs.existsSync(filePath)) {
            console.error(`FAIL: File not found: ${filePath}`);
            return false;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        let workflow;

        try {
            workflow = JSON.parse(content);
        } catch (parseError) {
            console.error(`FAIL: Invalid JSON: ${parseError.message}`);
            return false;
        }

        const errors = [];
        const warnings = [];

        if (!workflow.name || typeof workflow.name !== 'string') {
            errors.push('Missing or invalid "name" field');
        }

        if (!Array.isArray(workflow.nodes)) {
            errors.push('Missing or invalid "nodes" array');
        } else {
            workflow.nodes.forEach((node, index) => {
                if (!node.id) errors.push(`Node ${index}: missing "id"`);
                if (!node.name) errors.push(`Node ${index}: missing "name"`);
                if (!node.type) errors.push(`Node ${index}: missing "type"`);
                if (!node.position || !Array.isArray(node.position)) {
                    errors.push(`Node ${index}: missing or invalid "position"`);
                }
            });
        }

        if (!workflow.connections || typeof workflow.connections !== 'object') {
            warnings.push('Missing or invalid "connections" object - workflow may not be connected');
        }

        if (!workflow.settings || typeof workflow.settings !== 'object') {
            warnings.push('Missing "settings" object');
        }

        // Check for sensitive data
        const jsonString = JSON.stringify(workflow);
        if (jsonString.includes('api_key') || jsonString.includes('apiKey') || jsonString.includes('password')) {
            warnings.push('Workflow may contain sensitive data (API keys/passwords) - review before sharing');
        }

        if (errors.length > 0) {
            console.error('VALIDATION FAILED:');
            errors.forEach(err => console.error(`   - ${err}`));
        }

        if (warnings.length > 0) {
            console.warn('Warnings:');
            warnings.forEach(warn => console.warn(`   - ${warn}`));
        }

        if (errors.length === 0) {
            console.log(`PASS: Valid workflow with ${workflow.nodes?.length || 0} nodes`);
            return true;
        }

        return false;

    } catch (error) {
        console.error(`FAIL: Validation error: ${error.message}`);
        return false;
    }
}

function validateAllWorkflows() {
    const workflowsDir = path.join(__dirname, 'workflows');

    if (!fs.existsSync(workflowsDir)) {
        console.error('Workflows directory not found');
        process.exit(1);
    }

    const files = fs.readdirSync(workflowsDir)
        .filter(f => f.endsWith('.json'));

    console.log(`\nValidating ${files.length} workflows...\n`);

    let passCount = 0;
    let failCount = 0;

    files.forEach(file => {
        const filePath = path.join(workflowsDir, file);
        const isValid = validateWorkflow(filePath);
        if (isValid) passCount++;
        else failCount++;
    });

    console.log(`\nSummary: ${passCount} passed, ${failCount} failed\n`);

    if (failCount > 0) {
        process.exit(1);
    }
}

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage:');
    console.log('  node validate-workflow.js <file-path>  - Validate single workflow');
    console.log('  node validate-workflow.js --all        - Validate all workflows');
    process.exit(1);
}

if (args[0] === '--all') {
    validateAllWorkflows();
} else {
    const filePath = args[0];
    const isValid = validateWorkflow(filePath);
    process.exit(isValid ? 0 : 1);
}
