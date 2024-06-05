import { Component } from './component';
import { ConstructedRoute } from './constructed-route';
import { ResolveableRouteGroup, RouteableRouteGroup, Routable, RouteGroup, UnresolvedRouteGroup } from './route-group';
import { Route } from './route';
import { RouteLayer } from './route-layer';
import { Render } from './render';
import { ParameterContainer } from './parameters';

export class Router extends EventTarget {
	static parameterNameMatcher = /:[a-zA-Z0-9]+/g;
	static parameterValueMatcher = '([^/]+)';

	declare addEventListener: (type: 'beforeroutechange' | 'routechanged' | 'parameterchanged', callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;

	rootNode: Node;

	onbeforeroutechange = () => {};
	onroutechanged = () => {};
	onparameterchanged = () => {};

	// invokend when an error occurs while loading or rendering a component
	// does not catch unawaited errors
	onerror(error: Error, component?: Component) {
		console.log(`Error occurred in component`, component, error);
	}
	
	// invoken when a route could not be found
	// 
	// blocks further processing of the navigation
	// navigation to an error page is possible using `.navigate`
	onundefinedroute(path: string) {
		throw new Error('Route not found');
	}

	private unresolvedRoutes: Record<string, UnresolvedRouteGroup> = {};
	private constructedRoutes: ConstructedRoute[] = [];

	private renderedStack: RouteLayer[];
	private activeRender: Render;

	private onBeforeRouteChangeEvent: CustomEvent<void> = new CustomEvent('beforeroutechange', {});
	private onRouteChangedEvent: CustomEvent<void> = new CustomEvent('routechanged', {});
	private onParameterChangedEvent: CustomEvent<void> = new CustomEvent('parameterchanged', {});

	constructor(
		public getActivePath: () => string,
		public updateActivePath: (value: string) => void,
		routes: RouteGroup
	) {
		super();
		
		this.importRoutes('', routes);
	}

	navigate(path: string, relative?: Component) {
		this.updateActivePath(this.absolute(path, relative));
		this.update();
	}

	absolute(path: string, relative?: Component) {
		if (!path || path[0] == '/') {
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
	
	// resolves and imports routes if nescessary
	async findRoute(path: string) {
		const existing = this.getRoute(path);
		
		if (existing) {
			return existing;
		}
		
		// resolve any unresolved route that could be the required route
		for (let route in this.unresolvedRoutes) {
			if (path.startsWith(route)) {
				const resolver = this.unresolvedRoutes[route];
				delete this.unresolvedRoutes[route];
				
				const resolved = await resolver();
				
				if (typeof resolved == 'object') {
					this.importRoutes(route, resolved);
				} else {
					this.importRoutes(route, {
						component: resolved,
						children: {}
					});
				}
				
				return await this.findRoute(path);
			}
		}

		return null;
	}
	
	importRoutes(prefix: string, root: RouteGroup) {
		const rootRoute = this.register(prefix, root.component);
		
		for (let path in root.children) {
			const child = root.children[path];
			
			if (typeof child == 'function') {
				const fullPath = prefix + path;
				
				if (`${child}`.match(/^class\s/)) {
					this.register(fullPath, child as typeof Component);
				} else {
					// save the unresolved route for later importing
					this.unresolvedRoutes[fullPath] = child as UnresolvedRouteGroup;
				}
			} else if (typeof child == 'object') {
				// import sub route group
				this.importRoutes(prefix + path, child as RouteGroup);
			}
		}
		
		return rootRoute;
	}

	// only searches in already loaded routes / zones
	getRoute(path: string) {
		for (let route of this.constructedRoutes) {
			// skip routes that have a default child
			if (!route.defaultsTo) {
				if (route.path.test(path)) {
					return route;
				}
			}
		}

		return null;
	}

	getActiveRoute() {
		return this.getRoute(this.getActivePath());
	}

	getActiveParameters(path: string, activeRoute: ConstructedRoute) {
		const parameterStack: ParameterContainer[] = [];
		let route = activeRoute;

		while (route) {
			parameterStack.unshift(this.getRouteParameters(
				route, 
				activeRoute.peers.indexOf(route),
				path.match(route.suffix).slice(1)
			));

			path = path.replace(route.suffix, '');
			route = route.parent;
		}

		return parameterStack;
	}

	getRouteParameters(route: ConstructedRoute, layerIndex: number, initialValues: string[]): ParameterContainer {
		const parameters = {};

		for (let index = 0; index < route.parameters.length; index++) {
			parameters[route.parameters[index]] = initialValues[index];
		}

		let renderedLayer: RouteLayer;

		// proxy the parameters object to receive changes when users set values
		return {
			set renderedLayer(layer) {
				renderedLayer = layer;
			},
			
			client: new Proxy<any>(parameters, {
				set: (object, property, value) => {
					// don't update if the value is already set
					if (object[property] === value) {
						return true;
					}

					object[property] = value;

					requestAnimationFrame(() => {
						// quit if the value was overwritten since we set it above
						if (object[property] !== value) {
							return;
						}

						// abort if the update targets a disposed component
						if (renderedLayer.rendered != this.renderedStack[layerIndex]?.rendered) {
							return;
						}

						// regenerate our routes parameter string
						let path = route.clientRoute.matchingPath;
						
						for (let key in object) {
							path = path.replace(`:${key}`, object[key]);
						}

						renderedLayer.route.path = path;

						this.updateActivePath(this.renderedStack[this.renderedStack.length - 1].route.fullPath);
						this.dispatchEvent(this.onParameterChangedEvent);
						this.onparameterchanged();
					});

					return true;
				}
			})
		};
	}

	async update() {
		this.dispatchEvent(this.onBeforeRouteChangeEvent);
		this.onbeforeroutechange();

		// abort the current renderer if there is a render in progress
		// the renderer returns a list of completed layers in the routing stack, which can be used as the base for this new render
		if (this.activeRender) {
			this.renderedStack = this.activeRender.abort();
		}

		const renderer = this.activeRender = new Render(this, this.renderedStack, await this.buildRouteStack());

		// this method might take some time as it will load all the components (`onload`)
		await this.activeRender.render();

		if (renderer == this.activeRender) {
			// overwrite the currently active stack and reset the renderer
			this.renderedStack = this.activeRender.stack;
			this.activeRender = null;

			this.dispatchEvent(this.onRouteChangedEvent);
			this.onroutechanged();
		}
	}

	async buildRouteStack(source = this.renderedStack) {
		const path = this.getActivePath();
		const route = await this.findRoute(path);
		const parameters = this.getActiveParameters(path, route);
		
		if (!route) {
			this.onundefinedroute(path);
			
			return;
		}
		
		const stack: RouteLayer[] = [];

		// will be true once one layer has not been found in the source stack
		// prevents parents swapping from reusing the same client route
		let changed = false;

		for (let layerIndex = 0; layerIndex < route.peers.length; layerIndex++) {
			let path = route.peers[layerIndex].matchingPath;
			
			// insert the active parameters into the client routes path
			for (let key in parameters[layerIndex].client) {
				path = path.replace(`:${key}`, parameters[layerIndex].client[key]);
			}

			let clientRoute: Route;
			
			// try to reuse an existing route
			if (!changed && source && source[layerIndex] && source[layerIndex].route.path == path) {
				clientRoute = source[layerIndex].route;
			} else {
				clientRoute = new Route();
				clientRoute.matchingPath = route.peers[layerIndex].matchingPath;
				clientRoute.parent = stack[layerIndex - 1]?.route;
				clientRoute.component = route.peers[layerIndex].component;
				clientRoute.path = path;

				changed = true;
			}

			// children might have changed even if the current route can be reused
			clientRoute.child = route.peers[layerIndex + 1]?.clientRoute;

			stack.push({
				parameters: parameters[layerIndex],
				route: clientRoute,
				source: route.peers[layerIndex]
			});
		}

		return stack;
	}
	
	private register(path: string, destination: typeof Component) {
		const parents = this.constructedRoutes.filter(route => !route.defaultingParent && route.prefix.test(path));
		const parent = parents.at(-1);
		
		const matchingPath = path.replace(parent?.fullPath, '');

		const constructedRoute = new ConstructedRoute(
			path,
			matchingPath,
			destination,
			parents
		);

		// registering a default route places a route with no extra name into the child list
		// routes with defaultsTo will be ignored when finding routes
		// routes with defaultingParent will be ignored when building the peer stack
		// 
		// PageComponent
		// 	.default(HomeComponent)
		//  .route('/a', AComponent)
		// 
		// -> 
		// 
		// '/' = PageComponent [defaultsTo = HomeComponent]
		// '/' = HomeComponent [defaultingParent = PageComponent]
		// '/a' = AComponent
		const defaultingParent = this.constructedRoutes.find(route => `${route.path}` == `${constructedRoute.path}`);

		if (defaultingParent) {
			defaultingParent.defaultsTo = constructedRoute;
			constructedRoute.defaultingParent = defaultingParent;
		}
		
		this.constructedRoutes.push(constructedRoute);
		
		return constructedRoute;
	}

	host(root: Node) {
		this.rootNode = root;

		this.update();
	}

	preventChildPropagation(children = 0) {
		this.activeRender?.abort(1 + children);
	}
}

export class PathRouter extends Router {
	constructor(
		routes: RouteGroup
	) {
		super(() => location.pathname.replace(/^\/$/, ''), value => history.pushState(null, null, value || '/'), routes);

		onpopstate = () => {
			this.update();
		}
	}
}

export class HashRouter extends Router {
	constructor(
		routes: RouteGroup
	) {
		super(() => location.hash.replace('#', ''), value => history.pushState(null, null, `#${value}`), routes);

		onhashchange = () => {
			this.update();
		}
	}
}
