import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map();

io.on("connection", (socket) => {
    socket.on("joinRoom", ({ roomId, username }) => {
        socket.join(roomId);

        const players = rooms.get(roomId) || [];
        const newPlayer = { id: socket.id, name: username };
        rooms.set(roomId, [...players, newPlayer]);

        io.to(roomId).emit("roomPlayers", rooms.get(roomId));
    });

    socket.on("disconnect", () => {
        for (let [roomId, players] of rooms.entries()) {
            const updated = players.filter((p) => p.id !== socket.id);
            rooms.set(roomId, updated);
            io.to(roomId).emit("roomPlayers", updated);
        }
    });
});

server.listen(4000, () => console.log("Server running on :4000"));
