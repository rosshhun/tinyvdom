'use strict'

import { PropType, VNode } from "./types";

export function h(
    type: string,
    props?: PropType,
    ...children: Array<VNode | string>
): VNode {
    const flatChildren = children.flat(Infinity).filter(child => child != null);
    return {
        type,
        props,
        children: flatChildren,
    };
}

export function render(vnode: VNode): Node {
    const el = document.createElement(vnode.type);

    if (vnode.props) {
        for (const [key, value] of Object.entries(vnode.props)) {
            if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        }
    }

    if (vnode.children) {
        vnode.children.forEach((child) => {
            let ChildEl: Node | null = null;
            if (typeof child === 'string') {
                ChildEl = document.createTextNode(child);
            } else {
                ChildEl = render(child);
            }
            el.appendChild(ChildEl);
        });
    }

    return el;
}

export function mount(vnode: VNode, container: string) {
    const root = document.getElementById(container);
    if (!root) {
        throw new Error(`cannot find ID: ${container}`);
    }
    root.appendChild(render(vnode));
}

export function patch(parent: Node, newNode: VNode, oldNode: VNode, index: number = 0) {
    const currentEl = parent.childNodes[index];

    if (!oldNode) {
        parent.appendChild(render(newNode));
        return;
    }

    if (!newNode) {
        parent.removeChild(currentEl);
        return;
    }

    if (newNode.type != oldNode.type) {
        parent.replaceChild(render(newNode), currentEl);
        return;
    }

    updateProps(currentEl as HTMLElement, newNode.props, oldNode.props);

    const newChildren = newNode.children || [];
    const oldChildren = oldNode.children || [];
    const max = Math.max(newChildren.length, oldChildren.length);

    for (let i = 0; i < max; i++) {
        if (typeof newChildren[i] === 'string' || typeof oldChildren[i] === 'string') {
            if (newChildren[i] != oldChildren[i]) {
                currentEl.replaceChild(
                    typeof newChildren[i] === 'string'
                        ? document.createTextNode(newChildren[i] as string)
                        : render(newChildren[i] as VNode),
                    currentEl.childNodes[i]
                );
            }
        } else {
            patch(currentEl, newChildren[i] as VNode, oldChildren[i] as VNode, i);
        }
    }

}

export function updateProps(el: HTMLElement, newProps: PropType = {}, oldProps: PropType = {}) {

    for (const key in newProps) {
        if (newProps[key] != oldProps[key]) {
            if (key.startsWith("on") && typeof newProps[key] === 'function') {
                if (oldProps[key]) {
                    el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
                }
                el.addEventListener(key.slice(2).toLowerCase(), newProps[key]);
            } else {
                el.setAttribute(key, newProps[key]);
            }
        }
    }

    // remove old Props
    for (const key in oldProps) {
        if (!(key in newProps)) {
            if (key.startsWith("on") && typeof oldProps[key] === 'function') {
                el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
            } else {
                el.removeAttribute(key);
            }
        }
    }
}

export let activeEffect: Function | null = null;
export const typeDependencyMap: WeakMap<object, Map<string | symbol, Set<Function>>> = new WeakMap<object, Map<string | symbol, Set<Function>>>();

export function effect(fn: Function) {
    const effectFn = () => {
        activeEffect = effectFn;
        fn();
        activeEffect = null;
    }
    effectFn();
}

export function track(target: object, key: string | symbol): void {

    if (!activeEffect) {
        return;
    }

    let depMap = typeDependencyMap.get(target);

    if (!depMap) {
        depMap = new Map();
        typeDependencyMap.set(target, depMap);
    }

    let depSet = depMap.get(key);
    if (!depSet) {
        depSet = new Set();
        depMap.set(key, depSet);
    }

    depSet.add(activeEffect);
}

export function trigger(target: object, key: string | symbol): void {
    let depMap = typeDependencyMap.get(target);
    if (!depMap) {
        return;
    }
    const effect = depMap.get(key);
    if (effect) {
        effect.forEach((effectFn) => {
            effectFn();
        });
    }
}

export function reactive<T extends object>(target: T): T {
    return new Proxy(target, {
        get(target, key, receiver) {
            track(target, key);
            return Reflect.get(target, key, receiver);
        },
        set(target, key, value, receiver) {
            let result = Reflect.set(target, key, value, receiver);
            if (result) {
                trigger(target, key);
            }
            return result;
        }
    });
}



// test

// Define a Todo type
type Todo = {
    id: number;
    text: string;
    done: boolean;
};

// Reactive state that holds our todos, the new todo text, and the current filter
const state = reactive({
    todos: [] as Todo[],
    newTodo: '',
    filter: 'all' as 'all' | 'active' | 'completed'
});

// --- Action Functions ---

// Adds a new todo if the input is not empty
function addTodo() {
    const text = state.newTodo.trim();
    if (text.length > 0) {
        state.todos.push({ id: Date.now(), text, done: false });
        state.newTodo = '';
    }
}

// Toggle the completion status of a todo
function toggleTodo(id: number) {
    const todo = state.todos.find(todo => todo.id === id);
    if (todo) {
        todo.done = !todo.done;
    }
}

// Delete a todo by filtering it out of the todos array
function deleteTodo(id: number) {
    state.todos = state.todos.filter(todo => todo.id !== id);
}

// Update the filter state
function setFilter(filter: 'all' | 'active' | 'completed') {
    state.filter = filter;
}

// Return the list of todos based on the current filter
function filteredTodos() {
    switch (state.filter) {
        case 'active':
            return state.todos.filter(todo => !todo.done);
        case 'completed':
            return state.todos.filter(todo => todo.done);
        default:
            return state.todos;
    }
}

// --- Virtual DOM App ---

// The App function builds our Virtual DOM tree using your framework's `h` function.
function App() {
    return h('div', { id: 'todo-app' },
        h('h1', {}, 'Reactive Todo List'),
        h('div', { class: 'input-section' },
            h('input', {
                type: 'text',
                placeholder: 'Enter a new todo',
                value: state.newTodo,
                onInput: (e: Event) => {
                    const input = e.target as HTMLInputElement;
                    state.newTodo = input.value;
                }
            }),
            h('button', { onClick: addTodo }, 'Add Todo')
        ),
        h('div', { class: 'filters' },
            h('button', { onClick: () => setFilter('all') }, 'All'),
            h('button', { onClick: () => setFilter('active') }, 'Active'),
            h('button', { onClick: () => setFilter('completed') }, 'Completed')
        ),
        h('ul', { class: 'todo-list' },
            // Spread the mapped array of todo items into the children array.
            ...filteredTodos().map(todo =>
                h('li', { key: todo.id },
                    h('span', {
                        style: `text-decoration: ${todo.done ? 'line-through' : 'none'}; cursor: pointer;`,
                        onClick: () => toggleTodo(todo.id)
                    }, todo.text),
                    h('button', { onClick: () => deleteTodo(todo.id) }, 'Delete')
                )
            )
        ),
        h('div', { class: 'summary' },
            h('p', {}, `Total todos: ${state.todos.length}`),
            h('p', {}, `Active todos: ${state.todos.filter(todo => !todo.done).length}`)
        )
    );
}

// --- Mounting and Reactivity Setup ---

// Generate the initial Virtual DOM tree.
let oldVNode = App();

// Wait for the DOM to be ready before mounting.
document.addEventListener('DOMContentLoaded', () => {
    // Mount the initial tree to the element with id 'root'
    mount(oldVNode, 'root');

    // Set up a reactive effect: every time state changes, the effect re-renders the App.
    effect(() => {
        const newVNode = App();
        patch(document.getElementById('root')!, newVNode, oldVNode);
        oldVNode = newVNode;
    });
});