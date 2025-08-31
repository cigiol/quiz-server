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
        currentQuestion: 0,
        answeredPlayers: 0,
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
        console.log(socket.id);

        const room = rooms.get(roomId);
        console.log(room, "room");
        const newPlayer = { id: socket.id, name: username, score: 0 };
        room.players.push(newPlayer);

        io.to(roomId).emit("roomPlayers", room.players);
    });

    function shuffleArray(array) {
        return array
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
    }

    const sendNextQuestion = (roomId) => {
        const room = rooms.get(roomId) || [];
        if (room.currentQuestion >= room.question.length) {
            io.to(roomId).emit("gameOver", rooms.get(roomId));
            return;
        }
        room.answeredPlayers = 0;
        const question = room.question[room.currentQuestion];
        io.to(roomId).emit("newQuestion", {
            index: room.currentQuestion,
            question: question.question,
            options: shuffleArray([
                ...question.incorrect_answers,
                question.correct_answer
            ])
        });
    };

    socket.on("startGame", async ({ roomId }) => {
        console.log(roomId, "roomId")
        console.log(rooms, "rooms")
        const room = rooms.get(roomId) || [];
        console.log(room, "room");
        const { rounds, difficulty, category } = room.settings;

        let url = `https://opentdb.com/api.php?type=multiple&encode=base64&amount=${rounds}&category=${category}&difficulty=${difficulty}`;

        const response = await fetch(url);
        const data = await response.json();
        room.question = data.results;

        sendNextQuestion(roomId);
    });

    socket.on("answer", async ({ roomId, answer }) => {
        const room = rooms.get(roomId) || [];
        if (!room) return;
        room.answeredPlayers = room.answeredPlayers + 1;
        const question = room.question[room.currentQuestion];
        const correctAnswer = question.correct_answer;
        const isCorrect = answer === correctAnswer;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        if (isCorrect) {
            player.score = (player.score || 0) + 1;
        }
        io.to(roomId).emit("playerAnswered", {
            id: player.id,
            score: player.score,
            isCorrect
        });

        if (room.answeredPlayers === room.players.length) {
            room.currentQuestion = room.currentQuestion + 1;
            sendNextQuestion(roomId);
        }
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
