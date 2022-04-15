// background script
console.log("backgroundscript loaded");

const FOLLOWING_HASH = '58712303d941c6855d4e888c5f0cd22f';
const FOLLOWERS_HASH = '37479f2b8209594dde7facb0d904896a';


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log("Got request: " + request);

    if(request.target === "bs" && request.msg === "activate_icon") {
        chrome.pageAction.show(sender.tab.id);
    }
    
    if(request.target === "bs" && request.msg === "set_userid"){
      chrome.storage.local.set({"userid": request.userID}, function() {
        console.log("Setting userID to " + request.userID);
      });
    }

    if(request.target === "bs" && request.msg === "remove_userlist"){
      removeUsers();
    }
    
    if(request.target === "bs" && request.msg === "get_userlist"){
      loadUsers();
    }
});


function instaQuery(userid, query_hash, users, after, resolve, reject){

  var params = {
    id: userid,
    first: 50
  };

  if(after !== null){
    params.after = after;
  }

  var req_url = 'https://www.instagram.com/graphql/query/?query_hash=' + 
    query_hash + '&variables=' + encodeURI(JSON.stringify(params));
  console.log(req_url);

  var xhr = new XMLHttpRequest();
  // async xhr
  xhr.open("GET", req_url, true);

  xhr.onload = function(){
    var parsed = JSON.parse(this.response);

    if(parsed.status === "fail"){
      reject({code: 429, msg: "too many requests"});
      return;
    }
    
    var ptr;
    if(query_hash === FOLLOWING_HASH){
      ptr = parsed.data.user.edge_follow;
      } else {
      ptr = parsed.data.user.edge_followed_by;
    }

    var user_nodes = ptr.edges;
    for(var i=0; i<user_nodes.length; i++){
      var user = user_nodes[i].node;
      users.push(user);
    }
    var pageinfo = ptr.page_info;

    if(pageinfo.has_next_page){
      instaQuery(userid, query_hash, users, pageinfo.end_cursor, resolve, reject);
    } else {
      resolve(users);
    }
  };
  xhr.send();
}


function getUserid(){
  return new Promise(function(resolve, reject){
    chrome.storage.local.get(['userid'], function(result) {
      var userid = result.userid;

      if(userid === undefined){
        reject({msg: "userid is undefined"});
      } else {
        console.info("userid is " + userid);
        resolve(userid);
      }
    });
  });
}


function getUsers(){
  return new Promise(function(resolve, reject){
    chrome.storage.local.get("users", function(result) {
      console.log("read users list");
      console.log(result);
      resolve(result);
    });
  });
}

function storeUsers(users){
  return new Promise(function(resolve, reject){
    chrome.storage.local.set({"users": users}, function() {
      console.log("userlist stored: ");
      console.log(users);
      resolve(users);
    });
  });
}

function removeUsers(){
  return new Promise(function(resolve, reject){
    chrome.storage.local.remove(['users'], function() {
      console.log("userlist removed");
      resolve();
    });
  });
}


function sendUsers(users){
  console.log("sending users");
  sendList(users);
}


function sortUsers(filtered){
  sorted = filtered.sort(function(a,b){
    if(a.is_verified === false && b.is_verified === true){
      return -1;
    } else if (a.is_verified === true && b.is_verified === false){
      return 1;
    } else {
      return 0;
    }
  });
  return sorted;
}


function filterUsers(following, followers){
  filtered = following.filter(function(elem){
    for(var i=0; i<followers.length; i++){
      if(followers[i].id === elem.id){
        return false;
      }
    }
    return true;
  });
  return filtered;
}


function refreshUsers(userid){
  return Promise.all([
    new Promise(function(resolve, reject) {instaQuery(userid, FOLLOWING_HASH, [], null, resolve, reject)}),
    new Promise(function(resolve, reject) {instaQuery(userid, FOLLOWERS_HASH, [], null, resolve, reject)}),
    removeUsers()
  ]).then(async result => {
    console.log("xhr queried data:");
    console.log(result);
    // store users
    filtered = filterUsers(result[0], result[1]);
    sorted = sortUsers(filtered);
    with_pp = await store_profile_pics(sorted);
    return storeUsers(with_pp);
  });
}

function store_profile_pics(users) {
  return Promise.all(users.map(async user => {
    user.profile_pic_base64 = await toDataURL(user.profile_pic_url);
    return user;
  }))
}

function loadUsers(){
  console.log("Performing the queries");

  return getUserid().then(userid => {
    
    return getUsers().then(result => { 
      result.userid = userid;
      return Promise.resolve(result);
    });
  
  }).then(result => {
    
    if(!('users' in result)){
      return refreshUsers(result.userid);
    } else {
      console.log("sending cached results");
      return Promise.resolve(result.users);
    }

  }).then(result => {
    sendUsers(result);
  }).catch(function(err){
    console.warn("something went wrong: " + err);
    if(err.code === 429){
      chrome.runtime.sendMessage({target: "ps", msg: "err", code: 429});
    }

  });
}


function sendList(list){
  chrome.runtime.sendMessage({target: "ps", msg: "update_userlist", list: list});
}


const toDataURL = url => fetch(url)
  .then(response => response.blob())
  .then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  }))


// POST to https://www.instagram.com/web/friendships/6025840335/unfollow/