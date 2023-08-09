import { DomCompiler } from './compiler';

const args = process.argv.slice(2);

switch (args[0]) {
	case 'compile':
		new DomCompiler();

		break;

	default: {
		console.warn(`invalid command: ${args[0]}`);
		console.group();
		console.log('compile: Compile classes in typescript dist');
		console.groupEnd();

		process.exit(1);
	}
}