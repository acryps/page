[![npm version](https://badge.acryps.com/npm/@acryps%2Fpage)](http://badge.acryps.com/go/npm/@acryps%2Fpage)

# @acryps/page TypeScript Frontend Component System

Simple component system with integrated routing.

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

Compile your client with `tsc` and `page compile`!
```
tsc && page compile
```

## Usage
Create a component by extending the component class

``` tsx
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

``` tsx
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
page has a built-in router
``` tsx
const router = new PathRouter(PageComponent
	.route("/home", HomeComponent),
	.route("/books", BooksComponent
		.default(BookOverviewComponent)
		.route("/:id", BookDetailComponent)
	)
	
	// will only be resolved and thus loaded when users access the /admin route
	// → your builder can do code splitting!
	.route("/admin", () => import("./admin").then(module => module.default))
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
	render(child) {
		return <section>
			<h1>Books!</h1>

			{child}
		</section>;
	}
}

class BookOverviewComponent extends Component {
	render() {
		return <ui-book-overview>
			<button ui-href="someid">Some book!</button>
			<button ui-href="someid">Some other book!</button>
			<button ui-href="someid">Another book!</button>
		</ui-book-overview>;
	}
}

class BookDetailComponent extends Component {
	parameters: { id: string }

	render() {
		return <p>Book with id {this.parameters.id}</p>;
	}
}

router.host(document.body);
```

## Directives
You can create custom directives (attribute handlers).

``` ts
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
