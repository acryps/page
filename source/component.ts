import { Route } from './route';
import { Router } from './router';
import { RouteableRouteGroup, RouteGroup } from './route-group';

export class Component {
	static directives: {
		[ key: string ]: (element: Node, value, tag: string, attributes, ...content) => void
	} = {};

	loaded = true;
	
	route: Route;
	router: Router;

	parameters: Record<string, string>;
	parent?: Component;
	rootNode: Node;

	child?: Component;
	childNode: Node;

	get activeRoute() { return this.route; }
	
	onload(): Promise<void> | void {}
	onunload(): Promise<void> | void {}
	onerror(error): Promise<void> | void {}

	onchildchange(parameters, route: Route, component: Component): Promise<void> | void {}

	renderLoader() {
		return document.createComment(`* ${this.constructor.name} *`);
	}

	renderError(error: Error) {
		console.error(error);
		
		return this.createElement('section', null, 
			this.createElement('b', null, error.message),
			this.createElement('pre', null, error.stack)
		);
	}
	
	render(child?: Node): Node {
		// create placeholder render
		return this.createElement(
			'component', 
			{ type: this.constructor.name }, 
			'< ', this.constructor.name,
			`(${Object.keys(this.parameters).map(key => `${key}: ${JSON.stringify(this.parameters[key])}`).join(', ')})`, 
			'{', child, '}', 
			' >'
		);
	}
	
	async update(child?: Node) {
		for (const childComponent of this.getChildren(this.rootNode, this)) {
			await childComponent.unload();
			await childComponent.update();
		}

		if (arguments.length == 0) {
			child = this.childNode;
		} else {
			this.childNode = child;
		}

		if (child?.parentElement) {
			child.parentElement.removeChild(child);
		}

		const element = this.render(child);
		
		if (this.rootNode?.parentNode) {
			this.rootNode.parentNode.replaceChild(element, this.rootNode);
		}

		if (this.parent) {
			this.parent.childNode = element;
		}
		
		this.rootNode = element;
		
		return element;
	}

	async reload() {
		await this.onunload();
		await this.onload();
		
		await this.update();
	}

	async unload() {
		for (const childComponent of this.getChildren(this.rootNode, this)) {
			await childComponent.unload();
		}

		if (this.loaded) {
			this.loaded = false;
			await this.onunload();
		}
	}

	private getChildren(node: Node, hostingComponent: Component) {
		const children: Component[] = [];

		if (node.nodeType == Node.ELEMENT_NODE) {
			let child = node.firstChild;

			// DOM intended to iterate with nextSibling through nodes
			while (child) {
				if (child.hostingComponent && child.hostingComponent.parent == hostingComponent) {
					children.push(child.hostingComponent);
				} else {
					children.push(...this.getChildren(child, hostingComponent));
				}

				child = child.nextSibling;
			}
		}

		return children;
	}

	static createElement(tag, attributes, ...contents) {
		throw 'cannot create element from uncompiled source';
	}
	
	createElement(tag, attributes, ...contents) {
		const element = document.createElement(tag);
		element.hostingComponent = this;

		for (let item of contents) {
			this.addToElement(item, element);
		}
		
		for (let key in attributes) {
			if (key[0] != '_') {
				const value = attributes[key];
				
				if (key in Component.directives) {
					Component.directives[key](element, value, tag, attributes, contents);
				} else if (value !== null) {
					element.setAttribute(key, value);
				}
			}
		}

		return element;
	}

	static accessor(get: Function, set: Function) {
		return {
			get() {
				return get()
			},
			set(value) {
				set(value);
			}
		}
	}

	private addToElement(item, element: Node) {
		if (item instanceof Node) {
			element.appendChild(item);
		} else if (Array.isArray(item)) {
			for (let child of item) {
				this.addToElement(child, element);
			}
		} else if (item instanceof Component) {
			const placeholder = item.renderLoader();

			element.appendChild(placeholder);

			item.parent = this;
			item.route = this.route;
			item.router = this.router;

			(async () => {
				await item.onload();

				const child = item.render();
				item.rootNode = child;

				element.replaceChild(child, placeholder);
			})();
		} else if (item !== false && item !== undefined && item !== null) {
			element.appendChild(document.createTextNode(item));
		}
	}

	async host(parent: Node) {
		await this.onload();

		const root = this.render();
		this.rootNode = root;
		this.parent = null;

		parent.appendChild(root);
	}

	navigate(path: string) {
		this.router.navigate(path, this);

		return document.createComment(path);
	}

	remove() {
		this.rootNode?.parentElement?.removeChild(this.rootNode);
	}

	static updating(handler: (index?: number) => string | number, interval) {
		const element = document.createTextNode(`${handler(0)}`);
		let i = 0;

		setInterval(() => {
			element.textContent = `${handler(++i)}`;
		}, interval);

		return element;
	}

	static route(path: string, component: RouteGroup) {
		const tree: RouteableRouteGroup = {
			component: this,
			children: {
				[path]: component
			},

			route(path: string, component: RouteGroup): RouteableRouteGroup {
				tree.children[path] = component;

				return tree;
			}
		}

		return tree;
	}
}