import { Component } from './component';

export type ResolveableRouteGroup = Routable | (() => Promise<Routable>);

export type RouteGroup = {
	component: typeof Component;
	children?: {
		[key: string]: ResolveableRouteGroup;
	};
};

export type Routable = typeof Component | RouteGroup;

export type RouteableRouteGroup = RouteGroup & {
	route(route: string, component: typeof Component | ResolveableRouteGroup): ResolveableRouteGroup;
};
