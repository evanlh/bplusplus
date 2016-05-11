/**
 * @class
 * @description Implements Actor layer over WebWorker's postMessage
 * and onmessage to make messaging between parents and workers
 * look like regular method calls between objects.
 * @example
 *
 */

class Actor {
  constructor(context) {
    this.peerMethodAckCounters = {}; // methodName => int
    this.peerMethodAckPromises = {}; // methodName#counter => [resolve, reject]
    this.isInitialized = false;
    this.context = context;
    this.context.onmessage = this.receive;
    // methods not accessible from our peer
    this.blacklist = ['send', 'receive', 'initPeerAcks', 'buildPeerProxy'];
    let initialMethods = ['initPeer'];
    this.peer = this.buildPeerProxy(initialMethods)
    this.initPeerMethods(initialMethods);
  }
  /**
   * Wraps context's postMessage and returns a Promise to be resolved
   * with by the ack from our peer.
   */
  send(methodName, args) {
    // TODO validate methodName? not necessary if send is private?
    let counter = ++this.peerMethodAckCounters[methodName];
    let ackId = methodName + "#" + counter;
    args.unshift(methodName);
    args.unshift(ackId);
    let ackPromise = new Promise((resolve, reject) => {
      // this is UBER EW... Maybe a different future primitive?
      this.peerMethodAckPromises[ackId] = [resolve, reject];
    });
    this.context.postMessage(args);
    return ackPromise;
  }
  /**
   * Handles the 'ack' reply from our peer and resolves send's Promise
   */
  ack(ackId, value) {
    let resolve = this.peerMethodAckPromises[ackId][0],
        reject = this.peerMethodAckPromises[ackId][1];

    if (value instanceof Error){
      reject(value);
    }
    else {
      resolve(value);
    }
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
    let methodName = e.data.shift();
    let ackId = e.data.shift();
    if (!this[methodName] || typeof this[methodName] !== 'function') {
      throw new TypeError(methodName + ' is not a function', e);
    }
    let returnVal = this[methodName].apply(this, e.data);
    // if we just dispatched to 'ack' we're done
    if (methodName == 'ack') return returnVal;
    // otherwise we need to ack the sender
    if (returnVal instanceof Promise) {
      returnVal.then(val => {
        this.context.postMessage(['ack', ackId, val]);
      })
    }
    else {
      this.context.postMessage(['ack', ackId, returnVal]);
    }
  }

  /**
   * returns a new peer object which proxies method accesses
   * to postMessage calls on the peer
   */
  buildPeerProxy(methods) {
    let peer = {};
    let handlers = {
      get: (target, property, receiver) => {
        console.log("called " + property);
        if (methods.indexOf(property) !== -1) {
          return () => {
            let args = Array.prototype.slice.apply(arguments, 0, arguments.length);
            return this.send(property, args)
          }
        }
        return undefined;
      }
    }
    let proxy = new Proxy(peer, handlers);
    return proxy;
  }

  initPeerAcks(methods) {
    // init the peerMethodAck's
    methods.forEach(methodName => {
      this.peerMethodAckCounters[methodName] = 0;
      this.peerMethodAckPromises[methodName] = {};
    });
  }

  /**
   * Initialize communication with the peer for the first time
   * @param methods {Array<string>} list of valid peer methods to call
   * @returns {Array<string>} list of valid callable methods on this
   */
  initPeer(methods) {
    this.peer = this.buildPeerProxy(methods);
    // only one call to initPeer allowed.
    this.blacklist.push('initPeer');
    this.isInitialized = true;
    // return our methods to sender
    let myMethods = Object.keys(this).filter(k => {
      return this.blacklist.indexOf(k) === -1;
    });
    return myMethods;
  }
}

class WorkerActor extends Actor {
  constructor(script) {
    let worker = new Worker(script);
    super.constructor(worker)
    this.blacklist.concat(["terminate", "close"])
  }
  terminate {
    this.context.terminate();
  }
  close {
    this.context.close()
  }
}

