// content script
console.log("cs loaded");

/* searches for userID in DOM */
function getUserID() {
  const fullHtml = document.documentElement.outerHTML;
  const matches = fullHtml.match("(?<=viewerId\":\")\\d+(?=\")");
  return matches[0];
}

// send userID to background script on cs loading
chrome.runtime.sendMessage({"target": "bs", "msg": "set_userid", "userID": getUserID()});

// activiate icon on cs loading
chrome.runtime.sendMessage({"target": "bs", "msg": "activate_icon"});
