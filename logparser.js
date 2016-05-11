var tokenMap = {}; // id => { count: <int>, occursWith: [<int>...] }
var tokenToId = {}; // string => int
var idToToken = {}; // (int)string => string
var idCounter = 1;
var rawText = [];
var startTime = null;
var endTime = null;
var whitespaceRegExp = new RegExp(/\s+/);
console.log("worker ", this);
/**
 * Create an id for token & its corresponding entries
 * in tokenMap, tokenToId and idToToken indexes
 */
function getTokenId(token) {
  let id = tokenToId[token];
  if (id === undefined) {
    idCounter++;
    tokenToId[token] = idCounter;
    idToToken[idCounter] = token;
    id = idCounter;
    tokenMap[id] = {
      count: 0,
      sumOccursWithCount: undefined,
      occursWith: {} // tokenId => count of occurences
    }
  }
  return id;
}

/**
 * Calculate the total number of occurences of each token &
 * maintain an index of the tokens it occurs with
 */
function countOccurences(tokens) {
  for (var i = 0; i < tokens.length; i++) {
    let id = getTokenId(tokens[i]);
    let thisToken = tokenMap[id];
    thisToken.count++;
    for (var j = 0; j < tokens.length; j++) {
      if (j == i) continue;
      let occursWith = getTokenId(tokens[j]);
      let otherToken = tokenMap[occursWith];
      thisToken.occursWith[occursWith] = thisToken.occursWith[occursWith] ?
        thisToken.occursWith[occursWith] + 1 : 1;
      otherToken.occursWith[id] = otherToken.occursWith[id] ?
        otherToken.occursWith[id] + 1 : 1;
    }
  }
}

/**
 * For each token, sum the count of occurences of the tokens it occurs with
 */
function sumOccursWithCount() {
  Object.keys(tokenMap).forEach(function(token){
    var tokenData = tokenMap[token];
    var k = Object.keys(tokenData.occursWith);
    if (!k.length) {
      tokenData.sumOccursWithCount = 0;
      return;
    }
    tokenData.sumOccursWithCount = k.map(function(id){
      return tokenMap[id].count
    }).reduce(function(a, b){
      return a + b;
    });
  })
}

/**
   * Assuming proportion.length distinct categories C and proportion[i]
   * is the proportion of examples in category Ci, return the entropy
   * of the set of samples over C
   * @param proportions {Array<float>} proportion of examples in category
*/
function entropy(proportions) {
  return proportions.map((p) => {
    return p === 0 ? 0 : -1*p*Math.log2(p);
  }).reduce((a, b) => {
    return a + b;
  });
};

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov','Dec']
function convertToTime(time){
  var d = new Date();
  console.log(time);
  d.setMonth(months.indexOf(time[0]));
  d.setDate(parseInt(time[1]))
  var t = time[2].split(":");
  d.setHours(t[0]);
  d.setMinutes(t[1]);
  d.setSeconds(t[2]);
  return d;
}

/**
 * returns a map from unix time => events in that interval
 * @params width how many samples to include
 */
function eventsHistogram(width) {
  width = width || 200;
  var hoursMinutesSecondsRE = /^[a-zA-Z]{3}\s+[0-9]+\s+([0-9]+):([0-9]+):([0-9]+)/;
  var timeArray = [];
  var match;
  if (!rawText.length) return [];
  // get the base unixtime
  var startDate = new Date(rawText[0].substring(0,15));
  startDate.setYear(2016);
  startDate.setHours(0);
  startDate.setMinutes(0);
  startDate.setSeconds(0);
  var baseUnixTime = startDate.getTime();

  // make an array of unix timestamps corresponding to file line numbers
  // TODO this doesn't hold for multiline json
  for (var i = 0; i < rawText.length; i++) {
    if ((match = hoursMinutesSecondsRE.exec(rawText[i]))) {
      timeArray.push(
        baseUnixTime +
        parseInt(match[1])*60*60+ // hours
        parseInt(match[2])*60+ // minutes
        parseInt(match[3]) // seconds
      )
    }
  }

  // aggregate the event count per interval
  var interval = (timeArray[timeArray.length - 1] - timeArray[0])/width;
  var histogram = {};
  var unixTime = timeArray[0];
  var eventCount = 0;
  for (var j = 0; j < timeArray.length; j++) {
    var eventTime = timeArray[j];
    if (eventTime > unixTime + interval) {
      histogram[Math.floor(unixTime)] = eventCount;
      unixTime += interval;
      eventCount = 0;
    }
    eventCount++;
  }
  console.log(histogram);
  return histogram;
}

function init(content) {
  console.log('parsing content');
  // TODO account for multiline JSON
  rawText = content.split("\n");
  console.log(rawText.length)
  for (var i = 0; i < rawText.length; i++) {
    var tokens = rawText[i].split(whitespaceRegExp);
    tokens.splice(0,3);
    countOccurences(tokens);
  }
  sumOccursWithCount();
  eventsHistogram();
  postMessage(['processed', tokenMap, tokenToId, startTime, endTime])
}

var LogParserCommands = {
  init: init,
  eventsHistogram: eventsHistogram
}

onmessage = function(event){
  console.warn(event);
  if (!Array.isArray(event.data)) {
    console.error("Unknown message ", event);
    return;
  }
  let command = event.data.shift();

  console.log(LogParserCommands[command]);
  if (typeof LogParserCommands[command] === 'function'){
    LogParserCommands[command].apply(null, event.data);
  }
}
