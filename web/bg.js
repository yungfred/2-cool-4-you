// background script
chrome.runtime.onMessage.addListener(handleMessage);
// disable icon for all tabs per default
chrome.runtime.onStartup.addListener(chrome.action.disable);
chrome.runtime.onInstalled.addListener(() => chrome.action.disable());

const FOLLOWING_HASH = '58712303d941c6855d4e888c5f0cd22f';
const FOLLOWERS_HASH = '37479f2b8209594dde7facb0d904896a';
const MAX_USERS = 5000;

importScripts('js-libs/ExtPay.js');
var extpay = ExtPay('2-cool-4-you');
extpay.startBackground();

async function getPaymentStatus(sendResponse) {
  const user = await extpay.getUser();
  if (user.paid) {
    console.log("User paid.");
  } else {
    console.log("User did not pay.");
  }
  return user.paid;
}

function handleMessage(message, sender, sendResponse) {
  console.log("Got request: " + message);

  if(message.target !== "bs") {
    return;
  }

  if (message.msg === "activate_icon") {
    chrome.action.enable(sender.tab.id,sendResponse); // enable icon for tab with cs
  }
  if (message.msg === "set_userid") {
    chrome.storage.local.set({"userid": message.userID}, function() { 
      console.log("Setting userID to " + message.userID);
      sendResponse();
    });
  }
  if (message.msg === "get_userlist") {
    loadUsers().then(sendResponse);
  }
  if (message.msg === "remove_userlist") {
    removeUsers().then(sendResponse);
  }
  if (message.msg === "payment_status") {
    getPaymentStatus().then(sendResponse);
  }
  if (message.msg === "extpay_login") {
    extpay.openLoginPage();
  }
  if (message.msg === "extpay_buy") {
    extpay.openPaymentPage();
  }
  return true;
}

function instaQuery(userid, query_hash, users, after){

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

  var fetchResponsePromise = fetch(req_url, {method: "GET"});

  return fetchResponsePromise
    .then(response => response.json())
    .then(async response => {
      console.log(response);

      if(response.status === "fail"){
        return Promise.reject({msg: "Too many request, please try again later."});
      }

      if(response.data.user.edge_follow?.count >= MAX_USERS){
        return Promise.reject({msg: "You are following too many accounts."});
      }
      if(response.data.user.edge_followed_by?.count >= MAX_USERS){
        return Promise.reject({msg: "You have too many followers."});
      }
      
      var ptr;
      if(query_hash === FOLLOWING_HASH){
        ptr = response.data.user.edge_follow;
        } else {
        ptr = response.data.user.edge_followed_by;
      }

      var user_nodes = ptr.edges;
      for(var i=0; i<user_nodes.length; i++){
        var user = user_nodes[i].node;
        users.push(user);
      }
      var pageinfo = ptr.page_info;

      if(pageinfo.has_next_page){
        await instaQuery(userid, query_hash, users, pageinfo.end_cursor);
      }
      return users;
  });
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
      console.log("read users list: " + result);
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
    instaQuery(userid, FOLLOWING_HASH, [], null),
    instaQuery(userid, FOLLOWERS_HASH, [], null),
    removeUsers()
  ]).then(async result => {
    console.log("fetched data:");
    console.log(result);
    // store users
    filtered = filterUsers(result[0], result[1]);
    console.log("filtered len:" + filtered.length);
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
    console.log("sending users");
    chrome.runtime.sendMessage({target: "ps", msg: "update_userlist", list: result});
  }).catch(function(error){
    console.info("something went wrong: ");
    console.info(error);
    if(error.msg){
      chrome.runtime.sendMessage({target: "ps", error: error});
    }
  });
}

const toDataURL = url => fetch(url)
  .then(response => response.blob())
  .then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  }))


// unfollow: POST to https://www.instagram.com/web/friendships/1234/unfollow/