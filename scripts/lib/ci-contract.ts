import { parse } from 'yaml';

export type ContractFinding = {
	file: string;
	line: number;
	rule: 'ci-contract';
	detail: string;
};

export type ContractFile = { path: string; content: string };

export type ContractInputs = {
	workflows: ContractFile[];
	runnerConfig: ContractFile;
	runnerScript: ContractFile;
	packageFile: ContractFile;
	dockerfile: ContractFile;
};

const GATE_WORKFLOW = 'verification.yml';
const GATE_SCRIPT = 'npm run verify && npm run build';
const VERIFY_COMMANDS = [
	'npm run check',
	'npm run lint',
	'npm run test',
	'npm run verify:architecture',
	'npm run verify:generated',
	'npm run verify:shell'
] as const;

type Json = Record<string, unknown>;

function lineOf(content: string, needle: string): number {
	const index = content.indexOf(needle);
	if (index < 0) return 1;
	return content.slice(0, index).split('\n').length;
}

function finding(file: string, line: number, detail: string): ContractFinding {
	return { file, line, rule: 'ci-contract', detail };
}

function asObject(value: unknown): Json | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function collectUses(value: unknown, output: string[] = []): string[] {
	if (Array.isArray(value)) {
		for (const entry of value) collectUses(entry, output);
		return output;
	}
	const object = asObject(value);
	if (!object) return output;
	for (const [key, entry] of Object.entries(object)) {
		if (key === 'uses' && typeof entry === 'string') {
			output.push(entry);
		} else {
			collectUses(entry, output);
		}
	}
	return output;
}

function isPinned(uses: string): boolean {
	if (uses.startsWith('./')) return true;
	if (uses.startsWith('docker://')) return /@sha256:[0-9a-f]{64}$/.test(uses);
	return /@[0-9a-f]{40}$/.test(uses);
}

function parseYamlFile(file: ContractFile, findings: ContractFinding[]): Json | null {
	try {
		const parsed = parse(file.content);
		const object = asObject(parsed);
		if (!object) {
			findings.push(finding(file.path, 1, 'The file must contain a YAML mapping.'));
			return null;
		}
		return object;
	} catch {
		findings.push(finding(file.path, 1, 'The file must contain valid YAML.'));
		return null;
	}
}

function checkWorkflow(
	file: ContractFile,
	label: string | null,
	findings: ContractFinding[]
): void {
	const workflow = parseYamlFile(file, findings);
	if (!workflow) return;

	const triggers = asObject(workflow.on);
	if (!triggers) {
		findings.push(finding(file.path, 1, 'The workflow must declare explicit triggers.'));
		return;
	}
	if (!('pull_request' in triggers)) {
		findings.push(
			finding(file.path, lineOf(file.content, 'on:'), 'The workflow must run on pull_request.')
		);
	}
	const push = asObject(triggers.push);
	const branches = push?.branches;
	const pushesMain = Array.isArray(branches)
		? branches.includes('main')
		: branches === 'main';
	if (!pushesMain) {
		findings.push(
			finding(file.path, lineOf(file.content, 'push:'), 'The workflow must run on pushes to main.')
		);
	}

	const jobs = asObject(workflow.jobs);
	const jobNames = jobs ? Object.keys(jobs) : [];
	if (jobNames.length !== 1 || jobNames[0] !== 'gate') {
		findings.push(
			finding(
				file.path,
				lineOf(file.content, 'jobs:'),
				'The workflow must declare exactly one job named gate.'
			)
		);
	}
	const job = jobs ? asObject(jobs.gate) : null;
	if (!job) return;

	if (job.if !== undefined) {
		findings.push(finding(file.path, lineOf(file.content, 'if:'), 'The gate job cannot be conditional.'));
	}
	if (job['continue-on-error'] !== undefined) {
		findings.push(
			finding(
				file.path,
				lineOf(file.content, 'continue-on-error'),
				'The gate job cannot continue on error.'
			)
		);
	}
	if (label && job['runs-on'] !== label) {
		findings.push(
			finding(
				file.path,
				lineOf(file.content, 'runs-on:'),
				`The gate must run on the runner label ${label}.`
			)
		);
	}
	if (typeof job['runs-on'] !== 'string') {
		findings.push(finding(file.path, lineOf(file.content, 'runs-on:'), 'runs-on must be a string.'));
	}

	const steps = Array.isArray(job.steps) ? job.steps.map(asObject) : [];
	const runCommands = steps.flatMap((step) => (typeof step?.run === 'string' ? [step.run] : []));
	if (!runCommands.includes('npm ci --no-audit --no-fund')) {
		findings.push(
			finding(
				file.path,
				lineOf(file.content, 'steps:'),
				'The gate must install the lockfile with npm ci.'
			)
		);
	}
	if (runCommands.filter((command) => command === 'npm run gate').length !== 1) {
		findings.push(
			finding(
				file.path,
				lineOf(file.content, 'run:'),
				'The gate must call npm run gate exactly once, without a wrapper.'
			)
		);
	}
	for (const step of steps) {
		if (step?.if !== undefined) {
			findings.push(
				finding(file.path, lineOf(file.content, 'if:'), 'The gate steps cannot be conditional.')
			);
		}
		if (step?.['continue-on-error'] !== undefined) {
			findings.push(
				finding(
					file.path,
					lineOf(file.content, 'continue-on-error'),
					'The gate steps cannot continue on error.'
				)
			);
		}
	}
	for (const step of steps) {
		if (typeof step?.uses === 'string' && !isPinned(step.uses)) {
			findings.push(
				finding(
					file.path,
					lineOf(file.content, step.uses),
					`Action must be pinned to a full commit SHA: ${step.uses}`
				)
			);
		}
	}
}

function checkPackage(file: ContractFile, findings: ContractFinding[]): number | null {
	let pkg: Json;
	try {
		pkg = JSON.parse(file.content) as Json;
	} catch {
		findings.push(finding(file.path, 1, 'package.json must contain valid JSON.'));
		return null;
	}
	const scripts = asObject(pkg.scripts);
	if (scripts?.gate !== GATE_SCRIPT) {
		findings.push(
			finding(file.path, lineOf(file.content, '"gate"'), `The gate script must be: ${GATE_SCRIPT}`)
		);
	}
	const verify = typeof scripts?.verify === 'string' ? scripts.verify : '';
	for (const command of VERIFY_COMMANDS) {
		if (!verify.includes(command)) {
			findings.push(
				finding(
					file.path,
					lineOf(file.content, '"verify"'),
					`The verify script must include: ${command}`
				)
			);
		}
	}

	const engines = asObject(pkg.engines);
	const node = typeof engines?.node === 'string' ? engines.node.match(/\d+/)?.[0] : undefined;
	if (!node) {
		findings.push(finding(file.path, lineOf(file.content, '"engines"'), 'engines.node must declare a major.'));
		return null;
	}
	return Number(node);
}

function checkDockerfile(file: ContractFile, nodeMajor: number | null, findings: ContractFinding[]): void {
	const majors = [...file.content.matchAll(/^\s*FROM\s+node:(\d+)/gim)].map((match) =>
		Number(match[1])
	);
	if (majors.length === 0) {
		findings.push(finding(file.path, 1, 'The image must build from a Node base image.'));
		return;
	}
	if (nodeMajor === null) return;
	for (const major of majors) {
		if (major !== nodeMajor) {
			findings.push(
				finding(
					file.path,
					lineOf(file.content, `node:${major}`),
					`The Dockerfile Node major (${major}) must match engines.node (${nodeMajor}).`
				)
			);
		}
	}
}

function checkRunner(
	configFile: ContractFile,
	scriptFile: ContractFile,
	nodeMajor: number | null,
	findings: ContractFinding[]
): string | null {
	const config = parseYamlFile(configFile, findings);
	if (!config) return null;

	const runner = asObject(config.runner);
	const labels = Array.isArray(runner?.labels) ? runner.labels : [];
	if (labels.length !== 1) {
		findings.push(
			finding(configFile.path, lineOf(configFile.content, 'labels:'), 'The runner must declare exactly one label.')
		);
	}
	let label: string | null = null;
	if (labels.length === 1 && typeof labels[0] === 'string') {
		const match = labels[0].match(/^([a-z0-9._-]+):docker:\/\/node:(\d+)(?:[-.@][^\s]*)?$/);
		if (!match) {
			findings.push(
				finding(
					configFile.path,
					lineOf(configFile.content, labels[0]),
					'The runner label must map to a Node container image.'
				)
			);
		} else {
			label = match[1];
			if (nodeMajor !== null && Number(match[2]) !== nodeMajor) {
				findings.push(
					finding(
						configFile.path,
						lineOf(configFile.content, labels[0]),
						`The runner Node image (${match[2]}) must match engines.node (${nodeMajor}).`
					)
				);
			}
		}
	}

	const container = asObject(config.container);
	if (container?.docker_host !== '-') {
		findings.push(
			finding(
				configFile.path,
				lineOf(configFile.content, 'docker_host'),
				'The host Docker socket must not be mounted into job containers; set docker_host to "-".'
			)
		);
	}
	if (container?.privileged !== false) {
		findings.push(
			finding(
				configFile.path,
				lineOf(configFile.content, 'privileged'),
				'Job containers must not run privileged.'
			)
		);
	}
	if (!Array.isArray(container?.valid_volumes) || container.valid_volumes.length > 0) {
		findings.push(
			finding(
				configFile.path,
				lineOf(configFile.content, 'valid_volumes'),
				'Workflows must not mount host volumes.'
			)
		);
	}
	if (/GITEA_RUNNER_LABELS|--labels\b/.test(scriptFile.content)) {
		findings.push(
			finding(
				scriptFile.path,
				lineOf(scriptFile.content, 'GITEA_RUNNER_LABELS'),
				'The runner labels must have one owner: act-runner.yaml.'
			)
		);
	}

	return label;
}

export function checkCiContract(inputs: ContractInputs): ContractFinding[] {
	const findings: ContractFinding[] = [];

	const gate = inputs.workflows.find((file) => file.path.endsWith(GATE_WORKFLOW));
	if (!gate) {
		findings.push(finding(GATE_WORKFLOW, 1, 'The gate workflow must exist.'));
	}

	const nodeMajor = checkPackage(inputs.packageFile, findings);
	checkDockerfile(inputs.dockerfile, nodeMajor, findings);
	const label = checkRunner(inputs.runnerConfig, inputs.runnerScript, nodeMajor, findings);

	for (const workflow of inputs.workflows) {
		if (workflow === gate) {
			checkWorkflow(workflow, label, findings);
			continue;
		}
		let parsed: unknown;
		try {
			parsed = parse(workflow.content);
		} catch {
			findings.push(finding(workflow.path, 1, 'The workflow must contain valid YAML.'));
			continue;
		}
		for (const uses of collectUses(parsed)) {
			if (!isPinned(uses)) {
				findings.push(
					finding(
						workflow.path,
						lineOf(workflow.content, uses),
						`Action must be pinned to a full commit SHA: ${uses}`
					)
				);
			}
		}
	}

	return findings;
}
