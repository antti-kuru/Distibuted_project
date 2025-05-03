import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const questions = JSON.parse(fs.readFileSync('./questions.json')); // Ensure 'questions.json' exists in the root
const PORT = process.env.PORT || 5454;

let rooms = {}; // { roomName: { host, sockets: Map<socket, nickname>, scores, gameInProgress, currentQuestionIndex, answers, timer } }

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (socket) => {
  let nickname = "";
  let currentRoom = "";

  socket.send(JSON.stringify({ type: 'system', message: 'Welcome! Please enter your nickname.' }));

  socket.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    // Set nickname
    if (!nickname && msg.type === 'nickname') {
      nickname = msg.nickname;
      socket.send(JSON.stringify({ type: 'system', message: `Nickname set to ${nickname}` }));
      return;
    }

    // Handle hosting a room
    if (msg.type === 'host') {
      const roomName = msg.room;
      if (rooms[roomName]) {
        socket.send(JSON.stringify({ type: 'system', message: `Room "${roomName}" already exists.` }));
        return;
      }
      rooms[roomName] = {
        host: nickname,
        sockets: new Map([[socket, nickname]]),
        scores: {},
        gameInProgress: false,
        currentQuestionIndex: 0,
        answers: {},
        timer: null,
      };
      currentRoom = roomName;
      broadcast(roomName, `${nickname} is hosting room ${roomName}`);
      // Notify the host to show the start button on the frontend
      socket.send(JSON.stringify({ type: 'startQuiz', isHost: true }));
      return;
    }

    // Handle joining a room
    if (msg.type === 'join') {
      const roomName = msg.room;
      if (!rooms[roomName]) {
        socket.send(JSON.stringify({ type: 'system', message: `Room "${roomName}" does not exist.` }));
        return;
      }
      rooms[roomName].sockets.set(socket, nickname);
      currentRoom = roomName;
      broadcast(roomName, `${nickname} joined the room.`);
      socket.send(JSON.stringify({ type: 'system', message: `You joined room ${roomName}.` }));
      return;
    }

    // Handle quiz start request
    if (msg.type === 'startQuiz') {
      const room = rooms[currentRoom];
      if (room.host !== nickname) {
        socket.send(JSON.stringify({ type: 'system', message: 'Only the host can start the quiz.' }));
        return;
      }
      room.gameInProgress = true;
      room.currentQuestionIndex = 0;
      room.scores = {};
      room.answers = {};
      sendQuestion(currentRoom);
      return;
    }

    // Handle chat messages
    if (msg.type === 'chat') {
      if (!currentRoom) return;
      broadcast(currentRoom, `${nickname}: ${msg.message}`);
      return;
    }

    // Handle answering a question
    if (msg.type === 'answer') {
      const room = rooms[currentRoom];
      if (!room || !room.gameInProgress) return;

      room.answers[nickname] = msg.answer.toLowerCase();
      if (Object.keys(room.answers).length === room.sockets.size) {
        clearTimeout(room.timer);
        evaluateAnswers(currentRoom);
      }
    }
  });

  socket.on('close', () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      if (room.sockets.has(socket)) {
        room.sockets.delete(socket);
        broadcast(roomName, `${nickname} disconnected.`);
      }
    }
  });
});

function broadcast(roomName, message) {
  const room = rooms[roomName];
  if (!room) return;
  room.sockets.forEach((_, sock) => {
    sock.send(JSON.stringify({ type: 'chat', message }));
  });
}

function sendQuestion(roomName) {
  const room = rooms[roomName];
  const q = questions[room.currentQuestionIndex];
  const choices = q.choices.map((c, i) => `${String.fromCharCode(97 + i)}) ${c}`).join('\n');
  const formatted = `\n📣 Question ${room.currentQuestionIndex + 1}: ${q.question}\n${choices}`;

  room.answers = {};
  room.timer = setTimeout(() => {
    evaluateAnswers(roomName);
  }, 10000); // 10 seconds

  room.sockets.forEach((_, sock) => {
    sock.send(JSON.stringify({
      type: 'question',
      question: formatted,
    }));
  });
}

function evaluateAnswers(roomName) {
  const room = rooms[roomName];
  const q = questions[room.currentQuestionIndex];
  const correctLetter = String.fromCharCode(97 + q.choices.findIndex(c => c === q.answer));

  room.sockets.forEach((nickname, sock) => {
    if (nickname === room.host) return;
    const answer = room.answers[nickname]?.toLowerCase();
    const isCorrect = answer === correctLetter;
    if (!room.scores[nickname]) {
      room.scores[nickname] = 0
    }
    if (isCorrect) {
      room.scores[nickname] = room.scores[nickname] + 1;
    }
    sock.send(JSON.stringify({
      type: 'result',
      message: `${nickname}, you answered: ${answer || 'No Answer'} - ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`,
    }));
  });

  room.currentQuestionIndex++;
  if (room.currentQuestionIndex < questions.length) {
    setTimeout(() => sendQuestion(roomName), 2000);
  } else {
    room.gameInProgress = false;
    room.sockets.forEach((_, sock) => {
      sock.send(JSON.stringify({
        type: 'final',
        scores: room.scores,
      }));
    });
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`Quiz game server running on port ${PORT}`);
});
