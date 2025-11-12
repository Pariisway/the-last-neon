// Arcade Games Implementation
let currentGame = null;
let gameInterval = null;
let score = 0;

function loadGame(game) {
    const gameContainer = document.getElementById('gameContainer');
    const gameTitle = document.getElementById('gameTitle');
    const gameFrame = document.getElementById('gameFrame');
    
    currentGame = game;
    gameTitle.textContent = getGameTitle(game);
    gameFrame.innerHTML = getGameHTML(game);
    
    gameContainer.style.display = 'block';
    resetGame();
}

function getGameTitle(game) {
    const titles = {
        'snake': 'Neon Snake',
        'pong': 'Laser Pong', 
        'tetris': 'Block Drop'
    };
    return titles[game] || 'Arcade Game';
}

function getGameHTML(game) {
    if (game === 'snake') {
        return '<canvas id="snakeCanvas" width="400" height="400"></canvas>';
    } else {
        return `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
                <h3 style="color: var(--neon-pink);">${getGameTitle(game)} - Coming Soon!</h3>
            </div>
        `;
    }
}

// Snake Game Implementation
let snake = [];
let food = {};
let dx = 10;
let dy = 0;
let canvas, ctx;

function startGame() {
    if (currentGame === 'snake') {
        initSnake();
        gameInterval = setInterval(updateSnake, 100);
    }
}

function initSnake() {
    if (currentGame === 'snake') {
        canvas = document.getElementById('snakeCanvas');
        ctx = canvas.getContext('2d');
        
        snake = [{x: 200, y: 200}];
        generateFood();
        score = 0;
        updateScore();
        
        // Keyboard controls
        document.addEventListener('keydown', changeDirection);
    }
}

function generateFood() {
    food = {
        x: Math.floor(Math.random() * 40) * 10,
        y: Math.floor(Math.random() * 40) * 10
    };
}

function updateSnake() {
    if (!canvas) return;
    
    const head = {x: snake[0].x + dx, y: snake[0].y + dy};
    
    // Game over conditions
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height || 
        snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        clearInterval(gameInterval);
        alert('Game Over! Score: ' + score);
        return;
    }
    
    snake.unshift(head);
    
    // Check if food eaten
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        updateScore();
        generateFood();
    } else {
        snake.pop();
    }
    
    drawGame();
}

function drawGame() {
    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw snake
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#39ff14' : '#00ffff';
        ctx.fillRect(segment.x, segment.y, 10, 10);
        ctx.strokeStyle = '#ff00ff';
        ctx.strokeRect(segment.x, segment.y, 10, 10);
    });
    
    // Draw food
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(food.x, food.y, 10, 10);
}

function changeDirection(e) {
    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;
    
    const keyPressed = e.keyCode;
    const goingUp = dy === -10;
    const goingDown = dy === 10;
    const goingRight = dx === 10;
    const goingLeft = dx === -10;
    
    if (keyPressed === LEFT_KEY && !goingRight) {
        dx = -10;
        dy = 0;
    }
    if (keyPressed === UP_KEY && !goingDown) {
        dx = 0;
        dy = -10;
    }
    if (keyPressed === RIGHT_KEY && !goingLeft) {
        dx = 10;
        dy = 0;
    }
    if (keyPressed === DOWN_KEY && !goingUp) {
        dx = 0;
        dy = 10;
    }
}

function updateScore() {
    document.getElementById('score').textContent = 'Score: ' + score;
}

function pauseGame() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    } else if (currentGame) {
        startGame();
    }
}

function resetGame() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    score = 0;
    updateScore();
    
    if (currentGame === 'snake') {
        dx = 10;
        dy = 0;
        initSnake();
        drawGame();
    }
}

function closeGame() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    document.getElementById('gameContainer').style.display = 'none';
    currentGame = null;
}

// Load game from URL parameter
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('game');
    if (gameParam) {
        loadGame(gameParam);
    }
});
