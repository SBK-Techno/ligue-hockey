import { describe, expect, it } from 'vitest';
import { checkCiContract, type ContractInputs } from './ci-contract.ts';

const WORKFLOW = `name: Vérification

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: verification-\${{ github.ref }}
  cancel-in-progress: true

permissions:
  code: read

jobs:
  gate:
    name: Vérification
    runs-on: linux
    timeout-minutes: 30
    steps:
      - name: Récupérer la révision exacte
        uses: https://gitea.com/actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      - name: Installer les dépendances
        run: npm ci --no-audit --no-fund
      - name: Exécuter la porte
        run: npm run gate
`;

const RUNNER = `runner:
  labels:
    - "linux:docker://node:24-bookworm"

container:
  docker_host: "-"
  privileged: false
  valid_volumes: []
`;

const PACKAGE = JSON.stringify(
	{
		engines: { node: '>=24' },
		scripts: {
			'verify:shell': 'bash -n scripts/ci/runner.sh',
			'verify:architecture': 'tsx scripts/verify-architecture.ts',
			'verify:generated': 'tsx scripts/verify-generated.ts',
			verify:
				'npm run check && npm run lint && npm run test && npm run verify:architecture && npm run verify:generated && npm run verify:shell',
			gate: 'npm run verify && npm run build'
		}
	},
	null,
	2
);

const DOCKERFILE = `FROM node:24-bookworm-slim AS deps
FROM node:24-bookworm-slim AS build
FROM node:24-bookworm-slim AS runtime
`;

function valid(): ContractInputs {
	return {
		workflows: [{ path: '.gitea/workflows/verification.yml', content: WORKFLOW }],
		runnerConfig: { path: 'scripts/ci/act-runner.yaml', content: RUNNER },
		runnerScript: { path: 'scripts/ci/runner.sh', content: '#!/usr/bin/env bash\n' },
		packageFile: { path: 'package.json', content: PACKAGE },
		dockerfile: { path: 'Dockerfile', content: DOCKERFILE }
	};
}

function details(inputs: ContractInputs): string {
	return checkCiContract(inputs)
		.map((entry) => entry.detail)
		.join(' | ');
}

const mutations: Array<{
	name: string;
	mutate: (inputs: ContractInputs) => void;
	match: RegExp;
}> = [
	{
		name: 'rejects a workflow without pull_request',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'  pull_request:\n    types: [opened, synchronize, reopened]\n',
				''
			);
		},
		match: /pull_request/
	},
	{
		name: 'rejects a workflow that does not run on main',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'branches: [main]',
				'branches: [dev]'
			);
		},
		match: /pushes to main/
	},
	{
		name: 'rejects an extra job',
		mutate: (inputs) => {
			inputs.workflows[0].content += '\n  extra:\n    runs-on: linux\n    steps: []\n';
		},
		match: /exactly one job/
	},
	{
		name: 'rejects a mismatched runner label',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'runs-on: linux',
				'runs-on: ubuntu-latest'
			);
		},
		match: /runner label linux/
	},
	{
		name: 'rejects a conditional job',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'    runs-on: linux',
				'    runs-on: linux\n    if: false'
			);
		},
		match: /cannot be conditional/
	},
	{
		name: 'rejects a job that continues on error',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'    runs-on: linux',
				'    runs-on: linux\n    continue-on-error: true'
			);
		},
		match: /cannot continue on error/
	},
	{
		name: 'rejects a step that continues on error',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'        run: npm ci --no-audit --no-fund',
				'        run: npm ci --no-audit --no-fund\n        continue-on-error: true'
			);
		},
		match: /steps cannot continue on error/
	},
	{
		name: 'rejects a wrapped gate command',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'run: npm run gate',
				'run: npm run gate || true'
			);
		},
		match: /exactly once/
	},
	{
		name: 'rejects a missing lockfile install',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'      - name: Installer les dépendances\n        run: npm ci --no-audit --no-fund\n',
				''
			);
		},
		match: /npm ci/
	},
	{
		name: 'rejects an unpinned action in the gate workflow',
		mutate: (inputs) => {
			inputs.workflows[0].content = inputs.workflows[0].content.replace(
				'@11d5960a326750d5838078e36cf38b85af677262',
				'@v4'
			);
		},
		match: /full commit SHA/
	},
	{
		name: 'rejects an unpinned action in any workflow',
		mutate: (inputs) => {
			inputs.workflows.push({
				path: '.gitea/workflows/deploy.yml',
				content: 'jobs:\n  deploy:\n    steps:\n      - uses: actions/checkout@v4\n'
			});
		},
		match: /full commit SHA/
	},
	{
		name: 'rejects a weakened gate script',
		mutate: (inputs) => {
			inputs.packageFile.content = inputs.packageFile.content.replace(
				'"gate": "npm run verify && npm run build"',
				'"gate": "echo ok"'
			);
		},
		match: /gate script must be/
	},
	{
		name: 'rejects a verify script missing a command',
		mutate: (inputs) => {
			inputs.packageFile.content = inputs.packageFile.content.replace(' && npm run lint', '');
		},
		match: /must include: npm run lint/
	},
	{
		name: 'rejects a package without a Node major',
		mutate: (inputs) => {
			inputs.packageFile.content = inputs.packageFile.content.replace(
				'"node": ">=24"',
				'"node": "latest"'
			);
		},
		match: /engines.node/
	},
	{
		name: 'rejects the host Docker socket in job containers',
		mutate: (inputs) => {
			inputs.runnerConfig.content = inputs.runnerConfig.content.replace(
				'docker_host: "-"',
				'docker_host: ""'
			);
		},
		match: /docker_host/
	},
	{
		name: 'rejects privileged job containers',
		mutate: (inputs) => {
			inputs.runnerConfig.content = inputs.runnerConfig.content.replace(
				'privileged: false',
				'privileged: true'
			);
		},
		match: /privileged/
	},
	{
		name: 'rejects host volume mounting',
		mutate: (inputs) => {
			inputs.runnerConfig.content = inputs.runnerConfig.content.replace(
				'valid_volumes: []',
				'valid_volumes: ["**"]'
			);
		},
		match: /host volumes/
	},
	{
		name: 'rejects a runner Node major that differs from the app',
		mutate: (inputs) => {
			inputs.runnerConfig.content = inputs.runnerConfig.content.replace(
				'node:24-bookworm',
				'node:22-bookworm'
			);
		},
		match: /runner Node image/
	},
	{
		name: 'rejects a Dockerfile Node major that differs from the app',
		mutate: (inputs) => {
			inputs.dockerfile.content = inputs.dockerfile.content.replace(
				'FROM node:24-bookworm-slim AS runtime',
				'FROM node:26-bookworm-slim AS runtime'
			);
		},
		match: /Dockerfile Node major/
	},
	{
		name: 'rejects runner labels owned by the script',
		mutate: (inputs) => {
			inputs.runnerScript.content += '\nGITEA_RUNNER_LABELS=linux\n';
		},
		match: /one owner/
	}
];

describe('CI contract', () => {
	it('accepts the reference contract', () => {
		expect(checkCiContract(valid())).toEqual([]);
	});

	it('accepts a local action', () => {
		const inputs = valid();
		inputs.workflows[0].content = inputs.workflows[0].content.replace(
			'      - name: Exécuter la porte',
			'      - name: Action locale\n        uses: ./.gitea/actions/local\n      - name: Exécuter la porte'
		);
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
