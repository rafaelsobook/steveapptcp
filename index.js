const http = require("http")
const express = require("express")
const app = express()
const server = http.createServer(app)
const {Server} = require("socket.io")
const PORT = process.env.PORT || 3000
const log = console.log
const {generateUUID} = require("./tools.js")

const rooms = new Map()
rooms.set(1, {
    limit: 2,
    players: []
})
rooms.set(2, {
    limit: 2,
    players: []
})

app.get('/', (req, res) => {
    res.json({message: "You are in Socket Server"})
})

const io = new Server(server, {
    cors: { 
        origin:[
            "https://steveapp.vercel.app",
            'http://localhost:5173',
        ],
        methods: ["GET", "POST"]
    }
})
io.on("connection", socket => {
    console.log(30, socket.id)
    socket.emit("room-size", rooms.size)
    socket.on('joinRoom', data => {
        log(data)
        const playerDetail = {
            _id: generateUUID(),
            name: data.name,
            socketId: socket.id,
            loc: {x:-2+Math.random()*3,y:0,z:-2 + Math.random()*3}
        }
        const roomNum = parseInt(data.roomNumber)
        const room = rooms.get(roomNum)
        if(!room) return console.log(41, 'room number not found')
        if(room.limit <= room.players.length) return log(42, "players full")
        socket.join(roomNum)
        room.players.push(playerDetail)
        io.to(roomNum).emit("player-joined", {
            newPlayer: data,
            allPlayers: rooms.get(roomNum).players
        })
        socket.emit("my-detail", playerDetail)
        log(rooms.get(roomNum))
        // socket.emit('player', playerDetail)
        // io.emit('players-details', players)
    })
    socket.on('disconnect', () => {
        for (const [key, value] of rooms) {
            const disconnectedPlayer = value.players.find(pl => pl.socketId === socket.id)
            if(disconnectedPlayer) {
                log(`${disconnectedPlayer.name} is disconnected`)
                value.players = value.players.filter(pl => pl.socketId !== disconnectedPlayer.socketId)
                io.to(key).emit("player-dispose", disconnectedPlayer)
            }
        }
        console.log(socket.id)
    })
})

// app.get('/multiplayer/:gameId', (req, res, next) => {

//     const gameId = req.params.gameId
//     let game = games.get(gameId)
//     if (!game) {
//         game = new Map()
//         game.set('players', [])
//         games.set(gameId, game)
//     }
//     const players = game.get('players')
//     console.log('game -> ' + gameId + ', players -> ' + players2)

// })



server.listen(PORT, () => log("TCP server is on"))