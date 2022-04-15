// content script
console.log("cs loaded");

/*
 * searches DOM for a specific script tag
 * looks up userID in script content
 * */
function getUserID(){
  var codeSnippet;
  //search for the script tag
  for(i = 0; i<document.scripts.length; i++){
    if(document.scripts[i].innerHTML.startsWith('window._sharedData')){
      codeSnippet = document.scripts[i].innerHTML;
    }
  }
  //console.log(codeSnippet);
  
  if(!codeSnippet){
    console.warn("code snippet could not be found");
    return 0;
  }

  //drop first chars until '{'
  var c = 0;
  while(codeSnippet.charAt(0) !== '{' && c < 30){
    codeSnippet = codeSnippet.substr(1);
    c++;
  }
  // drop last semicolon
  codeSnippet = codeSnippet.substr(0,codeSnippet.length - 1);

  var codeAsJson = JSON.parse(codeSnippet);
  userID = codeAsJson.config.viewerId;

  console.log("instagram userid: " + userID);
  return userID;
}

// automatically send userID to background script
chrome.runtime.sendMessage({"target": "bs", "msg": "set_userid", "userID": getUserID()});

// activiate icon on instagram.com
chrome.runtime.sendMessage({"target": "bs", "msg": "activate_icon"});
