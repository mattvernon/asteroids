// Game constants
const FPS = 60;
const SHIP_SIZE = 45;
const SHIP_THRUST = 5;
const FRICTION = 0.99;
const TURN_SPEED = 360;
const ASTEROID_NUM = 8;
const ASTEROID_SIZE = 100;
const ASTEROID_SPEED = 70;
const ASTEROID_VERTICES = 10;
const LASER_SPEED = 700;
const LASER_MAX = 10;
const LASER_DIST = 0.6;
const LASER_SIZE = 4;
const LASER_FIRE_RATE = 100;
const ASTEROID_SPIN = 0.01;
const MIN_ASTEROID_COUNT = 5;  // Minimum asteroids on screen

// Score constants
const POINTS_LARGE = 20;    // Points for largest asteroids
const POINTS_MEDIUM = 50;   // Points for medium asteroids
const POINTS_SMALL = 100;   // Points for smallest asteroids

// Add sound effects
const SOUND_ON = true;
const SOUNDS = {
    laser: new Audio("sounds/laser.wav"),
    explosion: new Audio("sounds/explosion.wav"),
    loseLife: new Audio("sounds/loseLife.wav"),
    warning: new Audio("sounds/warning.wav"),
    gameOver: new Audio("sounds/gameOver.wav"),
    gameStart: new Audio("sounds/gameStart.wav"),
    music: new Audio("sounds/music.mp3"),
    pauseMusic: new Audio("sounds/pause-music.mp3"),  // Add pause music
    health: new Audio("sounds/health.wav")
};

// Configure sounds
SOUNDS.laser.volume = 0.3;
SOUNDS.explosion.volume = 0.4;
SOUNDS.loseLife.volume = 0.5;
SOUNDS.warning.volume = 0.3;
SOUNDS.gameOver.volume = 0.5;
SOUNDS.gameStart.volume = 0.5;
SOUNDS.music.volume = 0.3;
SOUNDS.pauseMusic.volume = 0.2;  // Keep pause music a bit quieter
SOUNDS.health.volume = 0.4;

// Set both music tracks to loop
SOUNDS.music.loop = true;
SOUNDS.pauseMusic.loop = true;

// Get the canvas element and set it to fullscreen
const canvas = document.getElementById("gameCanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

// Game objects
let asteroids = [];
let lasers = [];
let particles = [];
let stars = [];
let score = 0;
let gameStarted = false;

// Add lives constant
const STARTING_LIVES = 3;

// Add lives to game state
let lives = STARTING_LIVES;
let invulnerable = false;

// Add a new property to track if this is post-collision invulnerability
let isPostCollision = false;

// Add pause state
let isPaused = false;

// Ship object
const ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: SHIP_SIZE / 2,
    angle: 90 / 180 * Math.PI,
    rotation: 0,
    thrusting: false,
    reverse: false,
    thrust: {
        x: 0,
        y: 0
    },
    canShoot: true
};

// Add health pickup constants
const HEALTH_SIZE = 20;
const HEALTH_SPAWN_CHANCE = 0.001; // 0.1% chance per frame to spawn a health
const MAX_HEALTH = 5;  // Maximum number of lives player can have

// Add health array to game objects
let healthPickups = [];

// Add text popup class
class TextPopup {
    constructor(x, y, text, color, size = 20) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.life = 1.0;
        this.velocity = -2;  // Move upward
    }

    update() {
        this.y += this.velocity;
        this.life -= 0.02;
        this.size += 0.3;  // Grow slightly as it fades
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.globalAlpha = this.life;
        ctx.font = `bold ${this.size}px Righteous`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// Add array for text popups
let textPopups = [];

// Create stars
function createStars() {
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            brightness: Math.random(),
            speed: Math.random() * 0.5 + 0.1 // Different speeds for parallax effect
        });
    }
}

// Create asteroid
function createAsteroid(x, y, size) {
    const speedVariation = Math.random() * 0.5 + 0.5; // 50% to 100% of max speed
    const asteroid = {
        x: x || Math.random() * canvas.width,
        y: y || Math.random() * canvas.height,
        xv: Math.random() * ASTEROID_SPEED * speedVariation / FPS * (Math.random() < 0.5 ? 1 : -1),
        yv: Math.random() * ASTEROID_SPEED * speedVariation / FPS * (Math.random() < 0.5 ? 1 : -1),
        radius: size || ASTEROID_SIZE / 2,
        angle: Math.random() * Math.PI * 2,
        vertices: Math.floor(Math.random() * (ASTEROID_VERTICES + 1) + ASTEROID_VERTICES / 2),
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        spin: ASTEROID_SPIN * (Math.random() < 0.5 ? 1 : -1) * speedVariation
    };
    asteroids.push(asteroid);
}

// Create asteroid belt
function createAsteroidBelt() {
    asteroids = [];
    for (let i = 0; i < ASTEROID_NUM; i++) {
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        } while (distBetweenPoints(ship.x, ship.y, x, y) < ASTEROID_SIZE * 2);
        createAsteroid(x, y);
    }
}

// Shoot laser
function shootLaser() {
    if (ship.canShoot && lasers.length < LASER_MAX) {
        lasers.push({
            x: ship.x + 4/3 * ship.radius * Math.cos(ship.angle),
            y: ship.y - 4/3 * ship.radius * Math.sin(ship.angle),
            xv: LASER_SPEED * Math.cos(ship.angle) / FPS,
            yv: -LASER_SPEED * Math.sin(ship.angle) / FPS,
            dist: 0
        });
        
        playSound('laser');
        
        ship.canShoot = false;
        setTimeout(() => ship.canShoot = true, LASER_FIRE_RATE);
    }
}

// Create explosion particles
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
            xv: (Math.random() - 0.5) * 5,
            yv: (Math.random() - 0.5) * 5,
            radius: Math.random() * 3 + 1,
            life: 1,
            color: color
        });
    }
}

// Calculate distance between points
function distBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Draw ship
function drawShip() {
    ctx.save();
    
    // Only flash if invulnerable after collision
    if (!invulnerable || !isPostCollision || Math.floor(Date.now() / 100) % 2) {
        // Draw main ship body
        ctx.strokeStyle = '#00ffff';
        ctx.fillStyle = '#000033';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';

        // Main body
        ctx.beginPath();
        // Nose of the ship
        ctx.moveTo(
            ship.x + 4/3 * ship.radius * Math.cos(ship.angle),
            ship.y - 4/3 * ship.radius * Math.sin(ship.angle)
        );
        // Right wing
        ctx.lineTo(
            ship.x - ship.radius * (Math.cos(ship.angle) - Math.sin(ship.angle)),
            ship.y + ship.radius * (Math.sin(ship.angle) + Math.cos(ship.angle))
        );
        // Right side indent
        ctx.lineTo(
            ship.x - ship.radius * 0.5 * Math.cos(ship.angle),
            ship.y + ship.radius * 0.5 * Math.sin(ship.angle)
        );
        // Back of ship
        ctx.lineTo(
            ship.x - ship.radius * 0.8 * Math.cos(ship.angle),
            ship.y + ship.radius * 0.8 * Math.sin(ship.angle)
        );
        // Left side indent
        ctx.lineTo(
            ship.x - ship.radius * 0.5 * Math.cos(ship.angle),
            ship.y + ship.radius * 0.5 * Math.sin(ship.angle)
        );
        // Left wing
        ctx.lineTo(
            ship.x - ship.radius * (Math.cos(ship.angle) + Math.sin(ship.angle)),
            ship.y + ship.radius * (Math.sin(ship.angle) - Math.cos(ship.angle))
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw cockpit
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.moveTo(
            ship.x + ship.radius * 0.7 * Math.cos(ship.angle),
            ship.y - ship.radius * 0.7 * Math.sin(ship.angle)
        );
        ctx.lineTo(
            ship.x + ship.radius * 0.2 * Math.cos(ship.angle) - ship.radius * 0.3 * Math.sin(ship.angle),
            ship.y - ship.radius * 0.2 * Math.sin(ship.angle) - ship.radius * 0.3 * Math.cos(ship.angle)
        );
        ctx.lineTo(
            ship.x + ship.radius * 0.2 * Math.cos(ship.angle) + ship.radius * 0.3 * Math.sin(ship.angle),
            ship.y - ship.radius * 0.2 * Math.sin(ship.angle) + ship.radius * 0.3 * Math.cos(ship.angle)
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw wing details
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        // Right wing line
        ctx.moveTo(
            ship.x + ship.radius * 0.2 * Math.cos(ship.angle) - ship.radius * 0.4 * Math.sin(ship.angle),
            ship.y - ship.radius * 0.2 * Math.sin(ship.angle) - ship.radius * 0.4 * Math.cos(ship.angle)
        );
        ctx.lineTo(
            ship.x - ship.radius * 0.8 * Math.cos(ship.angle) - ship.radius * 0.8 * Math.sin(ship.angle),
            ship.y + ship.radius * 0.8 * Math.sin(ship.angle) - ship.radius * 0.8 * Math.cos(ship.angle)
        );
        // Left wing line
        ctx.moveTo(
            ship.x + ship.radius * 0.2 * Math.cos(ship.angle) + ship.radius * 0.4 * Math.sin(ship.angle),
            ship.y - ship.radius * 0.2 * Math.sin(ship.angle) + ship.radius * 0.4 * Math.cos(ship.angle)
        );
        ctx.lineTo(
            ship.x - ship.radius * 0.8 * Math.cos(ship.angle) + ship.radius * 0.8 * Math.sin(ship.angle),
            ship.y + ship.radius * 0.8 * Math.sin(ship.angle) + ship.radius * 0.8 * Math.cos(ship.angle)
        );
        ctx.stroke();
    }
    
    ctx.restore();

    // Draw thruster
    if (ship.thrusting) {
        ctx.save();
        
        if (ship.reverse) {
            // Blue thruster for reverse
            ctx.strokeStyle = '#0088ff';
            ctx.fillStyle = '#0044ff';
            ctx.shadowColor = '#0088ff';
            
            // Front thrusters
            ctx.beginPath();
            // Left thruster
            ctx.moveTo(
                ship.x + ship.radius * Math.cos(ship.angle) + ship.radius * 0.5 * Math.sin(ship.angle),
                ship.y - ship.radius * Math.sin(ship.angle) + ship.radius * 0.5 * Math.cos(ship.angle)
            );
            ctx.lineTo(
                ship.x + ship.radius * 1.8 * Math.cos(ship.angle),
                ship.y - ship.radius * 1.8 * Math.sin(ship.angle)
            );
            // Right thruster
            ctx.moveTo(
                ship.x + ship.radius * Math.cos(ship.angle) - ship.radius * 0.5 * Math.sin(ship.angle),
                ship.y - ship.radius * Math.sin(ship.angle) - ship.radius * 0.5 * Math.cos(ship.angle)
            );
            ctx.lineTo(
                ship.x + ship.radius * 1.8 * Math.cos(ship.angle),
                ship.y - ship.radius * 1.8 * Math.sin(ship.angle)
            );
        } else {
            // Orange thruster for forward
            ctx.strokeStyle = '#ff0000';
            ctx.fillStyle = '#ff6600';
            ctx.shadowColor = '#ff6600';
            
            // Rear thrusters
            ctx.beginPath();
            // Main thruster
            ctx.moveTo(
                ship.x - ship.radius * 0.8 * Math.cos(ship.angle),
                ship.y + ship.radius * 0.8 * Math.sin(ship.angle)
            );
            ctx.lineTo(
                ship.x - ship.radius * 2.5 * Math.cos(ship.angle),
                ship.y + ship.radius * 2.5 * Math.sin(ship.angle)
            );
            // Side thrusters
            ctx.moveTo(
                ship.x - ship.radius * 0.5 * Math.cos(ship.angle) - ship.radius * 0.7 * Math.sin(ship.angle),
                ship.y + ship.radius * 0.5 * Math.sin(ship.angle) - ship.radius * 0.7 * Math.cos(ship.angle)
            );
            ctx.lineTo(
                ship.x - ship.radius * 1.5 * Math.cos(ship.angle) - ship.radius * 0.5 * Math.sin(ship.angle),
                ship.y + ship.radius * 1.5 * Math.sin(ship.angle) - ship.radius * 0.5 * Math.cos(ship.angle)
            );
            ctx.moveTo(
                ship.x - ship.radius * 0.5 * Math.cos(ship.angle) + ship.radius * 0.7 * Math.sin(ship.angle),
                ship.y + ship.radius * 0.5 * Math.sin(ship.angle) + ship.radius * 0.7 * Math.cos(ship.angle)
            );
            ctx.lineTo(
                ship.x - ship.radius * 1.5 * Math.cos(ship.angle) + ship.radius * 0.5 * Math.sin(ship.angle),
                ship.y + ship.radius * 1.5 * Math.sin(ship.angle) + ship.radius * 0.5 * Math.cos(ship.angle)
            );
        }
        ctx.shadowBlur = 10;
        ctx.stroke();
        
        ctx.restore();
    }
}

// Draw asteroids
function drawAsteroids() {
    asteroids.forEach(asteroid => {
        ctx.save();
        
        // Move the asteroid
        asteroid.x += asteroid.xv;
        asteroid.y += asteroid.yv;
        
        // Rotate the asteroid
        asteroid.angle += asteroid.spin;

        // Handle edge of screen
        if (asteroid.x < 0 - asteroid.radius) {
            asteroid.x = canvas.width + asteroid.radius;
        } else if (asteroid.x > canvas.width + asteroid.radius) {
            asteroid.x = 0 - asteroid.radius;
        }
        if (asteroid.y < 0 - asteroid.radius) {
            asteroid.y = canvas.height + asteroid.radius;
        } else if (asteroid.y > canvas.height + asteroid.radius) {
            asteroid.y = 0 - asteroid.radius;
        }
        
        ctx.strokeStyle = asteroid.color;
        ctx.fillStyle = `${asteroid.color}33`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = asteroid.color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(
            asteroid.x + asteroid.radius * Math.cos(asteroid.angle),
            asteroid.y + asteroid.radius * Math.sin(asteroid.angle)
        );

        for (let j = 0; j < asteroid.vertices; j++) {
            ctx.lineTo(
                asteroid.x + asteroid.radius * Math.cos(asteroid.angle + j * Math.PI * 2 / asteroid.vertices),
                asteroid.y + asteroid.radius * Math.sin(asteroid.angle + j * Math.PI * 2 / asteroid.vertices)
            );
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    });
}

// Draw lasers
function drawLasers() {
    lasers.forEach(laser => {
        ctx.save();
        
        // Create gradient for fiery effect
        const gradient = ctx.createRadialGradient(
            laser.x, laser.y, 0,
            laser.x, laser.y, LASER_SIZE * 2
        );
        gradient.addColorStop(0, '#fff');     // White core
        gradient.addColorStop(0.3, '#0f0');   // Green middle
        gradient.addColorStop(1, 'rgba(0, 255, 0, 0)'); // Transparent edge
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0f0';
        
        // Main laser body
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(laser.x, laser.y, LASER_SIZE, 0, Math.PI * 2, false);
        ctx.fill();
        
        // Additional particle trail
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(
            laser.x - laser.xv / FPS * 0.5, 
            laser.y - laser.yv / FPS * 0.5, 
            LASER_SIZE * 0.7, 
            0, Math.PI * 2, false
        );
        ctx.fill();
        
        ctx.restore();
    });
}

// Draw particles
function drawParticles() {
    particles.forEach(particle => {
        ctx.save();  // Save state for each particle
        
        ctx.shadowBlur = 5;
        ctx.shadowColor = particle.color;
        ctx.fillStyle = particle.color + Math.floor(particle.life * 255).toString(16);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2, false);
        ctx.fill();
        
        ctx.restore();  // Restore state after each particle
    });
}

// Draw stars
function drawStars() {
    stars.forEach(star => {
        ctx.save();  // Save state for each star
        
        star.brightness = Math.max(0.2, Math.min(1, star.brightness + (Math.random() - 0.5) * 0.1));
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();  // Restore state after each star
    });
}

// Draw score
function drawScore() {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#00ffff";
    ctx.font = "bold 40px Righteous";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ffff";
    ctx.fillText(score, canvas.width - 20, 40);
}

// Add function to reset controls
function resetControls() {
    ship.thrusting = false;
    ship.rotation = 0;
    ship.reverse = false;
}

// Add function to handle pause/unpause
function togglePause() {
    if (!gameStarted) return;
    
    if (!isPaused) {
        // Pause the game
        isPaused = true;
        resetControls();
        document.getElementById('pauseScreen').style.display = 'flex';
        handleBackgroundMusic(false, true);  // Switch to pause music
    } else {
        // Unpause the game
        isPaused = false;
        document.getElementById('pauseScreen').style.display = 'none';
        SOUNDS.pauseMusic.pause();  // Stop pause music
        SOUNDS.music.play();  // Resume game music from where it was
        requestAnimationFrame(update);
    }
}

// Update the keydown event listener for pause/unpause
document.addEventListener("keydown", (ev) => {
    if (gameStarted && (ev.key === "Enter" || ev.key.toLowerCase() === "p")) {
        togglePause();
    }
});

// Update keyDown function to support WASD
function keyDown(/** @type {KeyboardEvent} */ ev) {
    if (!gameStarted || isPaused) return;
    
    switch(ev.key.toLowerCase()) {  // Convert to lowercase to handle both cases
        case "arrowleft":
        case "a":
            ship.rotation = TURN_SPEED / 180 * Math.PI / FPS;
            break;
        case "arrowright":
        case "d":
            ship.rotation = -TURN_SPEED / 180 * Math.PI / FPS;
            break;
        case "arrowup":
        case "w":
            ship.thrusting = true;
            ship.reverse = false;
            break;
        case "arrowdown":
        case "s":
            ship.thrusting = true;
            ship.reverse = true;
            break;
        case " ": // spacebar
            shootLaser();
            break;
    }
}

// Update keyUp function to support WASD
function keyUp(/** @type {KeyboardEvent} */ ev) {
    if (!gameStarted) return;
    
    switch(ev.key.toLowerCase()) {  // Convert to lowercase to handle both cases
        case "arrowleft":
        case "a":
        case "arrowright":
        case "d":
            ship.rotation = 0;
            break;
        case "arrowup":
        case "w":
        case "arrowdown":
        case "s":
            ship.thrusting = false;
            break;
    }
}

// Set up event handlers
document.addEventListener("keydown", keyDown);
document.addEventListener("keyup", keyUp);

// Add function to reset ship
function resetShip() {
    ship.x = canvas.width / 2;
    ship.y = canvas.height / 2;
    ship.thrust.x = 0;
    ship.thrust.y = 0;
    ship.angle = 90 / 180 * Math.PI;
    ship.rotation = 0;
    ship.thrusting = false;
}

// Add function to check ship-asteroid collisions
function checkShipCollision() {
    if (invulnerable) return;

    for (let i = 0; i < asteroids.length; i++) {
        if (distBetweenPoints(ship.x, ship.y, asteroids[i].x, asteroids[i].y) < ship.radius + asteroids[i].radius) {
            lives--;
            document.getElementById('lives').textContent = `LIVES: ${lives}`;
            
            if (lives <= 0) {
                playSound('gameOver');
                gameOver();
            } else {
                playSound('loseLife');
                
                // Play warning sound only when reaching exactly 1 life
                if (lives === 1) {
                    playSound('warning');
                }
                
                resetShip();
                invulnerable = true;
                isPostCollision = true;
                setTimeout(() => {
                    invulnerable = false;
                    isPostCollision = false;
                }, 3000);
            }
            break;
        }
    }
}

// Simplify sound state to a single boolean
let soundEnabled = true;

// Update sound handling
function playSound(sound) {
    if (soundEnabled && SOUNDS[sound]) {
        SOUNDS[sound].play().catch(error => {
            console.log(`Sound play failed: ${sound}`, error);
        });
    }
}

// Update handleBackgroundMusic function
function handleBackgroundMusic(start = true, pause = false) {
    if (!soundEnabled) return;
    
    if (start) {
        SOUNDS.music.currentTime = 0;
        SOUNDS.pauseMusic.pause();
        SOUNDS.music.play().catch(error => console.log("Music play failed:", error));
    } else if (pause) {
        SOUNDS.music.pause();
        SOUNDS.pauseMusic.currentTime = 0;
        SOUNDS.pauseMusic.play().catch(error => console.log("Pause music play failed:", error));
    } else {
        SOUNDS.music.pause();
        SOUNDS.pauseMusic.pause();
        SOUNDS.music.currentTime = 0;
    }
}

// Update sound control handler
document.getElementById('soundToggle').addEventListener('click', function(e) {
    e.preventDefault();
    this.blur();
    soundEnabled = !soundEnabled;
    this.classList.toggle('muted');
    
    // Update sound label
    this.querySelector('span').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    
    if (!soundEnabled) {
        // Stop all sounds
        Object.values(SOUNDS).forEach(sound => {
            sound.pause();
            if (sound.currentTime) {
                sound.currentTime = 0;
            }
        });
    } else if (gameStarted) {
        // Resume appropriate music
        if (isPaused) {
            SOUNDS.pauseMusic.play();
        } else {
            SOUNDS.music.play();
        }
    }
});

// Add game over function
function gameOver() {
    gameStarted = false;
    handleBackgroundMusic(false);  // Stop and reset music
    playSound('gameOver');
    document.getElementById('finalScore').textContent = `SCORE: ${score}`;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

// Add function to reset game
function resetGame() {
    score = 0;
    lives = STARTING_LIVES;
    lasers = [];
    particles = [];
    invulnerable = false;
    isPostCollision = false;
    healthPickups = [];
    textPopups = [];
    
    document.getElementById('lives').textContent = `LIVES: ${lives}`;
    resetShip();
    createAsteroidBelt();
}

// Add health pickup creation function
function createHealthPickup() {
    // Choose a random edge to spawn from
    const spawnEdge = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(spawnEdge) {
        case 0: // top
            x = Math.random() * canvas.width;
            y = -HEALTH_SIZE;
            break;
        case 1: // right
            x = canvas.width + HEALTH_SIZE;
            y = Math.random() * canvas.height;
            break;
        case 2: // bottom
            x = Math.random() * canvas.width;
            y = canvas.height + HEALTH_SIZE;
            break;
        case 3: // left
            x = -HEALTH_SIZE;
            y = Math.random() * canvas.height;
            break;
    }

    const angle = Math.atan2(ship.y - y, ship.x - x);
    const speed = ASTEROID_SPEED / 2; // Move slower than asteroids

    healthPickups.push({
        x: x,
        y: y,
        xv: Math.cos(angle) * speed / FPS,
        yv: Math.sin(angle) * speed / FPS,
        size: HEALTH_SIZE
    });
}

// Add health pickup drawing function
function drawHealthPickups() {
    ctx.save();
    healthPickups.forEach(health => {
        // Move the health pickup
        health.x += health.xv;
        health.y += health.yv;

        // Draw heart shape
        const size = health.size;
        ctx.fillStyle = '#ff69b4';  // Hot pink
        ctx.strokeStyle = '#ff1493'; // Deep pink
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff69b4';
        
        ctx.beginPath();
        ctx.moveTo(health.x, health.y + size/4);
        // Left bump
        ctx.bezierCurveTo(
            health.x - size/2, health.y - size/2,
            health.x - size, health.y + size/4,
            health.x, health.y + size
        );
        // Right bump
        ctx.bezierCurveTo(
            health.x + size, health.y + size/4,
            health.x + size/2, health.y - size/2,
            health.x, health.y + size/4
        );
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();
}

// Update the asteroid hit handler
function handleAsteroidHit(asteroid) {
    let points;
    if (asteroid.radius === ASTEROID_SIZE / 2) {  // Large asteroid
        points = POINTS_LARGE;
    } else if (asteroid.radius === ASTEROID_SIZE / 4) {  // Medium asteroid
        points = POINTS_MEDIUM;
    } else {  // Small asteroid
        points = POINTS_SMALL;
    }
    
    // Create point popup
    textPopups.push(new TextPopup(
        asteroid.x,
        asteroid.y,
        `+${points}`,
        '#ffff00',  // Yellow color for points
        24
    ));
    
    score += points;
}

// Update the health pickup collision handler in checkHealthPickups
function checkHealthPickups() {
    for (let i = healthPickups.length - 1; i >= 0; i--) {
        const health = healthPickups[i];
        
        // Check if health pickup is off screen
        if (health.x < -HEALTH_SIZE || 
            health.x > canvas.width + HEALTH_SIZE || 
            health.y < -HEALTH_SIZE || 
            health.y > canvas.height + HEALTH_SIZE) {
            healthPickups.splice(i, 1);
            continue;
        }

        // Check collision with ship
        if (distBetweenPoints(ship.x, ship.y, health.x, health.y) < ship.radius + health.size/2) {
            if (lives < MAX_HEALTH) {
                lives++;
                playSound('health');
                document.getElementById('lives').textContent = `LIVES: ${lives}`;
                createHealEffect(health.x, health.y);
                
                // Create life pickup popup
                textPopups.push(new TextPopup(
                    health.x,
                    health.y,
                    '+1 LIFE',
                    '#ff69b4',  // Pink color for lives
                    28
                ));
            }
            healthPickups.splice(i, 1);
        }
    }
}

// Add healing effect
function createHealEffect(x, y) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            xv: (Math.random() - 0.5) * 4,
            yv: (Math.random() - 0.5) * 4,
            radius: Math.random() * 3 + 1,
            life: 1,
            color: '#ff69b4'
        });
    }
}

// Game loop
function update() {
    if (!gameStarted || isPaused) return;

    // Draw background
    ctx.fillStyle = "#000033";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and draw stars with parallax
    stars.forEach(star => {
        // Move stars in opposite direction of ship movement
        star.x -= ship.thrust.x * star.speed;
        star.y -= ship.thrust.y * star.speed;

        // Wrap stars around screen
        if (star.x < 0) star.x = canvas.width;
        else if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        else if (star.y > canvas.height) star.y = 0;
    });

    // Draw stars
    drawStars();

    // Move ship
    if (ship.thrusting) {
        const direction = ship.reverse ? -1 : 1;
        ship.thrust.x += direction * SHIP_THRUST * Math.cos(ship.angle) / FPS;
        ship.thrust.y -= direction * SHIP_THRUST * Math.sin(ship.angle) / FPS;
    } else {
        ship.thrust.x *= FRICTION;
        ship.thrust.y *= FRICTION;
    }

    // Move ship
    ship.x += ship.thrust.x;
    ship.y += ship.thrust.y;
    ship.angle += ship.rotation;

    // Handle edge of screen
    if (ship.x < 0 - ship.radius) ship.x = canvas.width + ship.radius;
    else if (ship.x > canvas.width + ship.radius) ship.x = 0 - ship.radius;
    if (ship.y < 0 - ship.radius) ship.y = canvas.height + ship.radius;
    else if (ship.y > canvas.height + ship.radius) ship.y = 0 - ship.radius;

    // Update and draw lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        // Move the laser
        lasers[i].x += lasers[i].xv;
        lasers[i].y += lasers[i].yv;

        // Calculate distance travelled
        lasers[i].dist += Math.sqrt(Math.pow(lasers[i].xv, 2) + Math.pow(lasers[i].yv, 2));

        // Remove laser if it goes off screen
        if (lasers[i].x < 0 || 
            lasers[i].x > canvas.width || 
            lasers[i].y < 0 || 
            lasers[i].y > canvas.height) {
            lasers.splice(i, 1);
            continue;
        }

        // Remove the laser if it goes too far
        if (lasers[i].dist > LASER_DIST * canvas.width) {
            lasers.splice(i, 1);
            continue;
        }

        // Check for asteroid hits
        let hitAsteroid = false;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            if (distBetweenPoints(lasers[i].x, lasers[i].y, asteroids[j].x, asteroids[j].y) < asteroids[j].radius) {
                // Create explosion
                createExplosion(asteroids[j].x, asteroids[j].y, asteroids[j].color);
                playSound('explosion');
                
                // Handle points and popup before removing asteroid
                handleAsteroidHit(asteroids[j]);
                
                // Split or destroy asteroid
                if (asteroids[j].radius > ASTEROID_SIZE / 6) {
                    // Split into two smaller asteroids
                    createAsteroid(asteroids[j].x, asteroids[j].y, asteroids[j].radius / 2);
                    createAsteroid(asteroids[j].x, asteroids[j].y, asteroids[j].radius / 2);
                }
                
                // Remove the asteroid and laser
                asteroids.splice(j, 1);
                lasers.splice(i, 1);
                hitAsteroid = true;

                // Check if we need to spawn more asteroids
                if (asteroids.length < MIN_ASTEROID_COUNT) {
                    const spawnEdge = Math.floor(Math.random() * 4);
                    let x, y;
                    
                    switch(spawnEdge) {
                        case 0: // top
                            x = Math.random() * canvas.width;
                            y = -ASTEROID_SIZE;
                            break;
                        case 1: // right
                            x = canvas.width + ASTEROID_SIZE;
                            y = Math.random() * canvas.height;
                            break;
                        case 2: // bottom
                            x = Math.random() * canvas.width;
                            y = canvas.height + ASTEROID_SIZE;
                            break;
                        case 3: // left
                            x = -ASTEROID_SIZE;
                            y = Math.random() * canvas.height;
                            break;
                    }
                    
                    createAsteroid(x, y, ASTEROID_SIZE / 2);
                }
                
                break;  // Exit the asteroid loop once we've hit one
            }
        }
        
        if (hitAsteroid) {
            continue;  // Move to next laser
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].xv;
        particles[i].y += particles[i].yv;
        particles[i].life -= 0.02;
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Check for ship-asteroid collisions
    checkShipCollision();

    // Randomly spawn health pickup
    if (Math.random() < HEALTH_SPAWN_CHANCE) {
        createHealthPickup();
    }

    // Check and draw health pickups
    checkHealthPickups();
    drawHealthPickups();

    // Update and draw text popups
    textPopups = textPopups.filter(popup => {
        const isAlive = popup.update();
        if (isAlive) {
            popup.draw(ctx);
        }
        return isAlive;
    });

    // Draw everything
    drawShip();
    drawAsteroids();
    drawLasers();
    drawParticles();
    drawScore();

    // Next frame
    requestAnimationFrame(update);
}

// Update start button handler
document.getElementById('startButton').addEventListener('click', (e) => {
    e.preventDefault();  // Prevent default button behavior
    e.target.blur();  // Remove focus
    document.getElementById('welcomeScreen').style.display = 'none';
    gameStarted = true;
    
    loadSounds();
    try {
        playSound('gameStart');
        handleBackgroundMusic(true);
    } catch (error) {
        console.log("Sound initialization failed:", error);
    }
    
    resetGame();
    createStars();
    update();
});

// Update restart button handler
document.getElementById('restartButton').addEventListener('click', (e) => {
    e.preventDefault();  // Prevent default button behavior
    e.target.blur();  // Remove focus
    document.getElementById('gameOverScreen').style.display = 'none';
    gameStarted = true;
    
    try {
        playSound('gameStart');
        handleBackgroundMusic(true);
    } catch (error) {
        console.log("Sound initialization failed:", error);
    }
    
    resetGame();
    update();
});

// Add sound loading utility
function loadSounds() {
    // Create empty Audio objects if sounds fail to load
    Object.keys(SOUNDS).forEach(key => {
        if (!SOUNDS[key].src) {
            console.log(`Warning: ${key} sound not loaded`);
            SOUNDS[key] = new Audio();
        }
    });
}

function initializeGame() {
    // Remove the score display
    const scoreElement = document.getElementById('points');
    if (scoreElement) {
        scoreElement.remove();
    }
    
    // ... existing code ...
} 