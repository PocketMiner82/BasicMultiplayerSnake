! function() {
  const BOARD_BACKGROUND = "LightGrey";

  const COLORS = ["Aqua", "Yellow", "Red", "Black", "White", "DeepPink", "LawnGreen", "Orange",
  "SaddleBrown", "OrangeRed", "DarkViolet", "Gold", "Indigo", "Silver", "DarkGreen"];

  // the delay between snake updates in ms
  const SNAKE_UPDATE_DELAY = 100;

  // max player count (currently, set to the amount of colors, available)
  const MAX_PLAYERS = COLORS.length;

  // the time of the last graphics update
  var timeLastGraphicsUpdate = 0;

  // is the game ended?
  var isGameEnded = false;

  // countdown before start
  var countdown = 6;

  // can we send data to database (we should be invisible for other players
  // in countdown sequence, but visible for ourself)
  var isInvisible = true;

  // our snake color
  var my_snake_col;

  // the player name
  var name = "";

  // is the name already set and checked from db?
  var nameQuerySuccess = false;

  // our snake
  var snake = [];

  // are we changing direction?
  var changingDirection = false;

  // horizontal snake move delta
  var deltaX = 10;

  // vertical snake move delta
  var deltaY = 0;

  // the other players
  var otherSnakes = [];

  // used to count online (registered) players
  var allSnakes = [];

  // was the other snake data initialized from db?
  var firstInitOtherSnakes = false;

  // food position
  var food_x;
  var food_y;

  // color of food (it will be in rainbow mode)
  var foodColor = 0;

  // Get the canvas element
  const snakeboard = document.getElementById("snakeboard");
  // Return a two dimensional drawing context
  const snakeboardCtx = snakeboard.getContext("2d");

  // set the coordinate system dimensions (always 16:9)
  const snakeboardMaxX = 1280;
  const snakeboardMaxY = 720;

  // the calculated width and height of the canvas (based on screen size)
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



  // call main method
  main();



  /* -------------------------
   * -------------------------
   * --------- Game ----------
   * -------------------------
   * -------------------------
   */



  // reset everything and start the game
  function startGame() {
    // reset the last graphics update time to now
    timeLastGraphicsUpdate = Date.now();
    // reset countdown
    countdown = 6;
    // reset snake pos to random position
    isInvisible = true;
    snake = generateRandomSnake();
    // reset game isn't ended
    isGameEnded = false;

    // start the countdown
    startCountdown();
  }

  // show countdown
  function startCountdown() {
    countdown--;
    if (countdown > 0 && countdown <= 3) {
      // countdown visible
      document.getElementById('status').innerHTML = countdown;
      setTimeout(startCountdown, 500);
      return;
    } else if (countdown > 0) {
      // "Get ready!" visible
      document.getElementById('status').innerHTML = "Get ready!";
      setTimeout(startCountdown, 500);
      return;
    } else {
      // if there is a snake on our position, wait for it to go away
      if (checkForCollisionWithOtherSnakes()) {
        countdown = -1;
        document.getElementById('status').innerHTML = "Waiting for other snake to go away...";
        setTimeout(startCountdown, 50);
        return;
      }

      // reset go direction
      deltaX = 10;
      deltaY = 0;

      // countdown is finished, we don't need to wait
      countdown = 0;

      isInvisible = false;

      // "Go" visible for 3 secs
      document.getElementById('status').innerHTML = "Go!";
      setTimeout(() => {
        // hide, if the innerHTML is still "Go!"
        if (document.getElementById('status').innerHTML === "Go!")
          document.getElementById('status').style.visibility = 'hidden';
      }, 3000);
    }
  }

  // the game loop
  function loop() {
    // the current time
    var timeNow = Date.now();
    // the time estimated since last update
    var timeEstimated = timeNow - timeLastGraphicsUpdate;

    if (timeEstimated >= SNAKE_UPDATE_DELAY) {
      // the time, we were waiting too long
      var timeTooLong = timeEstimated - SNAKE_UPDATE_DELAY;

      // the count, how often we have to call the tick method, based on the time, we were waiting too long, at least one time
      var loopCount = Math.max(1, Math.round(timeTooLong / SNAKE_UPDATE_DELAY));

      for (var i = 0; i < loopCount; i++) {
        // tick the game
        changingDirection = false;
        tick();
      }

      // send playerdata just once after the for loop, if snake is set
      if (snake.length != 0) setPlayerData(snake);

      // set the last update time to now
      timeLastGraphicsUpdate = Date.now();
    }
    setTimeout(loop, 1);
  }

  // tick the game
  function tick() {
    updateSideBar();

    clearBoard();
    drawFood();
    handleOtherSnakes();

    if (countdown != 0) {
      // wait for countdown finsih
    } else if (isGameEnded || snake.length <= 0 || checkForCollision()) {
      // game ended for us
      // first call, then call onGameEnd()
      if (!isGameEnded) onGameEnd();
    } else {
      // we are still in
      // move the snake (change values in array, and handle key presses)
      move_snake();
    }

    // we always need to draw the snake, so if it's there, it will be shown
    drawSnake();

    // retry button clicked
    if (retryClicked) {
      retryClicked = false;
      onRetry();
    }
  }

  // generate a random snake array which is 5 long (only start point is random, other 4 are relative to start point)
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

  // move the snake
  function move_snake() {
    // create the new Snake's head, based on snake move delta
    const head = {x: snake[0].x + deltaX, y: snake[0].y + deltaY};

    // add the new head to the beginning of snake body
    snake.unshift(head);

    // did we eat food?
    const has_eaten_food = snake[0].x === food_x && snake[0].y === food_y;

    if (has_eaten_food) {
      // generate new food location and don't remove last part of snake, it get's one longer
      gen_food();
    } else {
      // remove the last part of snake body
      snake.pop();
    }
  }

  // change the "walking" direction of the snake
  function changeDirection(up, left, down, right) {
    // going up
    if (up) {
      deltaX = 0;
      deltaY = -10;
    // going left
    } else if (left) {
      deltaX = -10;
      deltaY = 0;
    // going down
    } else if (down) {
      deltaX = 0;
      deltaY = 10;
    // going right
    } else if (right) {
      deltaX = 10;
      deltaY = 0;
    }
  }

  // check for collission with wall, other snakes, oneself
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

  // generate a new random food location
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



  /* -------------------------
   * -------------------------
   * --------- Event ---------
   * -------------------------
   * -------------------------
   */



  // called when the game ends
  function onGameEnd() {
    isGameEnded = true;

    // remove our snake from the board
    setPlayerData([]);
    snake = [];

    // show retry button and game over message
    document.getElementById('status').style.visibility = 'visible';
    document.getElementById('status').innerHTML = '<b><div style=\"color: Red; display: inline;\">Game Over!</div></b> <button id="buttonRetry" class="button retry" onclick="onRetryClick()">Retry (r)</button>';
  }

  // called, when the window is resized by user
  function onResizeWindow() {
    resizeSnakeboard();
  }

  // called, when the player presses a key on keyboard
  function onKeyPress(event) {
    // all keys for going up
    const UP_KEY = 38;
    const W_KEY = 87;

    // all keys for going left
    const LEFT_KEY = 37;
    const A_KEY = 65;

    // all keys for going down
    const DOWN_KEY = 40;
    const S_KEY = 83;

    // all keys for going right
    const RIGHT_KEY = 39;
    const D_KEY = 68;

    // all keys for pressing the retry button
    const ENTER_KEY = 13;
    const R_KEY = 82;

    // Prevent the snake from reversing
    if (changingDirection) return;
    changingDirection = true;
    const keyPressed = event.keyCode;
    const goingUp = deltaY === -10;
    const goingDown = deltaY === 10;
    const goingRight = deltaX === 10;
    const goingLeft = deltaX === -10;

    // change direction based on pressed key
    changeDirection(((keyPressed === UP_KEY || keyPressed === W_KEY) && !goingDown),
      ((keyPressed === LEFT_KEY || keyPressed === A_KEY) && !goingRight),
      ((keyPressed === DOWN_KEY || keyPressed === S_KEY) && !goingUp),
      ((keyPressed === RIGHT_KEY || keyPressed === D_KEY) && !goingLeft));

    // retry
    if (keyPressed === ENTER_KEY || keyPressed === R_KEY) {
      onRetry();
    }
  }

  // if the snakeboard is clicked, get the pos of the click and send it
  function onSnakeboardClick(e) {
    var canvas = e.target;
    // abs. size of element
    var rect = canvas.getBoundingClientRect();
    // relationship bitmap vs. element for X
    var scaleX = snakeboardCalculatedWidth / snakeboardMaxX;
    // relationship bitmap vs. element for Y
    var scaleY = snakeboardCalculatedHeight / snakeboardMaxY;

    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;

    // Prevent the snake from reversing
    if (changingDirection) return;
    changingDirection = true;
    const goingUp = deltaY === -10;
    const goingDown = deltaY === 10;
    const goingRight = deltaX === 10;
    const goingLeft = deltaX === -10;

    // is the upper part of the canvas pressed and aren't we going down?
    const upPressed = (((snakeboardMaxY / 2) > y) && !((snakeboardMaxX / 4) > x) && !((snakeboardMaxX - (snakeboardMaxX / 4)) < x)) && !goingDown;
    // is the left part of the canvas pressed and aren't we going right?
    const leftPressed = ((snakeboardMaxX / 4) > x) && !goingRight;
    // is the down part of the canvas pressed and aren't we going up?
    const downPressed = (((snakeboardMaxY / 2) < y) && !((snakeboardMaxX / 4) > x) && !((snakeboardMaxX - (snakeboardMaxX / 4)) < x)) && !goingUp;
    // is the right part of the canvas pressed and aren't we going left?
    const rightPressed = ((snakeboardMaxX - (snakeboardMaxX / 4)) < x) && !goingLeft;

    // change direction based on the values
    changeDirection(upPressed, leftPressed, downPressed, rightPressed);
  }

  // called when the retry button is clicked
  function onRetry() {
    // if the player isn't alive, restart
    if (isGameEnded) {
      startGame();
    }
  }



  /* -------------------------
   * -------------------------
   * ------- Graphics --------
   * -------------------------
   * -------------------------
   */



  // resize the snakeboard, based on the size of the window
  function resizeSnakeboard() {
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

  // draw the canvas background
  function clearBoard() {
    //  select the color to fill the drawing
    snakeboardCtx.fillStyle = BOARD_BACKGROUND;
    // Draw a "filled" rectangle to cover the entire canvas
    snakeboardCtx.fillRect(0, 0, snakeboardMaxX, snakeboardMaxY);
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

  // draw the food
  function drawFood() {
    snakeboardCtx.fillStyle = currentFoodColor();
    snakeboardCtx.strokestyle = 'black';
    snakeboardCtx.fillRect(food_x, food_y, 10, 10);
    snakeboardCtx.strokeRect(food_x, food_y, 10, 10);
  }

  // update side status bar
  function updateSideBar() {
    var scores = [];
    var formattedScore = "";

    i = 0;
    // put all the scores and the player name in array
    for (var playerName in allSnakes) {
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
    for (var scoreKey in scores) {
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



  /* -------------------------
   * -------------------------
   * --------- Utils ---------
   * -------------------------
   * -------------------------
   */



  // get random color for our snake, that isn't used
  function getRandomColor() {
    var unusedColors = getUnusedColors();

    var color = unusedColors[randomInt(0, unusedColors.length - 1)];
    return color;
  }

  // get all colors, which aren't used by any player
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
    for (var colorName in COLORS) {
      if (!Array.from(usedColors).includes(COLORS[colorName])) {
        unusedColors[i] = COLORS[colorName];
        i++;
      }
    }

    // now we have a list of unused colors, which we can return
    return unusedColors;
  }

  // get the current "rainbow" food color
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

  // escape html specific characters (like < or >)
  function htmlEntities(str) {
      return String(str).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;');
  }

  // generate random integer
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

  // get the length of an iterable object
  function getArrayLength(array) {
    // looping threw all content of the all snakes, to get length
    var len = 0;
    for (var ignored in array) len++;
    return len;
  }



  /* -------------------------
   * -------------------------
   * ------ Multiplayer ------
   * -------------------------
   * -------------------------
   */



  // get the current online players
  function getOnlinePlayers() {
    return getArrayLength(allSnakes);
  }

  // check if there are more players online, then max player count
  function checkMaxPlayerCount() {
    // max 15 players
    while (getOnlinePlayers() >= MAX_PLAYERS) {
      alert("The game is full (15/15). Click the button, to retry.");
    }
  }

  // save the movement of other snakes to array
  function handleOtherSnakes() {
    for (var playerName in otherSnakes) {
      var otherSnake = otherSnakes[playerName];

      if (otherSnake == null || otherSnake["pos"] == null) continue;

       // update each parts
      otherSnake["pos"].forEach(part => drawSnakePart(otherSnake["color"] == null ? "red" : otherSnake["color"], part));
    }
  }

  // check if the player collides with any other player
  function checkForCollisionWithOtherSnakes() {
    for (var playerName in otherSnakes) {
      var otherSnake = otherSnakes[playerName]["pos"];

      if (otherSnake == null) continue;

      // player collided?
      for (var i = 0; i < otherSnake.length; i++) {
        if (otherSnake[i].x === snake[0].x && otherSnake[i].y === snake[0].y) return true;
      }
    }
    return false;
  }

  // save our playerdata to database
  function setPlayerData(snakeData) {
    if (isInvisible) snakeData = [];
    firebase.database().ref("snake/players/" + name + "/pos").set(snakeData);
  }

  // save a new food position
  function setFoodPos(x, y) {
    firebase.database().ref("snake/food").set({
      "x": x,
      "y": y
    });
    return false;
  }

  // set the listeners for firebase
  function setFireBaseListeners() {
    // value of food changed, update it
    firebase.database().ref("snake/food").on("value", (snapshot) => {
      data = snapshot.val();
      food_x = data["x"];
      food_y = data["y"];
    });

    // listen for other snake(s) changes
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



  /* -------------------------
   * -------------------------
   * --------- Main ----------
   * -------------------------
   * -------------------------
   */



  function main() {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    // listener for key press and window resize
    document.addEventListener("keydown", onKeyPress);
    window.addEventListener("resize", onResizeWindow, false);
    snakeboard.addEventListener("click", onSnakeboardClick);

    // first resize manually
    onResizeWindow();

    setFireBaseListeners();

    waitForPlayerData();
  }

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

    // first reset the last graphics update time
    timeLastGraphicsUpdate = Date.now();

    // then start the main loop
    loop();

    // starting the game
    startGame();
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
}();