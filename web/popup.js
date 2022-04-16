// popup script

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-144181571-1']);
_gaq.push(['_trackPageview']);

/* does not work with manifest v3
(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
*/

document.addEventListener('DOMContentLoaded',sendUserlistReq);
chrome.runtime.onMessage.addListener(handleRes);

// links in popup.html should be opened in new tab
window.addEventListener('click', function(e) {
  if(e.target.href!==undefined){
    chrome.tabs.create({url:e.target.href, active: false})
  }
});

/*
function trackButtonClick(e) {
  console.log("refresh action registered");
  // _gaq.push(['_trackEvent', e.target.id, 'clicked']);
}
*/

function sendUserlistReq(){
  console.log("sending request to background script");
  chrome.runtime.sendMessage({"target": "bs", "msg": "get_userlist"});
}

function handleRes(request, sender, sendResponse) {
  if(request.target === "ps" && request.msg === "update_userlist"){
    console.log(request);
    removeIcon("loading");
    addIcon("refresh", "png", refreshUsers);
    // add user list
    users = request.list;
    addUsersToTable(users);
  }

  if(request.target === "ps" && request.msg === "err" && request.code === 429){
    removeIcon("loading");
    var p = document.createElement("p");
    p.setAttribute("class", "error");
    var node = document.createTextNode("Too many requests, please retry later");
    p.appendChild(node);
    document.getElementById("content").appendChild(p);
  }
  sendResponse();
}

function refreshUsers(){
  var userlist = document.getElementById("userlist");
  if(userlist !== null){
    userlist.remove();
  }
  removeIcon("refresh");

  chrome.runtime.sendMessage({"target": "bs", "msg": "remove_userlist"})
    .then(() => {
      console.log("adding loading gif");
      addIcon("loading", "gif");
      sendUserlistReq();
    }, (response) => {console.log(response)});
}

function removeIcon(id){
  var elem = document.getElementById(id);
  if(elem !== null){ 
    elem.remove();
  }
}


function addIcon(id, filetype, onClickAction){
  if(document.getElementById(id) !== null){
    // icon already loaded
    return;
  }

  var img = document.createElement("IMG");
  img.setAttribute("id", id);
  img.setAttribute("src", "img/" + id + "." + filetype);
  console.log("img/" + id + "." + filetype);

  if(onClickAction !== null){
    img.onclick = onClickAction;
  }
  // append image to content div
  document.getElementById("content").appendChild(img);

  // add google analytics listener
  // img.addEventListener('click', trackButtonClick);
}


function addUsersToTable(users){
  var table = document.createElement("TABLE");
  table.setAttribute("id", "userlist");
  table.setAttribute("class", "table table-striped");
  document.getElementById("content").appendChild(table);

  // needs to be reversed, because of the insertion order
  users.reverse();

  console.log(users);
  for(i=0; i<users.length; i++){
    var row = table.insertRow(0);

    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    //var cell3 = row.insertCell(2);
    
    cell1.innerHTML = `<img class="pp" src="${users[i].profile_pic_base64}" alt="${users[i].username}"></img>`;
    cell2.innerHTML = `<p class="username"><a href="https://instagram.com/${users[i].username}">@${users[i].username}</p></a> <p class="full_name">${users[i].full_name}</p>`;
    //cell3.innerHTML = `<p> verified: ${users[i].is_verified} </p>`
  }
}
