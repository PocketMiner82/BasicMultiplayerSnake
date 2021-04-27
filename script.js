const board_border = 'black';
const board_background = "white";

const colors = ["Aqua", "Yellow", "Red", "Black", "White", "DeepPink", "LawnGreen", "Orange", "SaddleBrown", "OrangeRed", "DarkViolet", "Gold", "Indigo", "Silver", "DarkGreen"];

var snake = [
  {x: 200, y: 200},
  {x: 190, y: 200},
  {x: 180, y: 200},
  {x: 170, y: 200},
  {x: 160, y: 200}
]

// our snake color
var my_snake_col;

// food position
var food_x;
var food_y;

// color of food (it will be in rainbow mode)
var foodColor = 0;

// current player score
var score = 0;

// True if changing direction
var changing_direction = false;

// Horizontal velocity
var dx = 10;
// Vertical velocity
var dy = 0;

// the player name
var name = "";

// the other players
var otherSnakes = [];

// used to count online (registered) players
var allSnakes;

// was the array above initialized from db?
var firstInitOtherSnakes = false;

// Get the canvas element
const snakeboard = document.getElementById("snakeboard");
// Return a two dimensional drawing context
const snakeboard_ctx = snakeboard.getContext("2d");


// the web app's Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyBbRpK_BcltEmRQzLAUCFykMHEq5PQWWz4",
  authDomain: "psyched-canto-311609.firebaseapp.com",
  databaseURL: "https://psyched-canto-311609-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "psyched-canto-311609",
  storageBucket: "psyched-canto-311609.appspot.com",
  messagingSenderId: "556381649934",
  appId: "1:556381649934:web:af27169882d8297d78d05f"
};

// is the name already set and checked from database?
var nameQuerySuccess = false;

// is the game ended
// (used to detect, if a player leaves, then it snake will get removed so we need to cache)
var isGameEnded = false;



// Initialize Firebase
firebase.initializeApp(firebaseConfig);

document.addEventListener("keydown", change_direction);

setFireBaseListeners();

waitForPlayerData();

// wait to receive playerdata from other players
function waitForPlayerData() {
  if (!firstInitOtherSnakes) {
    setTimeout(waitForPlayerData, 50);
    return;
  }
  
  checkMaxPlayerCount();
  chooseName();
  waitForChooseName();
}

function waitForChooseName() {
  // is the name chosen and check for duplication in db
  if (!nameQuerySuccess) {
    setTimeout(waitForChooseName, 50);
    return;
  }
  
  // name set successfully, we can run the game now
  // if player disconnect, remove data
  firebase.database().ref("snake/players/" + name).onDisconnect().remove();
  
  // generate random color for us
  my_snake_col = getRandomColor();
  
  firebase.database().ref("snake/players/" + name + "/color").set(my_snake_col);
  
  // gen food, if this is the first player
  if (getOnlinePlayers() == 0)
    gen_food();
  // Start game
  loop();
}

// loop function called repeatedly to keep the game running
function loop() {
    changing_direction = false;
    setTimeout(tick, 100);
}

function tick() {
  clear_board();
  drawFood();
  handleOtherSnakes();
  
  if (has_game_ended() || isGameEnded) {
    isGameEnded = true;
    // we need to draw the snake, so it is visible, but it can't move anymore
    drawSnake();
  } else {
    // first move the snake (change values in array
    move_snake();
    // then draw it
    drawSnake();
  }
  
  // Repeat with delay
  loop();
}

// draw a border around the canvas
function clear_board() {
  //  Select the colour to fill the drawing
  snakeboard_ctx.fillStyle = board_background;
  //  Select the colour for the border of the canvas
  snakeboard_ctx.strokestyle = board_border;
  // Draw a "filled" rectangle to cover the entire canvas
  snakeboard_ctx.fillRect(0, 0, snakeboard.width, snakeboard.height);
  // Draw a "border" around the entire canvas
  snakeboard_ctx.strokeRect(0, 0, snakeboard.width, snakeboard.height);
}

function drawFood() {
  snakeboard_ctx.fillStyle = currentFoodColor();
  snakeboard_ctx.strokestyle = 'black';
  snakeboard_ctx.fillRect(food_x, food_y, 10, 10);
  snakeboard_ctx.strokeRect(food_x, food_y, 10, 10);
}

function currentFoodColor() {
  // color is max hexa decimal
  if (foodColor == 360) {
    foodColor = 0;
  }
  
  var hsv = {
    h: foodColor,
    s: 100,
    v: 100,
  };
  foodColor++;
  var color = Color( hsv );
  
  return color.toString();
}

// Draw the snake on the canvas
function drawSnake() {
  // Draw each part
  snake.forEach(part => drawSnakePart(my_snake_col, part))
}

// Draw one snake part
function drawSnakePart(snake_col, snakePart) {

  // Set the color of the snake part
  snakeboard_ctx.fillStyle = snake_col;
  // Set the border colour of the snake part
  snakeboard_ctx.strokestyle = "black";
  // Draw a "filled" rectangle to represent the snake part at the coordinates
  // the part is located
  snakeboard_ctx.fillRect(snakePart.x, snakePart.y, 10, 10);
  // Draw a border around the snake part
  snakeboard_ctx.strokeRect(snakePart.x, snakePart.y, 10, 10);
}

function has_game_ended() {
  // check for collsison with oneself
  for (var i = 4; i < snake.length; i++) {
    if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
  }
  // check for collisions with other players
  if (checkCollisionOtherSnakes()) return true;
  
  // check for collission with wall
  const hitLeftWall = snake[0].x < 0;
  const hitRightWall = snake[0].x > snakeboard.width - 10;
  const hitToptWall = snake[0].y < 0;
  const hitBottomWall = snake[0].y > snakeboard.height - 10;
  return hitLeftWall || hitRightWall || hitToptWall || hitBottomWall
}

function random_food(min, max) {
  return Math.round(randomInt(min, max) / 10) * 10;
}

function gen_food() {
  // Generate a random number the food x-coordinate
  food_x = random_food(0, snakeboard.width - 10);
  // Generate a random number for the food y-coordinate
  food_y = random_food(0, snakeboard.height - 10);
  
  // save to database for multiplayer
  setFoodPos(food_x, food_y);
  
  // if the new food location is where the snake currently is, generate a new food location
  snake.forEach(function has_snake_eaten_food(part) {
    const has_eaten = part.x == food_x && part.y == food_y;
    if (has_eaten) gen_food();
  });
}

function change_direction(event) {
  const LEFT_KEY = 37;
  const RIGHT_KEY = 39;
  const UP_KEY = 38;
  const DOWN_KEY = 40;
  
// Prevent the snake from reversing

  if (changing_direction) return;
  changing_direction = true;
  const keyPressed = event.keyCode;
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

function move_snake() {
  // Create the new Snake's head
  const head = {x: snake[0].x + dx, y: snake[0].y + dy};
  // Add the new head to the beginning of snake body
  snake.unshift(head);
  const has_eaten_food = snake[0].x === food_x && snake[0].y === food_y;
  if (has_eaten_food) {
    // Increase score
    score += 10;
    // Display score on screen
    document.getElementById('score').innerHTML = score;
    // Generate new food location
    gen_food();
  } else {
    // Remove the last part of snake body
    snake.pop();
  }
  
  setPlayerData(snake);
}

/* -------------------------
 * -------------------------
 * --------- Utils ---------
 * -------------------------
 * -------------------------
 */
function randomInt(min, max) {
  return Math.round(Math.random() * (max-min) + min);
}

// get random color for our snake, that isn't used
function getRandomColor() {
  var usedColors = [];
  var unusedColors = [];
  var color = "";
  
  var i = 0;
  for (var playerName in otherSnakes) {
    otherSnake = otherSnakes[playerName];
    
    if (otherSnake == null || otherSnake["color"] == null) continue;
    
    usedColors[i] = otherSnake["color"];
    i++;
  }
  
  i = 0
  for (var colorName in colors) {
    if (!Array.from(usedColors).includes(colors[colorName])) {
      unusedColors[i] = colors[colorName];
      i++;
    }
  }
  
  color = unusedColors[randomInt(0, unusedColors.length - 1)];
  return color;
}

function getArrayLength(array) {
  // looping threw all content of the all snakes, to get length
  var len = 0;
  for(var ignored in array) {
    len++;
  }
  return len;
}


/* -------------------------
 * -------------------------
 * ------ Multiplayer ------
 * -------------------------
 * -------------------------
 */
 
function getOnlinePlayers() {
  return getArrayLength(allSnakes);
}

function checkMaxPlayerCount() {
  // max 15 players
  while (getOnlinePlayers() >= 15) {
    alert("The game is full (15/15). Click the button, to retry.");
  }
}

function handleOtherSnakes() {
  for(var playerName in otherSnakes) {
    var otherSnake = otherSnakes[playerName];
    
    if (otherSnake == null || otherSnake["pos"] == null) continue;
    
     // update each parts
    otherSnake["pos"].forEach(part => drawSnakePart(otherSnake["color"] == null ? "red" : otherSnake["color"], part));
  }
}

// check if the player collides with any other player
function checkCollisionOtherSnakes() {
  for(var playerName in otherSnakes) {
    var otherSnake = otherSnakes[playerName]["pos"];
    
    if (otherSnake == null) continue;
    
    // player collided?
    for (var i = 0; i < otherSnake.length; i++) {
      if (otherSnake[i].x === snake[0].x && otherSnake[i].y === snake[0].y) return true;
    }
  }
  return false;
}

function setFireBaseListeners() {
  firebase.database().ref("snake/food").on("value", (snapshot) => {
    data = snapshot.val();
    food_x = data["x"];
    food_y = data["y"];
  });
  
  // listen for other player changes
  firebase.database().ref("snake/players").on("value", (snapshot) => {
    data = snapshot.val();
    if (data == null) {
      firstInitOtherSnakes = true;
      return;
    }
    
    var newArray = [];
    // we ignore ourself, so we have to put it in a new array, without ourself
    for (var playerName in data) {
      if (playerName == name) {
        // update our own color
        my_snake_col = data[playerName]["color"];
        continue;
      }
      newArray[playerName] = data[playerName];
    }

    otherSnakes = newArray;
    // used to count online (registered) players
    allSnakes = data;
    firstInitOtherSnakes = true;
  });
}    

function setPlayerData(snakeData) {
  firebase.database().ref("snake/players/" + name + "/pos").set(snakeData);
}

function setFoodPos(x, y) {
  firebase.database().ref("snake/food").set({
    "x": x,
    "y": y
  });
  return false;
}

function chooseName() {
  nameQuerySuccess = false;
  name = "";
  
  // loop until user chose a name, that is not empty and not taken
  while (name == "") {
    var tempName = prompt("Enter your name");
    name = tempName == null ? "" : tempName;
    
    firebase.database().ref("snake/players/" + name + "/color").get().then((snapshot) => {
      // an x value is set, so there must be a user, that has taken this name
      if (snapshot.exists()) {
        alert("Someone has already chosen this name.");
        name = "";
        chooseName();
        return;
      }
      
      nameQuerySuccess = true;
    });
  }
  console.log(name);
}