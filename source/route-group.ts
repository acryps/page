import { Component } from './component';

export type UnresolvedRouteGroup = () => Promise<Routable>;

export type ResolveableRouteGroup = Routable | UnresolvedRouteGroup;

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
