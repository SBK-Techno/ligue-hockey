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
	packageFile: ContractFile;
	dockerfile: ContractFile;
	nvmrc: ContractFile;
};

type Json = Record<string, unknown>;

const GATE_SCRIPT = 'npm run verify && npm run build';
const VERIFY_COMMANDS = [
	'npm run check',
	'npm run lint',
	'npm run test',
	'npm run verify:architecture',
	'npm run verify:release',
	'npm run verify:generated',
	'npm run verify:shell',
	'npm run docs:check'
] as const;

function asObject(value: unknown): Json | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function lineOf(content: string, needle: string): number {
	const index = content.indexOf(needle);
	if (index < 0) return 1;
	return content.slice(0, index).split('\n').length;
}

function finding(file: string, line: number, detail: string): ContractFinding {
	return { file, line, rule: 'ci-contract', detail };
}

function collectUses(value: unknown, output: string[] = []): string[] {
	if (Array.isArray(value)) {
		for (const entry of value) collectUses(entry, output);
		return output;
	}
	const object = asObject(value);
	if (!object) return output;
	for (const [key, entry] of Object.entries(object)) {
		if (key === 'uses' && typeof entry === 'string') output.push(entry);
		else collectUses(entry, output);
	}
	return output;
}

function isPinned(uses: string): boolean {
	if (uses.startsWith('./')) return true;
	if (uses.startsWith('docker://')) return /@sha256:[0-9a-f]{64}$/.test(uses);
	return /@[0-9a-f]{40}$/.test(uses);
}

function parseFile(file: ContractFile | undefined, findings: ContractFinding[]): Json | null {
	if (!file) return null;
	try {
		const object = asObject(parse(file.content));
		if (!object) {
			findings.push(finding(file.path, 1, 'Le fichier doit contenir une table YAML.'));
			return null;
		}
		return object;
	} catch {
		findings.push(finding(file.path, 1, 'Le fichier doit contenir du YAML valide.'));
		return null;
	}
}

function jobNames(jobs: Json | null): string[] {
	return jobs ? Object.keys(jobs) : [];
}

function stepsOf(job: Json | null): Json[] {
	return asArray(job?.steps).map(asObject).filter((step): step is Json => step !== null);
}

function runsOf(job: Json | null): string[] {
	return stepsOf(job)
		.map((step) => step.run)
		.filter((run): run is string => typeof run === 'string');
}

function usesOf(job: Json | null): string[] {
	return stepsOf(job)
		.map((step) => step.uses)
		.filter((uses): uses is string => typeof uses === 'string');
}

function hasRun(job: Json | null, needle: string): boolean {
	return runsOf(job).some((run) => run.includes(needle));
}

function checkTriggers(
	file: ContractFile,
	workflow: Json,
	options: { pullRequest?: boolean; branches?: string[]; tags?: string[] },
	findings: ContractFinding[]
): void {
	const triggers = asObject(workflow.on);
	if (!triggers) {
		findings.push(finding(file.path, 1, 'Le workflow doit déclarer ses déclencheurs.'));
		return;
	}
	if (options.pullRequest && !('pull_request' in triggers)) {
		findings.push(
			finding(file.path, lineOf(file.content, 'on:'), 'Le workflow doit écouter pull_request.')
		);
	}
	const push = asObject(triggers.push);
	if (options.branches) {
		const branches = push?.branches;
		const matches = Array.isArray(branches)
			? options.branches.every((branch) => branches.includes(branch))
			: branches === options.branches[0];
		if (!matches) {
			findings.push(
				finding(file.path, lineOf(file.content, 'push:'), 'Le workflow doit écouter les poussées vers main.')
			);
		}
	}
	if (options.tags) {
		const tags = push?.tags;
		const matches = Array.isArray(tags)
			? options.tags.every((tag) => tags.includes(tag))
			: tags === options.tags[0];
		if (!matches) {
			findings.push(
				finding(file.path, lineOf(file.content, 'tags:'), 'Le workflow doit écouter les étiquettes v*.')
			);
		}
	}
}

function checkCi(
	file: ContractFile,
	workflow: Json,
	nodeMajor: number | null,
	findings: ContractFinding[]
): void {
	checkTriggers(file, workflow, { pullRequest: true, branches: ['main'] }, findings);
	const jobs = asObject(workflow.jobs);
	const names = jobNames(jobs);
	for (const expected of ['verify', 'container', 'required']) {
		if (!names.includes(expected)) {
			findings.push(finding(file.path, lineOf(file.content, 'jobs:'), `La tâche ${expected} est requise.`));
		}
	}

	for (const name of names) {
		const job = asObject(jobs?.[name]);
		if (job?.if !== undefined && name !== 'required') {
			findings.push(finding(file.path, lineOf(file.content, 'if:'), `La tâche ${name} ne peut pas être conditionnelle.`));
		}
		if (job?.['continue-on-error'] !== undefined) {
			findings.push(
				finding(file.path, lineOf(file.content, 'continue-on-error'), `La tâche ${name} ne peut pas continuer en cas d'erreur.`)
			);
		}
	}

	const verify = asObject(jobs?.verify);
	if (verify) {
		const steps = stepsOf(verify);
		const setup = steps.find(
			(step) => typeof step.uses === 'string' && step.uses.startsWith('actions/setup-node@')
		);
		const settings = asObject(setup?.with);
		if (!setup) {
			findings.push(finding(file.path, lineOf(file.content, 'steps:'), 'La tâche verify doit installer Node.'));
		} else {
			if (settings?.['node-version-file'] !== '.nvmrc') {
				findings.push(
					finding(file.path, lineOf(file.content, 'node-version-file'), 'setup-node doit lire .nvmrc.')
				);
			}
			if (settings?.cache !== 'npm') {
				findings.push(finding(file.path, lineOf(file.content, 'cache:'), 'setup-node doit activer le cache npm.'));
			}
		}
		if (!hasRun(verify, 'npm ci --no-audit --no-fund')) {
			findings.push(finding(file.path, lineOf(file.content, 'run:'), 'La tâche verify doit installer avec npm ci.'));
		}
		if (runsOf(verify).filter((run) => run === 'npm run gate').length !== 1) {
			findings.push(
				finding(file.path, lineOf(file.content, 'run:'), 'La tâche verify doit appeler npm run gate exactement une fois.')
			);
		}
		if (nodeMajor === null) {
			findings.push(finding(file.path, 1, 'Le major Node doit être déclaré dans package.json.'));
		}
	}

	const container = asObject(jobs?.container);
	if (container) {
		if (!hasRun(container, 'docker build')) {
			findings.push(finding(file.path, lineOf(file.content, 'run:'), "La tâche container doit construire l'image."));
		}
		if (!hasRun(container, 'bash scripts/ci/container-smoke.sh')) {
			findings.push(
				finding(file.path, lineOf(file.content, 'run:'), 'La tâche container doit exécuter le test de santé.')
			);
		}
	}

	const required = asObject(jobs?.required);
	if (required) {
		const needs = asArray(required.needs);
		if (!needs.includes('verify') || !needs.includes('container')) {
			findings.push(
				finding(file.path, lineOf(file.content, 'needs:'), 'La tâche required doit dépendre de verify et container.')
			);
		}
		if (required.if !== 'always()') {
			findings.push(
				finding(file.path, lineOf(file.content, 'if:'), "La tâche required doit toujours s'exécuter.")
			);
		}
		const aggregate = stepsOf(required).find((step) => typeof step.run === 'string' && step.run.includes('test "$VERIFY"'));
		if (!aggregate) {
			findings.push(
				finding(file.path, lineOf(file.content, 'steps:'), 'La tâche required doit agréger les deux résultats.')
			);
		}
	}
}

function checkPages(file: ContractFile, workflow: Json, findings: ContractFinding[]): void {
	checkTriggers(file, workflow, { branches: ['main'] }, findings);
	const jobs = asObject(workflow.jobs);
	const build = asObject(jobs?.build);
	const deploy = asObject(jobs?.deploy);
	if (!build) findings.push(finding(file.path, lineOf(file.content, 'jobs:'), 'La tâche build est requise.'));
	if (!deploy) findings.push(finding(file.path, lineOf(file.content, 'jobs:'), 'La tâche deploy est requise.'));
	if (build && !hasRun(build, 'npm run docs:build')) {
		findings.push(finding(file.path, lineOf(file.content, 'run:'), 'La tâche build doit générer le site.'));
	}
	if (deploy) {
		const uses = usesOf(deploy).find((value) => value.startsWith('actions/deploy-pages@'));
		if (!uses) {
			findings.push(
				finding(file.path, lineOf(file.content, 'uses:'), 'La tâche deploy doit utiliser actions/deploy-pages.')
			);
		}
		const permissions = asObject(deploy.permissions);
		if (permissions?.pages !== 'write' || permissions?.['id-token'] !== 'write') {
			findings.push(
				finding(file.path, lineOf(file.content, 'permissions:'), 'La tâche deploy doit pouvoir écrire Pages avec un jeton OIDC.')
			);
		}
	}
}

function checkRelease(
	file: ContractFile,
	workflow: Json,
	findings: ContractFinding[],
	expectedImage: string | null
): void {
	checkTriggers(file, workflow, { tags: ['v*'] }, findings);
	const triggers = asObject(workflow.on);
	if (!triggers || !('workflow_call' in triggers)) {
		findings.push(
			finding(file.path, lineOf(file.content, 'workflow_call:'), 'La publication doit être appelable par le plan de version.')
		);
	}
	if (!file.content.includes('inputs.tag')) {
		findings.push(
			finding(file.path, lineOf(file.content, 'inputs:'), "La publication doit accepter l'étiquette à publier.")
		);
	}
	const permissions = asObject(workflow.permissions);
	if (permissions?.contents !== 'write' || permissions?.packages !== 'write') {
		findings.push(
			finding(file.path, lineOf(file.content, 'permissions:'), 'La publication doit pouvoir écrire le dépôt et les paquets.')
		);
	}
	const jobs = asObject(workflow.jobs);
	const release = asObject(jobs?.release);
	if (!release) {
		findings.push(finding(file.path, lineOf(file.content, 'jobs:'), 'La tâche release est requise.'));
		return;
	}
	const runs = runsOf(release);
	if (!runs.some((run) => run.includes('node -p') && run.includes('GITHUB_REF_NAME'))) {
		findings.push(
			finding(file.path, lineOf(file.content, 'run:'), "La publication doit vérifier que l'étiquette correspond à package.json.")
		);
	}
	if (!runs.some((run) => run.includes('docker build') && run.includes('--build-arg VERSION'))) {
		findings.push(finding(file.path, lineOf(file.content, 'run:'), "La publication doit construire l'image avec sa version."));
	}
	const environment = asObject(release.env);
	if (!expectedImage || environment?.IMAGE !== expectedImage) {
		findings.push(
			finding(
				file.path,
				lineOf(file.content, 'IMAGE:'),
				`La publication doit cibler l'image ${expectedImage ?? 'ghcr.io/<dépôt>'}.`
			)
		);
	}
	if (!runs.some((run) => run.includes('docker push'))) {
		findings.push(
			finding(file.path, lineOf(file.content, 'run:'), "La publication doit pousser l'image sur GHCR.")
		);
	}
	if (!runs.some((run) => run.includes('gh release create'))) {
		findings.push(
			finding(file.path, lineOf(file.content, 'run:'), 'La publication doit créer une version GitHub.')
		);
	}
}

function checkAutoRelease(file: ContractFile, workflow: Json, findings: ContractFinding[]): void {
	checkTriggers(file, workflow, { branches: ['main'] }, findings);
	const permissions = asObject(workflow.permissions);
	for (const key of ['contents', 'pull-requests', 'actions']) {
		if (permissions?.[key] !== 'write') {
			findings.push(
				finding(file.path, lineOf(file.content, 'permissions:'), `Le plan de version doit déclarer ${key}: write.`)
			);
		}
	}
	const jobs = asObject(workflow.jobs);
	const plan = asObject(jobs?.plan);
	const prepare = asObject(jobs?.prepare);
	const tag = asObject(jobs?.tag);
	const publish = asObject(jobs?.publish);
	if (!plan || !prepare || !tag || !publish) {
		findings.push(
			finding(file.path, lineOf(file.content, 'jobs:'), 'Les tâches plan, prepare, tag et publish sont requises.')
		);
		return;
	}
	if (!hasRun(plan, 'scripts/release/plan.ts')) {
		findings.push(finding(file.path, lineOf(file.content, 'run:'), 'Le plan doit exécuter scripts/release/plan.ts.'));
	}
	if (!hasRun(prepare, 'scripts/release/apply.ts')) {
		findings.push(finding(file.path, lineOf(file.content, 'run:'), 'La préparation doit exécuter scripts/release/apply.ts.'));
	}
	if (!hasRun(prepare, 'gh pr create')) {
		findings.push(finding(file.path, lineOf(file.content, 'run:'), 'La préparation doit ouvrir une demande de fusion.'));
	}
	if (!hasRun(prepare, 'gh workflow run ci.yml')) {
		findings.push(finding(file.path, lineOf(file.content, 'run:'), 'La préparation doit lancer la porte sur la branche de version.'));
	}
	if (!hasRun(tag, 'git tag')) {
		findings.push(finding(file.path, lineOf(file.content, 'run:'), "La tâche tag doit créer l'étiquette."));
	}
	const publishWorkflow = typeof publish.uses === 'string' ? publish.uses : '';
	if (!publishWorkflow.startsWith('./.github/workflows/release.yml')) {
		findings.push(
			finding(file.path, lineOf(file.content, 'uses:'), 'La publication doit appeler le workflow release.yml.')
		);
	}
}

function checkNamedWorkflow(
	file: ContractFile,
	workflow: Json,
	options: { run?: string; uses?: string; permissions?: Record<string, string> },
	findings: ContractFinding[]
): void {
	const jobs = asObject(workflow.jobs);
	for (const name of jobNames(jobs)) {
		const job = asObject(jobs?.[name]);
		if (options.run && !hasRun(job, options.run)) {
			findings.push(finding(file.path, lineOf(file.content, 'run:'), `La tâche ${name} doit exécuter ${options.run}.`));
		}
		if (options.uses && !usesOf(job).some((value) => value.startsWith(options.uses as string))) {
			findings.push(finding(file.path, lineOf(file.content, 'uses:'), `La tâche ${name} doit utiliser ${options.uses}.`));
		}
	}
	if (options.permissions) {
		const permissions = asObject(workflow.permissions);
		for (const [key, value] of Object.entries(options.permissions)) {
			if (permissions?.[key] !== value) {
				findings.push(
					finding(file.path, lineOf(file.content, 'permissions:'), `Le workflow doit déclarer ${key}: ${value}.`)
				);
			}
		}
	}
}

export function checkCiContract(inputs: ContractInputs): ContractFinding[] {
	const findings: ContractFinding[] = [];
	const byName = (name: string) =>
		inputs.workflows.find((file) => file.path.endsWith(`/${name}`) || file.path === name);

	let packageJson: Json;
	try {
		packageJson = JSON.parse(inputs.packageFile.content) as Json;
	} catch {
		findings.push(finding(inputs.packageFile.path, 1, 'package.json doit contenir du JSON valide.'));
		return findings;
	}
	const repository = asObject(packageJson.repository);
	const repositoryUrl = typeof repository?.url === 'string' ? repository.url : '';
	let expectedImage: string | null;
	try {
		expectedImage = `ghcr.io/${new URL(repositoryUrl).pathname
			.replace(/^\//, '')
			.replace(/\.git$/, '')
			.toLowerCase()}`;
	} catch {
		expectedImage = null;
	}

	const scripts = asObject(packageJson.scripts);
	if (scripts?.gate !== GATE_SCRIPT) {
		findings.push(
			finding(inputs.packageFile.path, lineOf(inputs.packageFile.content, '"gate"'), `La porte doit être: ${GATE_SCRIPT}`)
		);
	}
	const verify = typeof scripts?.verify === 'string' ? scripts.verify : '';
	for (const command of VERIFY_COMMANDS) {
		if (!verify.includes(command)) {
			findings.push(
				finding(inputs.packageFile.path, lineOf(inputs.packageFile.content, '"verify"'), `La vérification doit inclure: ${command}`)
			);
		}
	}
	if (!scripts?.['docs:build'] || !scripts?.['docs:check']) {
		findings.push(
			finding(inputs.packageFile.path, lineOf(inputs.packageFile.content, '"docs:build"'), 'Les scripts de documentation sont requis.')
		);
	}

	const engines = asObject(packageJson.engines);
	const nodeMatch = typeof engines?.node === 'string' ? engines.node.match(/\d+/) : null;
	const nodeMajor = nodeMatch ? Number(nodeMatch[0]) : null;
	if (nodeMajor === null) {
		findings.push(
			finding(inputs.packageFile.path, lineOf(inputs.packageFile.content, '"engines"'), 'engines.node doit déclarer un major.')
		);
	}
	const nvmrcMatch = inputs.nvmrc.content.trim().replace(/^v/, '').match(/^\d+/);
	const nvmrcMajor = nvmrcMatch ? Number(nvmrcMatch[0]) : null;
	if (nodeMajor !== null && nvmrcMajor !== nodeMajor) {
		findings.push(
			finding(inputs.nvmrc.path, 1, `Le major de .nvmrc (${nvmrcMajor}) doit correspondre à engines.node (${nodeMajor}).`)
		);
	}

	const dockerMajors = [...inputs.dockerfile.content.matchAll(/^\s*FROM\s+node:(\d+)/gim)].map((match) =>
		Number(match[1])
	);
	if (dockerMajors.length === 0) {
		findings.push(finding(inputs.dockerfile.path, 1, "L'image doit partir d'une image Node."));
	}
	for (const major of dockerMajors) {
		if (nodeMajor !== null && major !== nodeMajor) {
			findings.push(
				finding(
					inputs.dockerfile.path,
					lineOf(inputs.dockerfile.content, `node:${major}`),
					`Le major Node du Dockerfile (${major}) doit correspondre à engines.node (${nodeMajor}).`
				)
			);
		}
	}
	if (!inputs.dockerfile.content.includes('org.opencontainers.image.version')) {
		findings.push(
			finding(inputs.dockerfile.path, 1, 'L image doit déclarer ses métadonnées OCI.')
		);
	}

	for (const name of ['ci.yml', 'docs.yml', 'pages.yml', 'release.yml', 'auto-release.yml', 'security.yml', 'codeql.yml', 'dependency-review.yml']) {
		if (!byName(name)) findings.push(finding(name, 1, `Le workflow ${name} est requis.`));
	}

	const ciFile = byName('ci.yml');
	const ci = parseFile(ciFile, findings);
	if (ci && ciFile) checkCi(ciFile, ci, nodeMajor, findings);

	const pagesFile = byName('pages.yml');
	const pages = parseFile(pagesFile, findings);
	if (pages && pagesFile) checkPages(pagesFile, pages, findings);

	const releaseFile = byName('release.yml');
	const release = parseFile(releaseFile, findings);
	if (release && releaseFile) {
		checkRelease(releaseFile, release, findings, expectedImage);
	}

	const autoReleaseFile = byName('auto-release.yml');
	const autoRelease = parseFile(autoReleaseFile, findings);
	if (autoRelease && autoReleaseFile) {
		checkAutoRelease(autoReleaseFile, autoRelease, findings);
	}

	const docsFile = byName('docs.yml');
	const docs = parseFile(docsFile, findings);
	if (docs && docsFile) checkNamedWorkflow(docsFile, docs, { run: 'npm run docs:check' }, findings);

	const securityFile = byName('security.yml');
	const security = parseFile(securityFile, findings);
	if (security && securityFile) {
		checkNamedWorkflow(securityFile, security, { run: 'npm audit --omit=dev --audit-level=high' }, findings);
	}

	const codeqlFile = byName('codeql.yml');
	const codeql = parseFile(codeqlFile, findings);
	if (codeql && codeqlFile) {
		const uses = collectUses(codeql);
		if (!uses.some((value) => value.startsWith('github/codeql-action/init@'))) {
			findings.push(finding(codeqlFile.path, 1, "CodeQL doit initialiser l'analyse."));
		}
		if (!uses.some((value) => value.startsWith('github/codeql-action/analyze@'))) {
			findings.push(finding(codeqlFile.path, 1, 'CodeQL doit analyser le code.'));
		}
		checkNamedWorkflow(codeqlFile, codeql, { permissions: { 'security-events': 'write' } }, findings);
	}

	const reviewFile = byName('dependency-review.yml');
	const review = parseFile(reviewFile, findings);
	if (review && reviewFile) {
		checkNamedWorkflow(reviewFile, review, { uses: 'actions/dependency-review-action@' }, findings);
	}

	for (const workflow of inputs.workflows) {
		let parsed: unknown;
		try {
			parsed = parse(workflow.content);
		} catch {
			findings.push(finding(workflow.path, 1, 'Le workflow doit contenir du YAML valide.'));
			continue;
		}
		for (const uses of collectUses(parsed)) {
			if (!isPinned(uses)) {
				findings.push(
					finding(workflow.path, lineOf(workflow.content, uses), `Action non épinglée à un SHA complet: ${uses}`)
				);
			}
		}
	}

	return findings;
}
