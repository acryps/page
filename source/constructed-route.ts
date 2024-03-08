import { Component } from './component';
import { Route } from './route';
import { Router } from './router';

export class ConstructedRoute {
	loader?: Promise<any>;
	renderedComponent?: Component;
	
	path: RegExp;
	prefix: RegExp;
	suffix: RegExp;
	
	parent: ConstructedRoute;
	
	parameters: string[];
	
	peers: ConstructedRoute[];
	
	// defaultsTo redirects a request to the given route
	defaultsTo?: ConstructedRoute;
	
	// defaultedBy points back to the parent
	defaultingParent?: ConstructedRoute;
	
	clientRoute = new Route();
	
	constructor(
		path: string,
		public matchingPath: string,
		public component: typeof Component,
		parents: ConstructedRoute[]
	) {
		const search = this.createParameterMatcher(path);
		this.path = new RegExp(`^${search}$`),
		this.prefix = new RegExp(`^${search}`),
		
		this.suffix = new RegExp(`${this.createParameterMatcher(matchingPath)}$`),
		
		this.parent = parents.at(-1);
		this.peers = [...parents, this];
		
		this.clientRoute.matchingPath = matchingPath;
		this.clientRoute.parent = this.parent?.clientRoute;
		this.clientRoute.component = component;
		
		this.parameters = matchingPath.match(Router.parameterNameMatcher)?.map(key => key.replace(':', '')) ?? [];
	}
	
	get fullPath() {
		if (this.parent) {
			return `${this.parent.fullPath}${this.matchingPath}`;
		}
		
		return this.matchingPath;
	}
	
	private createParameterMatcher(path: string) {
		return path.split('/').join('\\/').replace(Router.parameterNameMatcher, Router.parameterValueMatcher);
	}
}
