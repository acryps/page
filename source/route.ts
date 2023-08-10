import { Component } from './component';

export class Route {
	path: string;
	matchingPath: string;
	parent?: Route;
	child?: Route;
	component: typeof Component;
	
	get fullPath() {
		return this.parent ? `${this.parent.fullPath}${this.path}` : this.path;
	}
}