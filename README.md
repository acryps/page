[![npm version](http://badge.acryps.com/npm/vldom)](http://badge.acryps.com/go/npm/vldom)

<img src="logo.svg" height="50">

# vldom TypeScript Frontend Component System

Simple component system with integrated routing.

> version 9: new engine, even more efficient

## Setup
You"ll need to enable jsx in your tsconfig
<pre>{
	"compileOnSave": false,
	"compilerOptions": {
		<b>"jsx": "react",
		"jsxFactory": "this.createElement",</b>
		....
	}
}</pre>

Compile your client with `tsc` and `vldom compile`!
```
tsc && vldom compile
```

## Usage
Create a component by extending the component class

```
export class ExampleComponent extends Component {
	constructor() {
		super();
	}

	render() {
		return <section>
			Example Component!
		</section>;
	}
}

new ExampleComponent().host(document.body);
```

Let"s extends this by creating a recursive component

```
export class ExampleRecursiveComponent extends Component {
	constructor(private index: number) {
		super();
	}

	render() {
		return <section>
			Component {this.index}

			{index > 0 && new ExampleRecursiveComponent(index - 1)}
		</section>;
	}
}

new ExampleRecursiveComponent(10).host(document.body);
```

## Router
vldom has a built-in router
```
const router = new Router(PageComponent
	.route("/home", HomeComponent),
	.route("/books", BooksComponent
		.route("/:id", BookComponent)
	)
);

class PageComponent extends Component {
	render(child) {
		return <main>
			<nav>App</nav>

			{child}
		</main>;
	}
}

class HomeComponent extends Component {
	render() {
		return <p>Welcome to my Book Store</p>;
	}
}

class BooksComponent extends Component {
	render() {
		return <section>
			<h1>Books!</h1>

			<button ui-href="someid">Some Book!</button>
		</section>;
	}
}

class BookComponent extends Component {
	parameters: { id: string }

	render() {
		return <p>Book with id {this.parameters.id}</p>;
	}
}

router.host(document.body);

onhashchange = () => router.update();
```

## Directives
You can create custom directives (attribute handlers).

```
Component.directives["epic-link"] = (element, value, tag, attributes, content) => {
	element.onclick = () => {
		location.href = value;
	}
}

export class ExampleComponent extends Component {
	constructor() {
		super();
	}

	render() {
		return <section>
			Test <a epic-link="http://github.com/">Link</a>
		</section>;
	}
}

new ExampleComponent().host(document.body);
```