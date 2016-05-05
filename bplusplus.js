const viewport = document.getElementById('name');

var BplusPlusController = {
  _worker: null,
  initWorker: function(logfile) {
    console.log(" logfile " , logfile.substring(0, 400));
    this._worker = new Worker("logparser.js");
    this._worker.postMessage(['content', logfile]);
    this._worker.onmessage = this.onWorkerMessage.bind(this);
  },
  onWorkerMessage: function(e) {
    console.log(e);
  },
  fetch: function (filename) {
    var promise = new Promise((resolve, reject) =>{
      var request = new XMLHttpRequest();
      request.open('GET', '/data/' + filename, true);
      request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
          var contents = request.responseText;
          resolve(contents);
        } else {
          reject(request.status, null);
        }
      };
      request.onerror = function(err) {
        reject(err, null);
      };

      request.send();
    });
    return promise;
  },
  init: function() {
    console.log("loading file...");
    if (!window.Worker) {
      alert("I can't work under these conditions! Please use a real browser.");
      return;
    }
    this.fetch('system.log').then((contents) => {
      this.initWorker(contents);
    })
    .catch((err) => {
      console.error("Couldn't open logfile ", err);
    })
  }
}

BplusPlusController.init();
