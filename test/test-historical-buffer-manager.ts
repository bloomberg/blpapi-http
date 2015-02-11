/// <reference path='../typings/tsd.d.ts' />

import should = require('should');
import HistoricalBufferManager = require('../lib/util/historical-buffer-manager');
import interfaces = require('../lib/interface');
should(true).ok;    // Added so ts won't get rid of should module

describe('HistoricalBufferManager', (): void => {
    var bufferManager: HistoricalBufferManager<number>;
    describe('Construct', (): void => {
        it('should construct without parameter', (): void => {
            ((): void => {
                bufferManager = new HistoricalBufferManager<number>();
            }).should.not.throw();
        });
        it('should construct with valid parameters', (): void => {
            ((): void => {
                bufferManager = new HistoricalBufferManager<number>(1, 3);
            }).should.not.throw();
        });
        it('should throw if construct with invalid parameters', (): void => {
            ((): void => {
                bufferManager = new HistoricalBufferManager<number>(0, 3);
            }).should.throw();
            ((): void => {
                bufferManager = new HistoricalBufferManager<number>(1, 0);
            }).should.throw();
        });
    });

    describe('OneLevelHistory', (): void => {
        beforeEach((): void => {
            bufferManager = new HistoricalBufferManager<number>(1, 3);
        });

        describe('#pushValue()', (): void => {
            it('should push value without error', (): void => {
                bufferManager.pushValue.bind(bufferManager, 1).should.not.throw();
                bufferManager.pushValue.bind(bufferManager, 2).should.not.throw();
                bufferManager.pushValue.bind(bufferManager, 3).should.not.throw();
                bufferManager.pushValue.bind(bufferManager, 4).should.not.throw();
            });
        });

        describe('#startNewBuffer()', (): void => {
            it('should start a new buffer and return the flushed data', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.startNewBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([1, 2, 3]);
                buff = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(0);
                buff.buffer.should.eql([]);
                bufferManager.startNewBuffer();
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                buff = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(2);
                buff.buffer.should.eql([1, 2]);
            });
            it('should start a new buffer with the default buffer length', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.startNewBuffer();
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.pushValue(4);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([2, 3, 4]);
            });
            it('should start a new buffer with the input buffer length', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.startNewBuffer(2);
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(2);
                buff.buffer.should.eql([2, 3]);
            });
            it('should throw if input buffer length is invalid', (): void => {
                bufferManager.startNewBuffer.bind(bufferManager, -1).should.throw();
                bufferManager.startNewBuffer.bind(bufferManager, 0).should.throw();
            });
        });

        describe('#getBuffer()', (): void => {
            it('should get buffer equals to what just pushed in', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([1, 2, 3]);
            });
            it('should get the same buffer twice', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([1, 2, 3]);
            });
            it('should handle buffer overflow correctly', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.pushValue(4);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([2, 3, 4]);
            });
            it('should throw if invalid depth parameter passed in', (): void => {
                bufferManager.getBuffer.bind(bufferManager, 1).should.throw();
                bufferManager.getBuffer.bind(bufferManager, 2).should.throw();
                bufferManager.getBuffer.bind(bufferManager, -1).should.throw();
                bufferManager.getBuffer.bind(bufferManager, 0).should.not.throw();
            });
        });

        describe('#isEmpty()', (): void => {
            it('should return true if buffer is empty', (): void => {
                bufferManager.isEmpty().should.be.a.Boolean.and.be.true;
            });
            it('should return false if buffer is not empty', (): void => {
                bufferManager.pushValue(1);
                bufferManager.isEmpty().should.be.a.Boolean.and.be.not.true;
            });
            it('should throw if invalid depth parameter passed in', (): void => {
                bufferManager.isEmpty.bind(bufferManager, 1).should.throw();
                bufferManager.isEmpty.bind(bufferManager, 2).should.throw();
                bufferManager.isEmpty.bind(bufferManager, -1).should.throw();
                bufferManager.isEmpty.bind(bufferManager, 0).should.not.throw();
            });
        });
    });

    describe('TwoLevelHistory', (): void => {
        beforeEach((): void => {
            bufferManager = new HistoricalBufferManager<number>(2, 3);
        });

        describe('#pushValue()', (): void => {
            it('should push value without error', (): void => {
                bufferManager.pushValue.bind(bufferManager, 1).should.not.throw();
                bufferManager.pushValue.bind(bufferManager, 2).should.not.throw();
                bufferManager.pushValue.bind(bufferManager, 3).should.not.throw();
                bufferManager.pushValue.bind(bufferManager, 4).should.not.throw();
            });
        });

        describe('#startNewBuffer()', (): void => {
            it('should start a new buffer and return the flushed data', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.startNewBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([1, 2, 3]);
                buff = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(0);
                buff.buffer.should.eql([]);
                bufferManager.startNewBuffer();
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                buff = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(2);
                buff.buffer.should.eql([1, 2]);
            });
            it('should start a new buffer with the default buffer length', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.startNewBuffer();
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.pushValue(4);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([2, 3, 4]);
            });
            it('should start a new buffer with the input buffer length', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.startNewBuffer(2);
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(2);
                buff.buffer.should.eql([2, 3]);
            });
            it('should throw if input buffer length is invalid', (): void => {
                bufferManager.startNewBuffer.bind(bufferManager, -1).should.throw();
                bufferManager.startNewBuffer.bind(bufferManager, 0).should.throw();
            });
        });

        describe('#getBuffer()', (): void => {
            it('should get buffer equals to what just pushed in', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([1, 2, 3]);
            });
            it('should get the same buffer twice', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([1, 2, 3]);
            });
            it('should handle buffer overflow correctly', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.pushValue(4);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer();
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([2, 3, 4]);
            });
            it('should throw if invalid depth parameter passed in', (): void => {
                bufferManager.getBuffer.bind(bufferManager, 2).should.throw();
                bufferManager.getBuffer.bind(bufferManager, -1).should.throw();
                bufferManager.getBuffer.bind(bufferManager, 0).should.not.throw();
                bufferManager.getBuffer.bind(bufferManager, 1).should.not.throw();
            });
            it('should be able to get old data', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.pushValue(4);
                bufferManager.startNewBuffer();
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer(0);
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([1, 2, 3]);
                buff = bufferManager.getBuffer(1);
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([2, 3, 4]);
            });
        });

        describe('#isEmpty()', (): void => {
            it('should return true if buffer is empty', (): void => {
                bufferManager.isEmpty().should.be.a.Boolean.and.be.true;
            });
            it('should return false if buffer is not empty', (): void => {
                bufferManager.pushValue(1);
                bufferManager.isEmpty().should.be.a.Boolean.and.be.not.true;
            });
            it('should be able to get old data', (): void => {
                bufferManager.pushValue(1);
                bufferManager.startNewBuffer();
                bufferManager.isEmpty().should.be.a.Boolean.and.be.true;
                bufferManager.isEmpty(1).should.be.a.Boolean.and.be.not.true;
            });
            it('should throw if invalid depth parameter passed in', (): void => {
                bufferManager.isEmpty.bind(bufferManager, 2).should.throw();
                bufferManager.isEmpty.bind(bufferManager, -1).should.throw();
                bufferManager.isEmpty.bind(bufferManager, 0).should.not.throw();
                bufferManager.isEmpty.bind(bufferManager, 1).should.not.throw();
            });
        });
    });

    describe('ThreeLevelHistory', (): void => {
        beforeEach((): void => {
            bufferManager = new HistoricalBufferManager<number>(3, 3);
        });

        describe('#getBuffer()', (): void => {
            it('should be able to get all three levels of data', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.pushValue(4);
                bufferManager.startNewBuffer(2);
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.startNewBuffer(1);
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer(0);
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(1);
                buff.buffer.should.eql([2]);
                buff = bufferManager.getBuffer(1);
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(2);
                buff.buffer.should.eql([2, 3]);
                buff = bufferManager.getBuffer(2);
                buff.overflow.should.be.a.Number.and.be.exactly(1);
                buff.buffer.should.be.an.Array.and.have.lengthOf(3);
                buff.buffer.should.eql([2, 3, 4]);
            });
            it('should not be able to get data beyond three level', (): void => {
                bufferManager.pushValue(1);
                bufferManager.pushValue(2);
                bufferManager.pushValue(3);
                bufferManager.pushValue(4);
                bufferManager.startNewBuffer();
                bufferManager.startNewBuffer();
                bufferManager.startNewBuffer();
                var buff: interfaces.IBufferedData<number> = bufferManager.getBuffer(0);
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(0);
                buff.buffer.should.eql([]);
                buff = bufferManager.getBuffer(1);
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(0);
                buff.buffer.should.eql([]);
                buff = bufferManager.getBuffer(2);
                buff.overflow.should.be.a.Number.and.be.exactly(0);
                buff.buffer.should.be.an.Array.and.have.lengthOf(0);
                buff.buffer.should.eql([]);
                bufferManager.getBuffer.bind(bufferManager, 3).should.throw();
            });
        });
    });
});
