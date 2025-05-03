const socket = new WebSocket(`wss://${location.hostname}/`);

const nicknameInput = document.getElementById('nickname');
const roomInput = document.getElementById('room');
const lobby = document.getElementById('lobby');
const game = document.getElementById('game');
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const startButton = document.getElementById('startButton');
const answerButtons = document.getElementById('answerButtons');
const countdownElement = document.getElementById('countdown');

let nickname = "";
let gameStarted = false;
let countdownInterval = null;

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
    startButton.style.display = 'block';
  }

  else if (message.type === 'question') {
    gameStarted = true;
    messages.innerHTML = '';
    appendQuestion(message.question);
    answerButtons.style.display = 'block';
    startCountdown(10);
  }

  else if (message.type === 'result') {
    appendMessage(message.message);
  }

  else if (message.type === 'final') {
    gameStarted = false;
    answerButtons.style.display = 'none';
    appendMessage('🎉 Final Scores:');
    for (const [name, score] of Object.entries(message.scores)) {
      appendMessage(`${name}: ${score}`);
    }
    appendMessage('🔄 Returning to lobby in 10 seconds...');
    setTimeout(() => {
      location.reload();
    }, 10000);
  }
});

// Countdown timer function
function startCountdown(seconds) {
  clearInterval(countdownInterval);
  let timeLeft = seconds;
  countdownElement.textContent = `⏳ Time left: ${timeLeft}s`;

  countdownInterval = setInterval(() => {
    timeLeft--;
    countdownElement.textContent = `⏳ Time left: ${timeLeft}s`;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);
}

// Host a room
function hostRoom() {
  setupUser();
  if (!roomInput.value.trim()) {
    alert("Please enter a room name");
    return;
  }
  socket.send(JSON.stringify({ type: 'nickname', nickname }));
  setTimeout(() => {
    socket.send(JSON.stringify({ type: 'host', room: roomInput.value }));
    showGame();
  }, 200);
}

// Join a room
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

// Set nickname
function setupUser() {
  nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert("Please enter a nickname");
  }
}

// Show game screen
function showGame() {
  lobby.style.display = 'none';
  game.style.display = 'block';
}

// Handle input chat
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

// Send answer
function sendAnswer(letter) {
  if (gameStarted) {
    socket.send(JSON.stringify({ type: 'answer', answer: letter.toLowerCase() }));
    answerButtons.style.display = 'none';
  }
}

// Display question
function appendQuestion(questionText) {
  const questionElement = document.createElement('p');
  questionElement.textContent = questionText;
  messages.appendChild(questionElement);
  messages.scrollTop = messages.scrollHeight;
}

// Display system message
function appendMessage(text) {
  const messageElement = document.createElement('p');
  messageElement.textContent = text;
  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight;
}

// Start quiz button
startButton.addEventListener('click', () => {
  socket.send(JSON.stringify({ type: 'startQuiz' }));
  startButton.style.display = 'none';
});
