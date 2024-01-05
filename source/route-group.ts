import { Component } from './component';

export type RouteGroup = typeof Component | {
	component: typeof Component;
	children?: {
		[key: string]: RouteGroup;
	};
};

export type RouteableRouteGroup = {
	component: typeof Component;
	children: {
		[key: string]: RouteGroup;
	};

	route(route: string, component: typeof Component | RouteableRouteGroup): RouteableRouteGroup;
}