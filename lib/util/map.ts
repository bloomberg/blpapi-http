/// <reference path='../../typings/tsd.d.ts' />

import _ = require('lodash');

export = Map;

class Map<T> {
    private _size: number = 0;
    protected _map: {[key: string]: T} = {};

    get size(): number {
        return this._size;
    }

    clear(): void {
        this._size = 0;
        this._map = {};
    }

    set(key: string|number, val: T): void {
        var skey = key.toString();
        if (!_.has(this._map, skey)) {
            ++this._size;
        }
        this._map[skey] = val;
    }

    get(key: string|number): T {
        return this._map[key.toString()];
    }

    has(key: string|number): boolean {
        return _.has(this._map, key.toString());
    }

    delete(key: string|number): void {
        var skey = key.toString();
        if (_.has(this._map, skey)) {
            --this._size;
            delete this._map[skey];
        }
    }

    keys(): string[] {
        return _.map(Object.keys(this._map), (k: string) => {
            return k;
        });
    }

    values(): T[] {
        return _.map(Object.keys(this._map), (k: string) => {
            return this._map[k];
        });
    }

    entries(): any[][] {
        return _.map(Object.keys(this._map), (k: string) => {
            return [k, this._map[k]];
        });
    }

    forEach(callbackFn: (val: T, key?: string, map?: Map<T>) => boolean, thisArg?: any): void {
        _.forOwn(this._map, (val: T, key: string): boolean => {
            return callbackFn.call(thisArg, val, key, this);
        });
    }
}
