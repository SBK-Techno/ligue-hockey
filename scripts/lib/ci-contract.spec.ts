import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { describe, expect, it } from 'vitest';
import { checkCiContract, type ContractInputs } from './ci-contract.ts';

const ROOT = new URL('../..', import.meta.url).pathname;
const WORKFLOWS = join(ROOT, '.github/workflows');

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Objet attendu');
	}
	return value as JsonObject;
}

function array(value: unknown): unknown[] {
	if (!Array.isArray(value)) throw new Error('Tableau attendu');
	return value;
}

function steps(job: unknown): JsonObject[] {
	return array(object(job).steps).map(object);
}

function valid(): ContractInputs {
	return {
		workflows: readdirSync(WORKFLOWS)
			.filter((entry) => entry.endsWith('.yml') || entry.endsWith('.yaml'))
			.map((entry) => ({
				path: join(WORKFLOWS, entry),
				content: readFileSync(join(WORKFLOWS, entry), 'utf8')
			})),
		packageFile: { path: 'package.json', content: readFileSync(join(ROOT, 'package.json'), 'utf8') },
		dockerfile: { path: 'Dockerfile', content: readFileSync(join(ROOT, 'Dockerfile'), 'utf8') },
		nvmrc: { path: '.nvmrc', content: readFileSync(join(ROOT, '.nvmrc'), 'utf8') }
	};
}

function details(inputs: ContractInputs): string {
	return checkCiContract(inputs)
		.map((entry) => entry.detail)
		.join(' | ');
}

function editWorkflow(
	inputs: ContractInputs,
	name: string,
	mutate: (doc: JsonObject) => void
): void {
	const target = inputs.workflows.find((file) => file.path.endsWith(`/${name}`));
	if (!target) throw new Error(`workflow absent: ${name}`);
	const doc = object(parse(target.content));
	mutate(doc);
	target.content = stringify(doc);
}

function removeStep(doc: JsonObject, job: string, predicate: (step: JsonObject) => boolean): void {
	const target = object(object(doc.jobs)[job]);
	target.steps = steps(target).filter((step) => !predicate(step));
}

const mutations: Array<{
	name: string;
	mutate: (inputs: ContractInputs) => void;
	match: RegExp;
}> = [
	{
		name: 'rejects a CI workflow without pull_request',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				delete object(doc.on).pull_request;
			}),
		match: /pull_request/
	},
	{
		name: 'rejects a CI workflow that does not run on main',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				object(object(doc.on).push).branches = ['dev'];
			}),
		match: /poussées vers main/
	},
	{
		name: 'rejects a missing required job',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				delete object(doc.jobs).required;
			}),
		match: /required est requise/
	},
	{
		name: 'rejects a required job that is conditional',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				delete object(object(doc.jobs).required).if;
			}),
		match: /toujours s'exécuter/
	},
	{
		name: 'rejects a weakened gate command',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				const verify = object(object(doc.jobs).verify);
				verify.steps = steps(verify).map((step) =>
					step.run === 'npm run gate' ? { ...step, run: 'npm run verify' } : step
				);
			}),
		match: /npm run gate/
	},
	{
		name: 'rejects a missing npm ci',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				removeStep(doc, 'verify', (step) => step.run === 'npm ci --no-audit --no-fund');
			}),
		match: /npm ci/
	},
	{
		name: 'rejects a setup-node without cache',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				const setup = steps(object(doc.jobs).verify).find((step) =>
					String(step.uses).startsWith('actions/setup-node@')
				);
				if (!setup) throw new Error('setup-node absent');
				delete object(setup.with).cache;
			}),
		match: /cache npm/
	},
	{
		name: 'rejects a missing container job',
		mutate: (inputs) =>
			editWorkflow(inputs, 'ci.yml', (doc) => {
				delete object(doc.jobs).container;
			}),
		match: /container est requise/
	},
	{
		name: 'rejects an unpinned Pages deployment',
		mutate: (inputs) =>
			editWorkflow(inputs, 'pages.yml', (doc) => {
				const deploy = object(object(doc.jobs).deploy);
				object(array(deploy.steps)[0]).uses = 'actions/deploy-pages@v5';
			}),
		match: /SHA complet/
	},
	{
		name: 'rejects a Pages deployment without OIDC',
		mutate: (inputs) =>
			editWorkflow(inputs, 'pages.yml', (doc) => {
				delete object(object(object(doc.jobs).deploy).permissions)['id-token'];
			}),
		match: /Pages/
	},
	{
		name: 'rejects a release that does not listen for v tags',
		mutate: (inputs) =>
			editWorkflow(inputs, 'release.yml', (doc) => {
				object(object(doc.on).push).tags = ['release-*'];
			}),
		match: /étiquettes v/
	},
	{
		name: 'rejects a release without package write',
		mutate: (inputs) =>
			editWorkflow(inputs, 'release.yml', (doc) => {
				delete object(doc.permissions).packages;
			}),
		match: /paquets/
	},
	{
		name: 'rejects a docs workflow that skips validation',
		mutate: (inputs) =>
			editWorkflow(inputs, 'docs.yml', (doc) => {
				const docs = object(object(doc.jobs).docs);
				docs.steps = steps(docs).map((step) =>
					step.run === 'npm run docs:check' ? { ...step, run: 'npm run docs:build' } : step
				);
			}),
		match: /docs:check/
	},
	{
		name: 'rejects a weakened security audit',
		mutate: (inputs) =>
			editWorkflow(inputs, 'security.yml', (doc) => {
				const audit = object(object(doc.jobs).audit);
				audit.steps = steps(audit).map((step) =>
					String(step.run).includes('npm audit')
						? { ...step, run: 'npm audit --audit-level=critical' }
						: step
				);
			}),
		match: /npm audit/
	},
	{
		name: 'rejects a CodeQL workflow without init',
		mutate: (inputs) =>
			editWorkflow(inputs, 'codeql.yml', (doc) => {
				removeStep(doc, 'analyze', (step) =>
					String(step.uses).startsWith('github/codeql-action/init@')
				);
			}),
		match: /initialiser/
	},
	{
		name: 'rejects an unpinned dependency review',
		mutate: (inputs) =>
			editWorkflow(inputs, 'dependency-review.yml', (doc) => {
				const review = object(object(doc.jobs)['dependency-review']);
				object(array(review.steps)[1]).uses = 'actions/dependency-review-action@v5';
			}),
		match: /SHA complet/
	},
	{
		name: 'rejects a weakened gate script',
		mutate: (inputs) => {
			const pkg = JSON.parse(inputs.packageFile.content) as { scripts: Record<string, string> };
			pkg.scripts.gate = 'echo ok';
			inputs.packageFile.content = JSON.stringify(pkg, null, 2);
		},
		match: /La porte doit être/
	},
	{
		name: 'rejects a verify script without the docs check',
		mutate: (inputs) => {
			const pkg = JSON.parse(inputs.packageFile.content) as { scripts: Record<string, string> };
			pkg.scripts.verify = pkg.scripts.verify.replace(' && npm run docs:check', '');
			inputs.packageFile.content = JSON.stringify(pkg, null, 2);
		},
		match: /docs:check/
	},
	{
		name: 'rejects a mismatched .nvmrc',
		mutate: (inputs) => {
			inputs.nvmrc.content = '22\n';
		},
		match: /\.nvmrc/
	},
	{
		name: 'rejects a mismatched Dockerfile Node major',
		mutate: (inputs) => {
			inputs.dockerfile.content = inputs.dockerfile.content.replace(
				'FROM node:24-bookworm-slim AS runtime',
				'FROM node:26-bookworm-slim AS runtime'
			);
		},
		match: /major Node du Dockerfile/
	},
	{
		name: 'rejects a Dockerfile without OCI metadata',
		mutate: (inputs) => {
			inputs.dockerfile.content = inputs.dockerfile.content.replace(
				/\nLABEL[\s\S]*?org\.opencontainers\.image\.source="\$SOURCE"/,
				''
			);
		},
		match: /métadonnées OCI/
	},
	{
		name: 'rejects an unpinned action in any workflow',
		mutate: (inputs) => {
			inputs.workflows.push({
				path: '.github/workflows/extra.yml',
				content: 'jobs:\n  extra:\n    steps:\n      - uses: actions/checkout@v7\n'
			});
		},
		match: /SHA complet/
	}
];

describe('CI contract', () => {
	it('accepts the reference repository', () => {
		expect(checkCiContract(valid())).toEqual([]);
	});

	it('accepts a pinned extra workflow', () => {
		const inputs = valid();
		inputs.workflows.push({
			path: '.github/workflows/extra.yml',
			content:
				'jobs:\n  extra:\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n'
		});
		expect(details(inputs)).toBe('');
	});

	for (const { name, mutate, match } of mutations) {
		it(name, () => {
			const inputs = valid();
			mutate(inputs);
			expect(match.test(details(inputs))).toBe(true);
		});
	}
});
