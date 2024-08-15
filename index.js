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
rooms.set(2, {
    limit: 4,
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
            loc: {
                x: 0,//-2+Math.random()*3,
                y:0,
                z: 0,//-2 + Math.random()*3
            },
            dir: {
                x:0,
                y:0,
                z: 0 // facing forward
            },
            roomNum: roomNum,
            _movingForward: false,
            _movingLeft: false,
            _movingRight: false,
            _movingBackward: false,
            _movementName: undefined,
            verticalNum: 0, // for direction z
            horizontalNum: 0, // for direction x
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
    let spd = .03
    socket.on("emit-move", data => {
        for (const [key, value] of rooms) {
            let playerToMove = value.players.find(pl => pl._id === data._id)
            if(playerToMove) {
                const {x,y,z} = data.loc
                
                playerToMove.loc = {x,y,z}
                switch(data.movementName){
                    case "clickedTarget":
                        const dir = data.direction
                        const diff = { x: dir.x - x, z: dir.z -z}
                        const distance = Math.sqrt(diff.x**2 + diff.z**2)
                        log(distance)
                        // playerToMove._movingForward = true
                        // playerToMove._movingBackward = false
                        // playerToMove._movingRight = false
                        // playerToMove._movingLeft = false
                    break
                    case "forward":
                        playerToMove._movingBackward = false
                        playerToMove._movingForward = true
                        playerToMove.verticalNum = 1
                        if(playerToMove._movingLeft) playerToMove._movingRight = false
                        if(playerToMove._movingRight) playerToMove._movingLeft = false
                    break;
                    case "left":
                        playerToMove._movingRight = false
                        playerToMove._movingLeft = true   
                        playerToMove.horizontalNum = -1                     
                    break;
                    case "right":
                        playerToMove._movingLeft = false
                        playerToMove._movingRight = true
                        playerToMove.horizontalNum = 1
                    break;
                    case "backward":
                        playerToMove._movingForward = false
                        playerToMove._movingBackward = true
                        playerToMove.verticalNum = -1
                        if(playerToMove._movingLeft) playerToMove._movingRight = false
                        if(playerToMove._movingRight) playerToMove._movingLeft = false
                    break;
                }
                playerToMove._movementName = data.movementName
                log("forward", playerToMove._movingForward)
                log("backward", playerToMove._movingBackward)
                // log("left", playerToMove._movingLeft)
                // log("right", playerToMove._movingRight)
            }
        }
    })
    socket.on("emit-stopped", data => {
        for (const [key, value] of rooms) {
            let playerToStop = value.players.find(pl => pl._id === data._id)
            if(playerToStop) {
                log("a player stopped")
                switch(data.movementName){
                    case "jump":
                        playerToStop._movingRight = false
                        playerToStop._movingLeft = false   
                        playerToStop._movingForward = false
                        playerToStop._movingBackward = false
                        log("jumping")
                    break;
                    case "forward":
                        playerToStop._movingForward = false
                        playerToStop._movingBackward = false
                        // playerToMove.verticalNum = 0
                    break;
                    case "left":
                        playerToStop._movingRight = false
                        playerToStop._movingLeft = false   
                        // playerToMove.horizontalNum = 0                     
                    break;
                    case "right":
                        playerToStop._movingRight = false
                        playerToStop._movingLeft = false   
                        // playerToMove.horizontalNum = 0
                    break;
                    case "backward":
                        playerToStop._movingForward = false
                        playerToStop._movingBackward = false
                        // playerToMove.verticalNum == 0
                    break;
                }
                playerToStop._movementName = data.movementName
                io.to(key).emit("player-stopped", data)
            }
        }
    })
    setInterval(() => {
        for (const [key, value] of rooms) {
            if(!value.players.length) return
            value.players.forEach(pl => {
                if(pl._movingForward) {
                    const diffZ = (pl.loc.z+spd)-pl.loc.z
                    
                    pl.loc.z+=spd
                //    pl.dir.z = pl.loc.z+diffZ*10
                }
                if(pl._movingBackward) {
                    const diffZ = (pl.loc.z-spd)-pl.loc.z
                    
                    pl.loc.z-=spd
                    // pl.dir.z = pl.loc.z+diffZ*10
                }
                if(pl._movingLeft) {
                    const diffX = (pl.loc.x-spd)-pl.loc.x
                    pl.loc.x-=spd
                    // pl.dir.x = pl.loc.x+diffX*10
                }
                if(pl._movingRight) {
                    const diffX = (pl.loc.x+spd)-pl.loc.x
                    pl.loc.x+=spd
                    // pl.dir.x = pl.loc.x+diffX*10
                }
 
            })                      
            io.to(key).emit("a-player-moved", value.players)
        }
    }, 1000/60)

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