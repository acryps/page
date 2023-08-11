import { Component } from './component';
import { ConstructedRoute } from './constructed-route';
import { Route } from './route';

export class RouteLayer {
	source: ConstructedRoute;
	rendered?: Component;
	parameters: any;
	route: Route;
	placeholder?: Node;
}