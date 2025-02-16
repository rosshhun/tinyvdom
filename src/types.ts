'use strict'

export interface PropType {
    [key: string]: any;
}

export interface VNode {
    type: string;
    props?: PropType;
    children: Array<VNode | string>;
}