// popup script

jQuery.ready(chrome.runtime.sendMessage({"target": "bs", "msg": "get_userlist"}));
chrome.runtime.onMessage.addListener(handleMessage);

$("#reload-btn").click(refreshUsers);
$('button#buy').click((event) => chrome.runtime.sendMessage({"target": "bs", "msg": "extpay_buy"}));
$('a#login').click((event) => {
  event.preventDefault();
  chrome.runtime.sendMessage({"target": "bs", "msg": "extpay_login"});
});

function handleMessage(request, sender, sendResponse) {
  if(request.target === "ps" && request.msg === "update_userlist"){
    toggleLoading();
    // add user list
    users = request.list;
    addUsersToTable(users);
  }

  if(request.target === "ps" && request.error){
    toggleLoading();
    var p = document.createElement("p");
    p.setAttribute("class", "error");
    var node = document.createTextNode(request.error.msg);
    p.appendChild(node);
    document.getElementById("content").appendChild(p);
    removePaymentNotice();
  }
  sendResponse();
}

function refreshUsers(){
  toggleLoading();
  var userlist = $("table#userlist");
  if(userlist !== null){
    userlist.remove();
  }

  chrome.runtime.sendMessage({"target": "bs", "msg": "remove_userlist"})
    .then(() => chrome.runtime.sendMessage({"target": "bs", "msg": "get_userlist"}));
}

function toggleLoading() {
  var btn = $("#reload-btn");
  var loading = btn.prop("disabled"); 
  console.log("setting button loading to " + !loading);

  if (loading) {
    btn.removeAttr("disabled");
    btn.children("span").hide();
  } else {
    btn.prop("disabled", true);
    btn.children("span").show();
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
}

function removePaymentNotice() {
  $('div#overlay').remove();
  $('div#buy').css('display', 'none');
}

async function addUsersToTable(users){
  var table = document.createElement("TABLE");
  table.setAttribute("id", "userlist");
  table.setAttribute("class", "table table-striped");
  $("div#userlist").append(table);

  const paid = await chrome.runtime.sendMessage({target: "bs", msg: "payment_status"});
  const numDisplay = paid ? users.length : Math.min(users.length, 10);
  
  if (paid) {
    removePaymentNotice();
  }

  console.log(users);
  for(i = 0; i < numDisplay; i++){
    var row = table.insertRow(-1);

    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    //var cell3 = row.insertCell(2);

    cell1.setAttribute("class", "align-middle");
    cell2.setAttribute("class", "align-middle");
    
    cell1.innerHTML = `<img class="pp" src="${users[i].profile_pic_base64}" alt="${users[i].username}"></img>`;
    cell2.innerHTML = `<p class="username"><a class="username" href="https://instagram.com/${users[i].username}">@${users[i].username}</p></a> <p class="full_name">${users[i].full_name}</p>`;
    //cell3.innerHTML = `<p> verified: ${users[i].is_verified} </p>`
  }
  
  // open username links in new background tab
  $('a.username').click((event) => chrome.tabs.create({url:event.target.href, active: false}));
}
