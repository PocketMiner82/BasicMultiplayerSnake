const board_border = 'Black';
const board_background = "LightGrey";

const colors = ["Aqua", "Yellow", "Red", "Black", "White", "DeepPink",
"LawnGreen", "Orange", "SaddleBrown", "OrangeRed", "DarkViolet", "Gold", "Indigo", "Silver", "DarkGreen"];

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

// countdown before start
var countdown = 6;

// True if changing direction
var changingDirection = false;

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
const snakeboardCtx = snakeboard.getContext("2d");
// set the coordinate system dimensions (always 16:9)
const snakeboardMaxX = 1280;
const snakeboardMaxY = 720;

var snakeboardCalculatedWidth;
var snakeboardCalculatedHeight;

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

// listener for key press and window resize
document.addEventListener("keydown", onKeyPress);
window.addEventListener("resize", onResizeWindow, false);

// first resize manually
onResizeWindow();

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
  
  // Start the main loop
  loop();
  
  // starting the game
  startGame();
}

function startGame() {
  countdown = 6;
  snake = generateRandomSnake();
  isGameEnded = false;
  
  startCountdown();
}

function startCountdown() {
  countdown--;
  if (countdown > 0 && countdown <= 3) {
    document.getElementById('status').innerHTML = countdown;
    setTimeout(startCountdown, 1000);
    return;
  } else if (countdown > 0) {
    document.getElementById('status').innerHTML = "Get ready!";
    setTimeout(startCountdown, 1000);
    return;
  } else {
    // if there is a snake on our position, wait for it to go away
    if (checkForCollisionWithOtherSnakes()) {
      countdown = -1;
      document.getElementById('status').innerHTML = "Waiting for other snake to go away...";
      setTimeout(startCountdown, 50);
      return;
    }
    
    dx = 10;
    dy = 0;
    countdown = 0;
    
    document.getElementById('status').innerHTML = "Go!";
    setTimeout(() => {
      // hide, if the innerHTML is still "Go!"
      if (document.getElementById('status').innerHTML === "Go!")
        document.getElementById('status').style.visibility = 'hidden';
    }, 3000);
  }
}

function loop() {
  changingDirection = false;
  setTimeout(tick, 100);
}

function tick() {
  updateSideBar();
  
  clearBoard();
  drawFood();
  handleOtherSnakes();
  
  if (countdown != 0) {
  } else if (isGameEnded || checkForCollision()) {
    // first call, then call onGameEnd()
    if (!isGameEnded) onGameEnd();
  } else {
    // first move the snake (change values in array, and handle key presses)
    move_snake();
  }
  
  // we always need to draw the snake, so if it's there, it will be shown
  drawSnake();
  
  // Repeat with delay
  loop();
}

// draw a border around the canvas
function clearBoard() {
  //  Select the colour to fill the drawing
  snakeboardCtx.fillStyle = board_background;
  // Draw a "filled" rectangle to cover the entire canvas
  snakeboardCtx.fillRect(0, 0, snakeboardMaxX, snakeboardMaxY);
}

function drawFood() {
  snakeboardCtx.fillStyle = currentFoodColor();
  snakeboardCtx.strokestyle = 'black';
  snakeboardCtx.fillRect(food_x, food_y, 10, 10);
  snakeboardCtx.strokeRect(food_x, food_y, 10, 10);
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
  // empty
  if (snake.length == 0) return;
  
  // Draw each part
  snake.forEach(part => drawSnakePart(my_snake_col, part))
}

// Draw one snake part
function drawSnakePart(snake_col, snakePart) {

  // Set the color of the snake part
  snakeboardCtx.fillStyle = snake_col;
  // Set the border colour of the snake part
  snakeboardCtx.strokestyle = "black";
  // Draw a "filled" rectangle to represent the snake part at the coordinates
  // the part is located
  snakeboardCtx.fillRect(snakePart.x, snakePart.y, 10, 10);
  // Draw a border around the snake part
  snakeboardCtx.strokeRect(snakePart.x, snakePart.y, 10, 10);
}

function checkForCollision() {
  // check for collsison with oneself
  for (var i = 4; i < snake.length; i++) {
    if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
  }
  // check for collisions with other players
  if (checkForCollisionWithOtherSnakes()) return true;
  
  // check for collission with wall
  const hitLeftWall = snake[0].x < 0;
  const hitRightWall = snake[0].x > snakeboardMaxX - 10;
  const hitToptWall = snake[0].y < 0;
  const hitBottomWall = snake[0].y > snakeboardMaxY - 10;
  return hitLeftWall || hitRightWall || hitToptWall || hitBottomWall;
}

function gen_food() {
  // Generate a random number the food x-coordinate
  food_x = randomCoordinateX();
  // Generate a random number for the food y-coordinate
  food_y = randomCoordinateY();
  
  // save to database for multiplayer
  setFoodPos(food_x, food_y);
  
  // if the new food location is where the snake currently is, generate a new food location
  snake.forEach(function has_snake_eaten_food(part) {
    const has_eaten = part.x == food_x && part.y == food_y;
    if (has_eaten) gen_food();
  });
}

function move_snake() {
  // Create the new Snake's head
  const head = {x: snake[0].x + dx, y: snake[0].y + dy};
  // Add the new head to the beginning of snake body
  snake.unshift(head);
  const has_eaten_food = snake[0].x === food_x && snake[0].y === food_y;
  if (has_eaten_food) {
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
 * --------- Event ---------
 * -------------------------
 * -------------------------
 */

// called, when the window is resized by user
function onResizeWindow() {
  // calculate the max width and height
  var width50Percent = 7 * window.innerWidth / 8;
  var height75Percent = 3 * window.innerHeight / 4;
  
  // calculate aspect ratio
  var aspectRatio = snakeboardMaxX / snakeboardMaxY;
  
  // only allow the smallest width, to be full size
  var widthMax = snakeboardMaxX / width50Percent;
  var heightMax = snakeboardMaxY / height75Percent;
  
  // the other size (which is too big to fit on the monitor) will shrink,
  // but it will also consider the aspect ratio
  if (widthMax > heightMax) {
    snakeboardCalculatedWidth = width50Percent;
    snakeboardCalculatedHeight = width50Percent / aspectRatio;
  } else if (heightMax > widthMax) {
    snakeboardCalculatedWidth = height75Percent * aspectRatio;
    snakeboardCalculatedHeight = height75Percent;
  } else {
    snakeboardCalculatedWidth = width50Percent;
    snakeboardCalculatedHeight = height75Percent;
  }
  
  // set the calculated width and height
  snakeboard.width = snakeboardCalculatedWidth;
  snakeboard.height = snakeboardCalculatedHeight;
  // set scale multiplier for x and y
  snakeboardCtx.scale(snakeboardCalculatedWidth/snakeboardMaxX, snakeboardCalculatedHeight/snakeboardMaxY);
}

// called, when the player presses a key on keyboard
function onKeyPress(event) {
  const UP_KEY = 38;
  const W_KEY = 87;
  const LEFT_KEY = 37;
  const A_KEY = 65;
  const DOWN_KEY = 40;
  const S_KEY = 83;
  const RIGHT_KEY = 39;
  const D_KEY = 68;
  
  // Prevent the snake from reversing

  if (changingDirection) return;
  changingDirection = true;
  const keyPressed = event.keyCode;
  const goingUp = dy === -10;
  const goingDown = dy === 10;
  const goingRight = dx === 10;
  const goingLeft = dx === -10;
  if ((keyPressed === UP_KEY || keyPressed === W_KEY) && !goingDown) {
    dx = 0;
    dy = -10;
  }
  if ((keyPressed === LEFT_KEY || keyPressed === A_KEY) && !goingRight) {
    dx = -10;
    dy = 0;
  }
  if ((keyPressed === DOWN_KEY || keyPressed === S_KEY) && !goingUp) {
    dx = 0;
    dy = 10;
  }
  if ((keyPressed === RIGHT_KEY || keyPressed === D_KEY) && !goingLeft) {
    dx = 10;
    dy = 0;
  }
}

// called when the retry button is clicked
function onRetryClick() {
  // if the player isn't alive, restart
  if (isGameEnded) {
    startGame();
  }
}

// called when the game ends
function onGameEnd() {
  isGameEnded = true;
  
  // remove our snake from the board
  setPlayerData([]);
  snake = [];
  
  // show retry button and game over message
  document.getElementById('status').style.visibility = 'visible';
  document.getElementById('status').innerHTML = '<b><div style=\"color: Red; display: inline;\">Game Over!</div></b> <button id="buttonRetry" class="button retry" onclick="onRetryClick()">Retry</button>';
}

/* -------------------------
 * -------------------------
 * --------- Utils ---------
 * -------------------------
 * -------------------------
 */

function greatestCommonDivisor (a, b) {
  return (b == 0) ? a : greatestCommonDivisor (b, a%b);
}

function randomInt(min, max) {
  return Math.round(Math.random() * (max-min) + min);
}

// get random coordinate for x on the board, min is the minimum distance to the wall from left
function randomCoordinateX(min) {
  min = min || 0;
  return Math.round(randomInt(min * 10, snakeboardMaxX - 10) / 10) * 10;
}

// get random coordinate for y on the board
function randomCoordinateY() {
  return Math.round(randomInt(0, snakeboardMaxY - 10) / 10) * 10;
}

function generateRandomSnake() {
  // getting random coordinates, in x direction with a distance of min 4 gaps to the wall
  var randomX = randomCoordinateX(4);
  var randomY = randomCoordinateY();
  // the coordinates for the snake, we will calculate
  var snakeCoords = [];
  
  // just fill the array with 5 coordinate pairs, the x is descending, the higher the key is
  for (var i = 0; i<5; i++) {
    var currentPart = i * 10;
    snakeCoords[i] = {x: randomX - currentPart, y: randomY};
  }
  
  return snakeCoords;
}

// get random color for our snake, that isn't used
function getRandomColor() {
  var unusedColors = getUnusedColors();
  
  var color = unusedColors[randomInt(0, unusedColors.length - 1)];
  return color;
}

function getUnusedColors() {
  var usedColors = [];
  var unusedColors = [];
  
  // getting all used colors
  var i = 0;
  for (var playerName in otherSnakes) {
    otherSnake = otherSnakes[playerName];
    
    if (otherSnake == null || otherSnake["color"] == null) continue;
    
    usedColors[i] = otherSnake["color"];
    i++;
  }
  
  // looping threw all available colors, then checking if the color
  // is in the list of used colors, if it isn't, the color is unused
  i = 0
  for (var colorName in colors) {
    if (!Array.from(usedColors).includes(colors[colorName])) {
      unusedColors[i] = colors[colorName];
      i++;
    }
  }
  
  // now we have a list of unused colors, which we can return
  return unusedColors;
}

function getArrayLength(array) {
  // looping threw all content of the all snakes, to get length
  var len = 0;
  for(var ignored in array) {
    len++;
  }
  return len;
}

function htmlEntities(str) {
    return String(str).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;');
}

/* -------------------------
 * -------------------------
 * ------ Multiplayer ------
 * -------------------------
 * -------------------------
 */

// update side status bar
function updateSideBar() {
  var scores = [];
  var formattedScore = "";
  
  i = 0;
  // put all the scores and the player name in array
  for(var playerName in allSnakes) {
    var score = ((getArrayLength(allSnakes[playerName]["pos"]) - 5) * 10);
    scores[i] = {
      "score": score,
      "playerName": playerName
    };
    i++;
  }
  
  // sort the array descending
  scores.sort((a, b) => b.score - a.score);
  
  // loop threw the sorted array
  for(var scoreKey in scores) {
    // getting the entry
    var scoreData = scores[scoreKey];
    
    // and getting player name, score and the snake data
    var score = scoreData["score"];
    var playerName = scoreData["playerName"];
    var snakeData = allSnakes[playerName];
    
    // add the data as html to the score string
    formattedScore += "<span style=\"color:" + snakeData["color"] + ";text-shadow: 1px 0 black, -1px 0 black, 0 1px black, 0 -1px black, 1px 1px black, -1px -1px black, -1px 1px black, 1px -1px black;\">"
    + htmlEntities(playerName) + "</span>: " + score + "<br>";
  }
  
  document.getElementById('sidebar').innerHTML = "Online: " + getOnlinePlayers() + "/15<br><br>"
    + formattedScore;
}

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
function checkForCollisionWithOtherSnakes() {
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
    var tempName = prompt("Choose a player name:\n\n\".\", \"/\", \"#\", \"$\", \"[\", or \"]\" will be replaced by \"_\".");
    name = tempName == null ? "" : tempName;
    
    name = name.replaceAll(".", "_").replaceAll("#", "_").replaceAll("$", "_").replaceAll("[", "_").replaceAll("]", "_").replaceAll("/", "_");
    
    if (name.length > 16) {
      alert("This name is too long.");
      name = "";
      continue;
    }
    
    firebase.database().ref("snake/players/" + name + "/color").get().then((snapshot) => {
      // the color value is set, so there must be a user, that has taken this name
      if (snapshot.exists()) {
        alert("Someone has already chosen this name.");
        name = "";
        chooseName();
        return;
      }
      
      nameQuerySuccess = true;
    });
  }
}