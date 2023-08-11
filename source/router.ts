import { Component } from './component';
import { ConstructedRoute } from './constructed-route';
import { RouteableRouteGroup, RouteGroup } from './route-group';
import { Route } from './route';
import { RouteLayer } from './route-layer';
import { Render } from './render';

export class Router extends EventTarget {
	static global: Router;
	
	static parameterNameMatcher = /:[a-zA-Z0-9]+/g;
	static parameterMatcher = '([^/]+)';

	declare addEventListener: (type: 'routechange' | 'parameterchange', callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;

	rootNode: Node;

	onRouteChange = () => {};
	onParameterChange = () => {};

	onerror(error: Error, component?: Component) {
		console.log(`Error occurred in component`, component, error);
	}

	private constructedRoutes: ConstructedRoute[] = [];

	private root: typeof Component;
	private routes: { [ key: string ]: RouteGroup; };

	private renderedStack: RouteLayer[];
	private activeRender: Render;

	private onRouteChangeEvent: CustomEvent<void> = new CustomEvent('routechange', {});
	private onParameterChangeEvent: CustomEvent<void> = new CustomEvent('parameterchange', {});

	constructor(
		public getActivePath: () => string,
		public updateActivePath: (value: string) => void,
		root: RouteableRouteGroup | typeof Component,
		routes?: { [ key: string ]: RouteGroup; }
	) {
		super();

		if (routes) {
			this.root = root as typeof Component;
			this.routes = routes;
		} else {
			if (typeof root == 'function') {
				this.root = root;
			} else {
				this.root = root.component;
				this.routes = root.children;
			}
		}
	}

	navigate(path: string, relative?: Component) {
		this.updateActivePath(this.absolute(path, relative));
		this.update();
	}

	absolute(path: string, relative?: Component) {
		if (path[0] == '/') {
			return path;
		} else if (relative) {
			return this.resolve(`${relative.route.fullPath}/${path}`);
		} else {
			return this.resolve(`${this.getActivePath()}/${path}`);
		}
	}

	resolve(path: string) {
		const resolved = [];

		for (let component of path.split('/')) {
			if (component && component != '.') {
				if (component == '..') {
					resolved.pop();
				} else {
					resolved.push(component);
				}
			}
		}

		return `/${resolved.join('/')}`;
	}

	getRoute(path: string) {
		for (let route of this.constructedRoutes) {
			if (route.path.test(path)) {
				return route;
			}
		}

		return null;
	}

	getActiveRoute() {
		return this.getRoute(this.getActivePath());
	}

	getActiveParameters(path: string, activeRoute: ConstructedRoute) {
		const parameterStack: Record<string, string>[] = [];
		let route = activeRoute;

		while (route) {
			parameterStack.unshift(this.getRouteParameters(
				route, 
				activeRoute.parents.indexOf(route),
				path.match(route.openStartPath).slice(1)
			));

			path = path.replace(route.openStartPath, '');
			route = route.parent;
		}

		return parameterStack;
	}

	getRouteParameters(route: ConstructedRoute, layerIndex: number, initialValues: string[]) {
		const parameters = {};

		for (let i = 0; i < route.parameters.length; i++) {
			parameters[route.parameters[i]] = initialValues[i];
		}

		let renderedComponent: RouteLayer;

		requestAnimationFrame(() => {
			renderedComponent = this.renderedStack[layerIndex];
		});

		// proxy the parameters object to receive changes when users set values
		return new Proxy<any>(parameters, {
			set: (object, property, value) => {
				// don't update if the value is already set
				if (object[property] === value) {
					return;
				}

				object[property] = value;

				requestAnimationFrame(() => {
					// quit if the value was overwritten since we set it above
					if (object[property] !== value) {
						return;
					}

					// abort if the update targets a disposed component
					if (renderedComponent.rendered != this.renderedStack[layerIndex]?.rendered) {
						return true;
					}

					// regenerate our routes parameter string
					let path = route.clientRoute.matchingPath;
					
					for (let key in object) {
						path = path.replace(`:${key}`, object[key]);
					}

					renderedComponent.route.path = path;

					this.updateActivePath(this.renderedStack[this.renderedStack.length - 1].route.fullPath);
					this.dispatchEvent(this.onParameterChangeEvent);
					this.onParameterChange();
				});

				return true;
			}
		});
	}

	async update() {
		// abort the current renderer if there is a render in progress
		// the renderer returns a list of completed layers in the routing stack, which can be used as the base for this new render
		if (this.activeRender) {
			this.renderedStack = this.activeRender.abort();
		}

		this.activeRender = new Render(this, this.renderedStack, this.buildRouteStack());

		// this method might take some time as it will load all the components (`onload`)
		await this.activeRender.render();

		// overwrite the currently active stack and reset the renderer
		this.renderedStack = this.activeRender.stack;
		this.activeRender = null;

		this.dispatchEvent(this.onRouteChangeEvent);
		this.onRouteChange();
	}

	buildRouteStack() {
		const path = this.getActivePath();
		const route = this.getRoute(path);
		const parameters = this.getActiveParameters(path, route);

		const stack: RouteLayer[] = [];

		for (let layerIndex = 0; layerIndex < route.parents.length; layerIndex++) {
			// clone the routes original client route
			const clientRoute = new Route();
			clientRoute.path = clientRoute.matchingPath = route.parents[layerIndex].clientRoute.matchingPath;
			clientRoute.child = route.parents[layerIndex + 1]?.clientRoute;
			clientRoute.parent = stack[layerIndex - 1]?.route;
			clientRoute.component = route.parents[layerIndex].component;

			// insert the active parameters into the client routes path
			for (let key in parameters[layerIndex]) {
				clientRoute.path = clientRoute.path.replace(`:${key}`, parameters[layerIndex][key]);
			}

			stack.push({
				parameters: parameters[layerIndex],
				route: clientRoute,
				source: route.parents[layerIndex]
			});
		}

		return stack;
	}

	constructRoutes(root, routes = this.routes, parent: ConstructedRoute = null) {
		for (let path in routes) {
			const route = routes[path];

			const constructedRoute = {
				path: new RegExp(`^${`${root}${path}`.split('/').join('\\/').replace(Router.parameterNameMatcher, Router.parameterMatcher)}$`),
				openStartPath: new RegExp(`${`${path}`.split('/').join('\\/').replace(Router.parameterNameMatcher, Router.parameterMatcher)}$`),
				component: typeof route == 'function' ? route : (route as any).component,
				parent: parent,
				parameters: (path.match(Router.parameterNameMatcher) || []).map(key => key.replace(':', '')),
				parents: [],
				clientRoute: new Route()
			}

			constructedRoute.clientRoute.matchingPath = path;
			constructedRoute.clientRoute.parent = parent && parent.clientRoute;
			constructedRoute.clientRoute.component = constructedRoute.component;

			this.constructedRoutes.push(constructedRoute);

			if (!(typeof route == 'function') && (route as any).children) {
				this.constructRoutes(`${root}${path}`, (route as any).children, constructedRoute);
			}
		}

		if (routes == this.routes) {
			for (let route of this.constructedRoutes) {
				let item = route;

				while (item) {
					route.parents.unshift(item);

					item = item.parent;
				}
			}
		}
	}

	host(root: Node) {
		Router.global = this;

		this.routes = {
			'': {
				component: this.root,
				children: this.routes
			}
		};
		
		this.constructRoutes('');
		this.rootNode = root;

		this.update();
	}
}

export class PathRouter extends Router {
	constructor(
		root: RouteableRouteGroup | typeof Component,
		routes?: { [ key: string ]: RouteGroup; }
	) {
		super(() => location.pathname, value => history.pushState(null, null, value), root, routes);

		onpopstate = () => {
			this.update();
		}
	}
}

export class HashRouter extends Router {
	constructor(
		root: RouteableRouteGroup | typeof Component,
		routes?: { [ key: string ]: RouteGroup; }
	) {
		super(() => location.hash.replace('#', ''), value => history.pushState(null, null, `#${value}`), root, routes);

		onhashchange = () => {
			this.update();
		}
	}
}
