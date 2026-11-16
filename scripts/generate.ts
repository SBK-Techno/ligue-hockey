import { generateBranding, writeGeneratedFiles } from './lib/branding.ts';

const root = process.cwd();
const files = await generateBranding(root);
await writeGeneratedFiles(root, files);
process.stdout.write(`Generated ${files.length} branding assets.\n`);
