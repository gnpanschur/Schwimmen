const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { generateRoomCode } = require('./utils/roomCode');
const { Game } = require('./game');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Basic Room Manager (In-memory storage)
const rooms = new Map(); // roomId -> Game instance

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', ({ name, playerId, customRoomId }) => {
        let roomId;
        if (customRoomId) {
            roomId = customRoomId.toLowerCase();
            if (rooms.has(roomId)) {
                socket.emit('error', 'Raum existiert bereits! Benutze einen anderen Gegner-Namen.');
                return;
            }
        } else {
            roomId = generateRoomCode();
        }

        const game = new Game(roomId);
        game.addPlayer(socket.id, name, playerId);
        rooms.set(roomId, game);

        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerId });
        console.log(`Room ${roomId} created by ${name}`);
        // Send initial state to let the creator see the lobby
        io.to(roomId).emit('gameState', game.getState(playerId));
    });

    socket.on('joinRoom', ({ roomId, playerName, playerId }) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', 'Raum nicht gefunden! Hat der Ersteller den Raum schon geöffnet?');
            return;
        }

        if (room.players.length >= 4) {
            socket.emit('error', 'Raum ist bereits voll (max. 4 Spieler)!');
            return;
        }

        if (room.status !== 'waiting') {
            socket.emit('error', 'Spiel läuft bereits!');
            return;
        }

        room.addPlayer(socket.id, playerName, playerId);

        socket.join(roomId);
        socket.emit('roomJoined', { roomId, playerId });

        // Notify people that someone joined
        io.to(roomId).emit('playerJoined', { name: playerName });
        console.log(`${playerName} joined room ${roomId}`);

        // We emit getState without a specific player id first so everyone updates
        // Then we can send individual states if necessary, or just broadcast without hand info
        // and let clients request their own state. For now, broadcasting is fine since clients filter internally.

        io.to(roomId).emit('gameStateBroadcast'); // We need to handle this broadcasting
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                // Do not remove player from game on simple disconnect immediately, 
                // in case they are just refreshing. 
                // But if waiting, remove them.
                if (room.status === 'waiting') {
                    room.removePlayer(player.pId);
                    io.to(roomId).emit('playerLeft', { name: player.name });
                    if (room.players.length === 0) {
                        rooms.delete(roomId);
                    } else {
                        io.to(roomId).emit('gameStateBroadcast');
                    }
                }
                break;
            }
        }
    });

    // NEW: Clients request their specific state explicitly
    socket.on('requestState', ({ roomId, playerId }) => {
        const room = rooms.get(roomId);
        if (room) {
            // Update the connection id if they refreshed
            const player = room.players.find(p => p.pId === playerId);
            if (player) {
                player.id = socket.id;
            }
            socket.emit('gameState', room.getState(playerId));
        }
    });

    socket.on('startGame', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.start()) {
            io.to(roomId).emit('gameStateBroadcast');
        }
    });

    socket.on('startNextRound', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.startNextRound()) {
            io.to(roomId).emit('gameStateBroadcast');
        }
    });

    socket.on('drawFromCenter', ({ roomId, playerId, centerIndex }) => {
        const room = rooms.get(roomId);
        if (room && room.drawFromCenter(playerId, centerIndex)) {
            const p = room.players.find(x => x.pId === playerId);
            if (p && p.hand.length === 3 && room.centerCards.length === 3) {
                room.nextTurn();
            }
            io.to(roomId).emit('gameStateBroadcast');
        }
    });

    socket.on('discardToCenter', ({ roomId, playerId, handIndex }) => {
        const room = rooms.get(roomId);
        if (room && room.discardToCenter(playerId, handIndex)) {
            const p = room.players.find(x => x.pId === playerId);
            if (p && p.hand.length === 3 && room.centerCards.length === 3) {
                room.nextTurn();
            }
            io.to(roomId).emit('gameStateBroadcast');
        }
    });

    socket.on('swapAll', ({ roomId, playerId }) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.pId === playerId);
            if (player && room.swapAll(playerId)) {
                io.to(roomId).emit('toast_msg', `${player.name} hat alle 3 Karten getauscht!`);
                room.nextTurn();
                io.to(roomId).emit('gameStateBroadcast');
            }
        }
    });

    socket.on('pass', ({ roomId, playerId }) => {
        const room = rooms.get(roomId);
        if (room && room.pass(playerId)) {
            room.nextTurn();
            io.to(roomId).emit('gameStateBroadcast');
        }
    });

    socket.on('knock', ({ roomId, playerId }) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.pId === playerId);
            if (player && room.knock(playerId)) {
                io.to(roomId).emit('toast_msg', `${player.name} hat Stop gesagt!`);
                room.nextTurn();
                io.to(roomId).emit('gameStateBroadcast');
            }
        }
    });
});

const PORT = process.env.PORT || 3002; // Using 3002 to avoid conflict with SchnapsenPro (3001)
server.listen(PORT, () => {
    console.log(`Lobby Template Server running on http://localhost:${PORT}`);
});
