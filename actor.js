/**
 * @class
 * @description Implements Actor layer over WebWorker's postMessage
 * and onmessage to make messaging between parents and workers
 * look like regular method calls between objects.
 */

class Actor {
  constructor(context) {
    this.peerMethodAckCounters = {}; // methodName => int
    this.peerMethodAckPromises = {}; // methodName#counter => [resolve, reject]
    this.isInitialized = false;
    this.context = context;
    this.context.onmessage = this.receive;
    // methods not accessible from our peer
    this.blacklist = ['send', 'receive'];

    this.peer = {
      initMethods: (methods) => {
      }
    };
  }
  /**
   * Wraps context's postMessage and returns a Promise to be resolved
   * with by the ack from our peer.
   */
  send(methodName, args) {
    // TODO validate methodName? not necessary if send is private?
    var counter = ++this.peerMethodAckCounters[methodName];
    var ackId = methodName + "#" + counter;
    args.unshift(methodName);
    args.unshift(ackId);
    var p = new Promise((resolve, reject) => {
      this.peerMethodAckPromises[ackId] = [resolve, reject];
      // this is kindof ew...
    });
    this.context.postMessage(args);
    return p;
  }
  /**
   * Handles the 'ack' reply from our peer and resolves send's Promise
   */
  ack(ackId, value) {
    var resolve = this.peerMethodAckPromises[ackId][0];
    resolve(value);
    this.peerMethodAckPromises[ackId] = undefined;
  }
  /**
   * Handler for context's onmessage event, dispatches to the appropriate
   * method on this and ensures we reply with an ack to the peer.
   */
  receive(e) {
    if (!e || !Array.isArray(e.data)) {
      throw new TypeError("Received unknown message", e);
    }
    var methodName = e.data.shift();
    var ackId = e.data.shift();
    if (!this[methodName] || typeof this[methodName] !== 'function') {
      throw new TypeError(methodName + ' is not a function', e);
    }
    var returnVal = this[methodName].apply(this, e.data);
    // if we just dispatched to 'ack' we're done
    if (methodName == 'ack') return returnVal;
    // otherwise we need to ack the sender
    if (returnVal instanceof Promise) {
      returnVal.then((val){
        this.context.postMessage(['ack', ackId, val]);
      })
    }
    else {
      this.context.postMessage(['ack', ackId, returnVal]);
    }
  }
  /**
   * Initialize communication with the peer for the first time
   * @param methods {Array<string>} list of valid peer methods to call
   * @returns {Array<string>} list of valid callable methods on this
   */
  initPeer(methods) {
    // proxy accesses to this.peer to act like methods
    var handlers = {
      get: (target, prop, receiver) => {
        console.log("called " + prop);
        if (target.indexOf(prop) !== -1) {
          return function() {
            var args = Array.prototype.slice.apply(arguments, 0, arguments.length);
            args.unshift(pid);
            return this.send(pid, prop, args)
          }
        }
        return undefined;
      }
    }
    this.peer = new Proxy(methods, handlers);
    // init the peerMethodAck's
    methods.forEach((methodName) => {
      this.peerMethodAckCounters[methodName] = 0;
      this.peerMethodAckPromises[methodName] = {};
    });
    // only one call to initPeer allowed.
    this.blacklist.push('initPeer');
    this.isInitialized = true;
    // return our methods to sender
    var myMethods = Object.keys(this).filter((k) => {
      return this.blacklist.indexOf(k) === -1;
    });
    return myMethods;
  }
}

class WorkerActor extends Actor {
  constructor(script) {
    this.worker = new Worker(script);
    super.constructor(this.worker)
    this.blacklist.concat(["terminate", "close"])
  }
  terminate: function() {
    this.worker.terminate();
  }
  close: function() {
    this.worker.close()
  }
}

