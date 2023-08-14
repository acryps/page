import { Component } from './component';
import { Route } from './route';

export class ConstructedRoute {
	path: RegExp;
	openStartPath: RegExp;
	component: typeof Component;
	parent: ConstructedRoute;
	peers: ConstructedRoute[];
	parameters: string[];
	clientRoute: Route;
	loader?: Promise<any>;

	renderedComponent?: Component;
}