const socket = new WebSocket(`wss://${location.hostname}/`);

const nicknameInput = document.getElementById('nickname');
const roomInput = document.getElementById('room');
const lobby = document.getElementById('lobby');
const game = document.getElementById('game');
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const startButton = document.getElementById('startButton');
const answerButtons = document.getElementById('answerButtons');

let nickname = "";
let gameStarted = false;

// Handle WebSocket connection open
socket.addEventListener('open', () => {
  appendMessage('✅ Connected to quiz server.');
});

// Handle incoming WebSocket messages
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'system') {
    appendMessage(message.message);
  }

  else if (message.type === 'chat' && !gameStarted) {
    appendMessage(message.message);
  }

  else if (message.type === 'startQuiz' && message.isHost) {
    startButton.style.display = 'block'; // Show start button for the host
  }

  else if (message.type === 'question') {
    gameStarted = true;
    messages.innerHTML = ''; // Clear chat
    appendQuestion(message.question);
    answerButtons.style.display = 'block';
  }

  else if (message.type === 'result') {
    appendMessage(message.message); // Show result only to the player
  }

  else if (message.type === 'final') {
    gameStarted = false;
    answerButtons.style.display = 'none';
    appendMessage('🎉 Final Scores:');
    for (const [name, score] of Object.entries(message.scores)) {
      appendMessage(`${name}: ${score}`);
    }
  }
});

// Function to handle hosting a room
function hostRoom() {
  setupUser();
  if (!roomInput.value.trim()) {
    alert("Please enter a room name");
    return;
  }
  safeSend(JSON.stringify({ type: 'nickname', nickname }));
  setTimeout(() => {
    safeSend(JSON.stringify({ type: 'host', room: roomInput.value }));
    showGame();
  }, 200);
}

function safeSend(data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(data);
  } else {
    alert("Yhteys palvelimeen on katkennut. Lataa sivu uudelleen.");
  }
}

// Function to handle joining a room
function joinRoom() {
  setupUser();
  if (!roomInput.value.trim()) {
    alert("Please enter a room name");
    return;
  }
  socket.send(JSON.stringify({ type: 'nickname', nickname }));
  setTimeout(() => {
    socket.send(JSON.stringify({ type: 'join', room: roomInput.value }));
    showGame();
  }, 200);
}

// Function to setup the user's nickname
function setupUser() {
  nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert("Please enter a nickname");
  }
}

// Function to show the game screen and hide the lobby
function showGame() {
  lobby.style.display = 'none';
  game.style.display = 'block';
}

// Function to send chat messages (only before quiz)
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const value = input.value.trim();
    if (value !== '') {
      if (!gameStarted) {
        socket.send(JSON.stringify({ type: 'chat', message: value }));
      }
      input.value = '';
    }
  }
});

// Function to send answer (A–D)
function sendAnswer(letter) {
  if (gameStarted) {
    socket.send(JSON.stringify({ type: 'answer', answer: letter.toLowerCase() }));
    answerButtons.style.display = 'none'; // Hide after answering
  }
}

// Function to display the current question
function appendQuestion(questionText) {
  const questionElement = document.createElement('p');
  questionElement.textContent = questionText;
  messages.appendChild(questionElement);
  messages.scrollTop = messages.scrollHeight;
}

// Function to display chat/result messages
function appendMessage(text) {
  const messageElement = document.createElement('p');
  messageElement.textContent = text;
  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight;
}

// Host starts the quiz
startButton.addEventListener('click', () => {
  socket.send(JSON.stringify({ type: 'startQuiz' }));
  startButton.style.display = 'none';
});
