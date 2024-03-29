import { Route } from './route';
import { Router } from './router';
import { ResolveableRouteGroup, RouteableRouteGroup, Routable } from './route-group';

export type ComponentContent = string | number | boolean | null | undefined | Node | Component | ComponentContent[];

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
	onrouteleave(): Promise<void> | void {}
	
	onerror(error): Promise<void> | void {
		console.error(`Error occured in '${this.constructor.name}'`, error);
	}

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
			this.parameters ? `(${Object.keys(this.parameters).map(key => `${key}: ${JSON.stringify(this.parameters[key])}`).join(', ')})` : '*', 
			'{', child, '}', 
			' >'
		);
	}
	
	update(child?: Node) {
		if (arguments.length == 0) {
			child = this.childNode;
		} else {
			this.childNode = child;
		}

		if (child?.parentElement) {
			child.parentElement.removeChild(child);
		}

		const element = this.render(child);
		
		// replace the old rendered content with the newly rendered content
		if (this.rootNode?.parentNode) {
			this.rootNode.parentNode.replaceChild(element, this.rootNode);
		}

		// update the parents child node, so that updating the parent places the updated content this component into child
		// only set this when the parent has been set by the router, eg if the parents child is us
		if (this.parent && this.parent.child == this) {
			this.parent.childNode = element;
		}
		
		this.rootNode = element;
		
		return element;
	}

	async reload() {
		await this.onload();

		if (this.child) {
			await this.child.reload();
		}

		await this.update();
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
				} else if (typeof value == 'boolean') {
					if (value) {
						element.setAttribute(key, '');
					}
				} else {
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

	private addToElement(item: ComponentContent, element: Node) {
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
			element.appendChild(document.createTextNode(`${item}`));
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

	static route(path: string, component: ResolveableRouteGroup) {
		const tree: RouteableRouteGroup = {
			component: this,
			
			children: {
				[path]: component
			},

			route(path: string, component: ResolveableRouteGroup) {
				tree.children[path] = component;

				return tree;
			}
		}

		return tree;
	}

	static default(component: typeof Component) {
		return this.route('', component);
	}
}
