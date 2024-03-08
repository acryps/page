import { Component } from './component';
import { RouteLayer } from './route-layer';
import { Router } from './router';

export class Render {
	detached = false;
	stackLength: true | number = true;

	layerIndex = 0;

	constructor(
		private router: Router,
		private renderedStack: RouteLayer[],
		public stack: RouteLayer[]
	) {}

	abort(stackLength = 0) {
		// will prevent returning `onload`s from continuing to render
		this.stackLength = stackLength;

		// set the finished renderers as the rendered stack
		// -1 because the current element is not rendered yet
		return this.stack.slice(0, this.layerIndex);
	}

	async render() {
		// loop thur all layers from the new routing stack
		// the `detached` flat is set once a layer changed
		// all following layers will be reloaded
		for (; this.layerIndex < this.stack.length; this.layerIndex++) {
			const layer = this.stack[this.layerIndex];
			const child = this.stack[this.layerIndex + 1];

			const existing = this.renderedStack && this.renderedStack[this.layerIndex];

			if (!this.detached && layer.route.path == existing?.route.path) {
				// nothing has to be changed about the current layer
				// `.update()` might be called if this layers child changed
				layer.rendered = existing.rendered;

				// check if the layers child from the rendered stack was removed
				if (this.renderedStack[this.layerIndex + 1] && !child) {
					// unload the now stale container
					const staleLayer = this.renderedStack[this.layerIndex + 1];
					this.unloadRoute(staleLayer.rendered);

					// re render layer and set its child to null
					layer.rendered.child = null;
					layer.rendered.update(null);
				}
			} else {
				let layerError;

				if (!this.stackLength) {
					return;
				}

				// route changed, renewed or any of its parents changed
				const parent = this.stack[this.layerIndex - 1];

				// create new component - if the component was not already created by parent (to create the placeholder)
				if (!layer.rendered) {
					layer.rendered = new layer.source.component();
					layer.rendered.route = layer.route;
					layer.rendered.parent = parent?.rendered;
					layer.rendered.router = this.router;

					layer.rendered.parameters = layer.parameters.client;
					layer.parameters.renderedLayer = layer;

					if (parent) {
						parent.rendered.child = layer.rendered;
					}
				}

				// destroy existing component
				if (existing) {
					this.unloadRoute(existing.rendered);
				}

				// create placeholder and update parent if the parent was unchanged
				if (!layer.placeholder) {
					layer.placeholder = layer.rendered.renderLoader();

					parent?.rendered.update(layer.placeholder);
				}

				// try to load the component, if it failed, render error and abort (later on)
				try {
					await layer.rendered.onload();
				} catch (error) {
					layerError = error;
				}

				// the data loaded by `onload` should be ignored and the whole render should be stopped when `abort` was called
				if (this.stackLength !== true) {
					// decrease the length by one
					// the render will abort when this reaches 0
					//
					// example: stack length 2
					// component A: renders & loads, stack 2 → 1
					// component B: renders & loads, stack 1 → 0
					// component C: does not render or load
					this.stackLength--;
				}

				// create placeholder for child
				if (child && !layerError) {
					// already create child, as the loader is rendered on the instance itself
					child.rendered = new child.source.component();
					child.rendered.route = child.route;
					child.rendered.parent = layer.rendered;
					child.rendered.router = this.router;

					child.rendered.parameters = child.parameters.client;
					child.parameters.renderedLayer = child;

					layer.rendered.child = child.rendered;

					// create the placeholder
					// will be a HTML comment by default, but a component might implement a custom loader element
					child.placeholder = child.rendered.renderLoader();
				}

				// render new component, pass child placeholder as child node (if present)
				// if the render fails or failed before, retry rendering using `renderError` - and still add it as a child
				if (layerError) {
					layer.rendered.onerror(layerError);
					layer.rendered.rootNode = layer.rendered.renderError(layerError);
				} else {
					try {
						layer.rendered.rootNode = layer.rendered.render(child?.placeholder);
					} catch (error) {
						layerError = error;

						layer.rendered.renderError(error);
						layer.rendered.rootNode = layer.rendered.renderError(error);
					}

					// set child node on first render
					if (layer.rendered.parent) {
						layer.rendered.parent.childNode = layer.rendered.rootNode;
					}
				}

				if (this.layerIndex) {
					// if not a root child, replace this layers placeholder with the new node
					layer.placeholder.parentNode.replaceChild(layer.rendered.rootNode, layer.placeholder);
				} else if (existing) {
					// replace the current root node with the new root node
					this.router.rootNode.replaceChild(existing.rendered.rootNode, layer.rendered.rootNode);
				} else {
					// there is no existing root node - append this new root node
					this.router.rootNode.appendChild(layer.rendered.rootNode);
				}

				// if the render or load failed
				if (layerError) {
					layer.rendered.router.onerror(layerError, layer.rendered);

					return;
				}

				// execute on child change
				parent?.rendered.onchildchange(layer.parameters.client, layer.route, layer.rendered);

				// will mark any following components as dirty -> they will be re-created
				this.detached = true;
			}
		}
	}

	private async unloadRoute(component: Component) {
		if (!component.loaded) {
			return;
		}

		component.loaded = false;
		await component.onrouteleave();
	}
}
