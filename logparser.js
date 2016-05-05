var tokenMap = {}; // string => { count: <int>, occursWith: [<int>...] }
var tokenToId = {}; // string => int
var idToToken = {}; // (int)string => string
var idCounter = 1;
var rawText = [];
var whitespaceRegExp = new RegExp(/\s+/);

function getTokenId(token) {
  let id = tokenToId[token];
  if (id === undefined) {
    idCounter++;
    tokenToId[token] = idCounter;
    idToToken[idCounter] = token;
    id = idCounter;
    tokenMap[id] = {
      count: 1,
      occursWith: {} // tokenId => count of occurences
    }
  }
  return id;
}

function countOccurences(tokens) {
  for (var i = 0; i < tokens.length; i++) {
    let id = getTokenId(tokens[i]);
    let thisToken = tokenMap[id];
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

function parseContent(content) {
  console.log('parsing content');
  rawText = content.split("\n");
  console.log(rawText.length)
  rawText.forEach(function(line){
    var tokens = line.split(whitespaceRegExp);
    countOccurences(tokens);
  })
  postMessage(['processed', tokenMap, tokenToId])
}

var LogParserCommands = {
  content: parseContent
}

onmessage = function(event){
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
