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
