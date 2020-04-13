import { Socket } from 'phoenix/assets/js/phoenix.js'


function connect(params) {
  const { user_id } = params
  const socket = new Socket("ws://localhost:4000/socket", { params })
  socket.connect()
  const makeChannel = socket.channel.bind(socket)
  socket.channel = function(name, params) {
    return makeChannel(`jwp:${user_id}:${name}`, params)
  }
  return socket
}

export default { connect }