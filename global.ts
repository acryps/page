import { Component } from './component';

declare global {
	interface Node {
		hostingComponent: Component;
	}
}