import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'espree';
import { traverse } from 'estraverse';

export class DomCompiler {
	static configFile = 'tsconfig.json';

	constructor() {
		if (!existsSync(DomCompiler.configFile)) {
			throw new Error(`no '${DomCompiler.configFile}' found in '${process.cwd()}'`);
		}

		const config = JSON.parse(readFileSync(DomCompiler.configFile).toString());

		if (config.compilerOptions.outFile) {
			this.compile(config.compilerOptions.outFile);
		} else {
			this.scan(config.compilerOptions.outDir);
		}
	}

	compile(path: string) {
		let source = readFileSync(path).toString();

		if (source.trim().startsWith('// @acryps/page ignore')) {
			return;
		}

		if (source.trim().startsWith('// @acryps/page parsed')) {
			console.warn(`ignoring already parsed file '${path}'`);

			return;
		}

		const replace = [];

        const tree = parse(source, {
			ecmaVersion: "latest",
            sourceType: "script",
			range: true
        });
		
		traverse(tree, {
			enter: (node) => {
				if (node.type == 'CallExpression' && node.callee.type == 'MemberExpression' && node.callee.property?.name == 'createElement' && (
					(
						node.callee.object?.type == 'MemberExpression' && node.callee.object?.property?.name == 'Component'
					) || node.callee.object?.name == 'Component'
				)) {
					const attributes = node.arguments[1];
					const component = source.substring(node.range[0], node.callee.range[1]).replace('.createElement', '');

					replace.push({
						offset: node.range[0],
						length: node.callee.range[1] - node.range[0],
						content: 'this.createElement'
					});

					if (attributes?.type == 'ObjectExpression') {
						for (let property of attributes.properties) {
							if (property.key.type == 'Literal' && property.key.value[0] == '$') {
								const value = source.substring(property.value.range[0], property.value.range[1]);

								replace.push({
									offset: property.value.range[0],
									length: property.value.range[1] - property.value.range[0],
									content: `${component}.accessor(() => ${value}, value => ${value} = value)`
								});
							}
						}
					}
				}
			}
		});

        let offset = 0; 

        for (let item of replace.sort((a, b) => a.offset - b.offset)) {
            const before = source.substring(0, item.offset - offset);
            const after = source.substring(item.offset - offset + item.length);

            source = `${before}${item.content}${after}`;
            offset += item.length - item.content.length;
        }
        
        writeFileSync(path, `// @acryps/page parsed\n${source}`);
	}

	scan(directory: string) {
		for (let item of readdirSync(directory)) {
			const path = `${directory}/${item}`;

			if (lstatSync(path).isDirectory()) {
				this.scan(path);
			} else if (path.endsWith('.js')) {
				try {
					this.compile(path);
				} catch (e) {
					console.error(`Compiling of '${path}' failed!`, e);
				}
			}
		}
	}
}