"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReentrancyLock = void 0;
class ReentrancyLock {
    constructor() {
        this.locked = false;
    }
    acquire() {
        if (this.locked) {
            return false;
        }
        this.locked = true;
        return true;
    }
    release() {
        this.locked = false;
    }
    isLocked() {
        return this.locked;
    }
}
exports.ReentrancyLock = ReentrancyLock;
