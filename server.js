import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map();

function createDefaultRoom(settings) {
    return {
        players: [],
        settings
    };
}

io.on("connection", (socket) => {

    socket.on("createRoom", ({ roomId, username, settings }) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, createDefaultRoom(settings));
        }
        // sadece oda yarat, join burada yok
        socket.emit("roomCreated", { roomId });
    });

    socket.on("joinRoom", ({ roomId, username }) => {
        socket.join(roomId);

        const room = rooms.get(roomId);
        console.log(room, "room");
        const newPlayer = { id: socket.id, name: username };
        room.players.push(newPlayer);

        io.to(roomId).emit("roomPlayers", room.players);
    });

    socket.on("startGame", async ({ roomId }) => {
        let qIndex = 0;
        console.log(roomId, "roomId")
        console.log(rooms, "rooms")
        const room = rooms.get(roomId) || [];
        console.log(room, "room");
        const { rounds, difficulty, category } = room.settings;

        let url = `https://opentdb.com/api.php?type=multiple&encode=base64&amount=${rounds}&category=${category}&difficulty=${difficulty}`;

        const response = await fetch(url);
        const data = await response.json();

        const sendNextQuestion = () => {
            console.log(data);
            if (qIndex >= data.results.length) {
                io.to(roomId).emit("gameOver", rooms.get(roomId));
                return;
            }

            const question = data.results[qIndex];
            io.to(roomId).emit("newQuestion", {
                index: qIndex,
                question: question.question,
                options: [...question.incorrect_answers , question.correct_answer]
            });

            qIndex++;
        };

        sendNextQuestion();



        // io.to(roomId).emit("roomPlayers", rooms.get(roomId));
    });


    socket.on("disconnect", () => {
        console.log("disconnect")
        for (let [roomId, room] of rooms.entries()) {
            room.players = room.players.filter((p) => p.id !== socket.id);
            rooms.set(roomId, room);
            io.to(roomId).emit("roomPlayers", room.players);
        }
    });
});

server.listen(4000, () => console.log("Server running on :4000"));
