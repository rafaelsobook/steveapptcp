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
    limit: 4,
    players: []
})
rooms.set(4, {
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
            "https://stevegame.vercel.app",
            'http://localhost:5173',
        ],
        methods: ["GET", "POST"]
    }
})
io.on("connection", socket => {
    console.log(35, socket.id)
    socket.emit("room-size", rooms.size)
    socket.on('joinRoom', data => {
        const roomNum = parseInt(data.roomNumber)
        const room = rooms.get(roomNum)
        if(!room) return console.log(47, 'room number not found')
        if(room.limit <= room.players.length) return log(48, "players full")

        const playerDetail = {
            _id: generateUUID(),
            name: data.name,
            socketId: socket.id,
            loc: {x:-2+Math.random()*3,y:0,z:-2 + Math.random()*3},
            roomNum: roomNum
        }
        socket.join(roomNum)
        room.players.push(playerDetail)
        io.to(roomNum).emit("player-joined", {
            newPlayer: data,
            allPlayers: rooms.get(roomNum).players
        })
        socket.emit("who-am-i", playerDetail)
        log(`${data.name} has joined room ${roomNum}`)
        // socket.emit('player', playerDetail)
        // io.emit('players-details', players)
    })

    // movements 
    socket.on("player-movement", data => {
        for (const [key, value] of rooms) {
            const playerToMove = value.players.find(pl => pl.socketId === data.socketId)
            if(playerToMove) {
            }
        }
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