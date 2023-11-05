// content script
console.log("cs loaded");

/* searches for userID in DOM */
function getUserID() {
  const fullHtml = document.documentElement.outerHTML;
  const regex = "(?<=viewerId\\\\\":\\\\\")\\d+";
  console.log(regex);
  const matches = fullHtml.match(regex);
  return matches[0];
}

// activiate icon on cs loading
chrome.runtime.sendMessage({"target": "bs", "msg": "activate_icon"});

// send userID to background script on cs loading
chrome.runtime.sendMessage({"target": "bs", "msg": "set_userid", "userID": getUserID()});