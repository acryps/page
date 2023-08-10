import { Component } from './component';
import { Route } from './route';

export class RouteLayer {
	component: typeof Component;
	rendered?: Component;
	parameters: any;
	route: Route;
	placeholder?: Node;
}