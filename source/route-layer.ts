import { Component } from './component';
import { ConstructedRoute } from './constructed-route';
import { ParameterContainer } from './parameters';
import { Route } from './route';

export class RouteLayer {
	source: ConstructedRoute;
	rendered?: Component;
	parameters: ParameterContainer;
	route: Route;
	placeholder?: Node;
}