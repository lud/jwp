console.log(`window.jwpParams`, window.jwpParams)
var socket = jwp.connect(window.jwpParams)

var channel = socket.channel('general')
channel.join()

var bodyInput = document.getElementById('msg-body')
var sendButton = document.getElementById('msg-send')
var messagesList = document.getElementById('messages-list')

channel.on('chat_msg', function(data) {
	var p = document.createElement('p')
	p.innerText = data.message
	messagesList.appendChild(p)
})

sendButton.addEventListener('click', function() {
	var msg = bodyInput.value
	var headers = new Headers();
	headers.append('content-type', 'application/json');
	fetch('/chat', {
	 	method: 'POST', 
	 	headers: headers,
	 	body: JSON.stringify({ message: msg }),
	 })
	.then(function(response){ return response.json() })
	.then(function(data){ console.log(`data`, data) })
})