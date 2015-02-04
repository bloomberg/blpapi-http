/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import interfaces = require('../interface');

// Internal class that holds the buffer array, a counter for overflow items and maxBufferLength
class Buffer<T> {
    data: T[] = [];
    overflow: number = 0;
    maxBufferLength: number;

    constructor(max: number) {
        this.maxBufferLength = max;
    }

    getBufferedData(): interfaces.IBufferedData<T> {
        return {
            buffer: this.data.slice(),
            overflow: this.overflow
        };
    }
}

export = HistoricalBufferManager;

// This class creates a buffer manager which manage N buffers(N is taken from constructor parameter)
class HistoricalBufferManager<T> {

    // PRIVATE VARIABLES
    private _buffers: Buffer<T>[] = [];
    private _currentIndex: number = 0;
    private _historyDepth: number;
    private _defaultBuffLength: number;

    // maxHistoryDepth: Maximum numbers of preserved buffer history(default value: 1)
    // maxBufferLength: Maximum numbers of data item per level of buffer(default value: 100)
    constructor(maxHistoryDepth: number = 1, maxBufferLength: number = 100) {
        assert(maxHistoryDepth >= 1, 'Invalid maxHistoryDepth parameter ' + maxHistoryDepth);
        assert(maxBufferLength >= 1, 'Invalid maxBufferLength parameter ' + maxBufferLength);
        this._historyDepth = maxHistoryDepth;
        this._defaultBuffLength = maxBufferLength;

        // Initialize buffers
        for (var i = 0; i < this._historyDepth; i++) {
            this._buffers.push(new Buffer<T>(this._defaultBuffLength));
        }
    }

    // Push one data item to the current buffer
    pushValue(data: T): void {
        var currBuffer: Buffer<T> = this._buffers[this._currentIndex];
        if (currBuffer.data.length === currBuffer.maxBufferLength) {
            currBuffer.data.splice(0, 1);
            currBuffer.overflow++;
        }
        currBuffer.data.push(data);
    }

    // Flush the last data array from the history and move the entire history one step forward
    // Subsequent push will be stored into a new array
    // bufferLength: Optional parameter to control the length of the new buffer
    // Return the buffered data of the most recent flushed array
    startNewBuffer(bufferLength: number = this._defaultBuffLength): interfaces.IBufferedData<T> {
        assert(bufferLength >= 1, 'Invalid depth parameter ' + bufferLength);
        var currBuffer: Buffer<T> = this._buffers[this._currentIndex];
        var ret: interfaces.IBufferedData<T> = currBuffer.getBufferedData();
        // Get the new current index
        this._currentIndex = this.getIndex(this._historyDepth - 1);
        currBuffer = this._buffers[this._currentIndex];
        currBuffer.maxBufferLength = bufferLength; // Reset max buffer length
        currBuffer.data.length = 0;  // Clear the current array
        currBuffer.overflow = 0;  // Reset the overflow counter
        return ret;
    }

    // Get buffered data array.
    // depth: This optional parameter controls which level of history will be retrieved
    // depth: Default is to retrieve the current buffer. The first history will be depth 1
    // Return an object containing the data array and an integer for number of overflow items
    getBuffer(depth: number = 0): interfaces.IBufferedData<T> {
        assert(depth >= 0, 'Negative depth parameter ' + depth + ' is invalid');
        assert(depth <= this._historyDepth - 1, 'Depth parameter ' + depth + ' beyond max history');
        var buff: Buffer<T> = this._buffers[this.getIndex(depth)];
        return buff.getBufferedData();
    }

    // Check if the depth level's buffer is empty
    // Return true if it is empty, false if it is not
    isEmpty(depth: number = 0): boolean {
        assert(depth >= 0, 'Negative depth parameter ' + depth + ' is invalid');
        assert(depth <= this._historyDepth - 1, 'Depth parameter ' + depth + ' beyond max history');
        var buff: Buffer<T> = this._buffers[this.getIndex(depth)];
        return buff.data.length === 0;
    }

    private getIndex(depth: number): number {
        return (this._currentIndex + depth) % this._historyDepth;
    }
}
