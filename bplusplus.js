const viewport = document.getElementById('name');
//import actor;
// class WorkerActor extends Actor {
//   constructor(script) {
//     this.worker = new Worker(script);
//   }
// }

/* UI ideas
http://zippyui.com/react-datagrid/#/examples/multiple-selection
http://adazzle.github.io/react-data-grid/examples.html#/row-select
http://facebook.github.io/fixed-data-table/

https://github.com/mbostock/d3/wiki/Zoom-Behavior

*/

// models the methods the Worker may call on us
class ForemanActor extends WorkerActor {
}

var BplusPlusController = {
  _worker: null,
  initWorker: function() {
    // console.log(" logfile " , logfile.substring(0, 400));
    // this._worker = new Worker("logparser.js");
    // this._worker.postMessage(['init', logfile]);
      // this._worker.onmessage = this.onWorkerMessage.bind(this);
      this._worker = new ForemanActor("logparser.js");
      console.log(this._worker);
      return this._worker.start();
  },
  jsonToWidget: function(json, maxKeys) {
    maxKeys = maxKeys || 100;
  },
  onWorkerMessage: function(e) {
    console.warn(e);
  },
  fetch: function (filename) {
      return this._worker.peer.downloadFile('bplus.20160428-force-gc-attempt.log').then((file) => {
          console.log('file ', file.substring(0,100));
      });
  },
  init: function() {
    console.log("loading file...");
    if (!window.Worker) {
      alert("I can't work under these conditions! Please use a real browser.");
      return;
    }
    
    var p = this.initWorker();
	console.log(p);
    p.then((worker) => {
	  console.log(worker);
      return this.fetch('bplus.20160428-force-gc-attempt.log');
    })
    .catch((err) => {
      alert("Couldn't open logfile ");
	  console.error(err);
    })
  }
}

BplusPlusController.init();
