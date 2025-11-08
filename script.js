! function() {
  const VERSION = 24;

  const BOARD_BACKGROUND = "#555555";

  const COLORS = ["Aqua", "Yellow", "Red", "Black", "White", "DeepPink", "LawnGreen", "Orange",
  "SaddleBrown", "OrangeRed", "DarkViolet", "Gold", "Indigo", "Silver", "DarkGreen"];

  // the delay between snake updates in ms
  const SNAKE_UPDATE_DELAY = 100;

  // the food levels
  const FOOD_LEVEL_RANDOM = 0;
  const FOOD_LEVEL_LESS = 1;
  const FOOD_LEVEL_MEDIUM = 2;
  const FOOD_LEVEL_MUCH = 3;

  // the food colors for the levels
  const FOOD_LEVEL_LESS_COLOR = 175;
  const FOOD_LEVEL_MEDIUM_COLOR = 110;
  const FOOD_LEVEL_MUCH_COLOR = 0;
  const FOOD_LEVEL_RANDOM_COLOR = -1;

  // max player count (currently, set to the amount of colors, available)
  const MAX_PLAYERS = COLORS.length;

  // the meaning of the headDir field in the snake object
  const HEAD_DIR_NO_CHANGE = -1;
  const HEAD_DIR_UP = 0;
  const HEAD_DIR_LEFT = 1;
  const HEAD_DIR_DOWN = 2;
  const HEAD_DIR_RIGHT = 3;

  // Get the canvas element
  const snakeboard = document.getElementById("snakeboard");
  // Return a two dimensional drawing context
  const snakeboardCtx = snakeboard.getContext("2d");

  // set the coordinate system dimensions (always 16:9)
  const snakeboardMaxX = 1280;
  const snakeboardMaxY = 720;

  // the default snake move delta and snake square size
  const DELTA = 20;


  // is the version checking finished?
  var versionChecked = false;

  // the db version
  var dbVersion = 0;

  // the time of the last graphics update
  var timeLastGraphicsUpdate = 0;

  // is the game ended?
  var isGameEnded = false;

  // countdown before start
  var countdown = 6;

  // can we send data to database (we should be invisible for other players
  // in countdown sequence, but visible for ourself)
  var isInvisibleForOthers = true;

  // our snake color
  var mySnakeCol;

  // in which direction our head is facing
  var myHeadDir = HEAD_DIR_RIGHT;

  // the head dir that will be applied at the next move
  var requestedHeadDir = HEAD_DIR_NO_CHANGE;

  // the head dir that will be applied at the next next move, used to cache input to make input smoother
  var requestedNextHeadDir = HEAD_DIR_NO_CHANGE;

  // the player name
  var name = "";

  // is the name already set and checked from db?
  var nameQuerySuccess = false;

  // our snake
  var snake = [];

  // the last score we had, to display it after death in title
  var lastScore = 0;

  // horizontal snake move delta
  var deltaX = DELTA;

  // vertical snake move delta
  var deltaY = 0;

  // the other players
  var otherSnakes = [];

  // the last snake updates with timestamps from this browser, so a wrong browser time does not affect offline kicking
  var otherSnakesLastUpdates = [];

  // used to count online (registered) players
  var allSnakes = [];

  // was the other snake data initialized from db?
  var firstInitOtherSnakes = false;

  // food positions
  var foods = [];

  // how long should the snake tail stay in place, after a food was eaten?
  var tailWaitCount = 0;

  // color of food (it will be in rainbow mode)
  var foodLightness = 0;

  // if not negative, only this type of food will spawn
  var forcedFoodLevel = -1;

  // food count multiplied by this factor
  var foodFactor = 1;

  // the calculated width and height of the canvas (based on screen size)
  var snakeboardCalculatedWidth;
  var snakeboardCalculatedHeight;

  // the last update we received from the db (to check if other player is lagging or we are)
  var lastOwnDBUpdate = -1;

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

  // main connection to the firebase database
  var firebaseMain;

  // used to check if other player or ourself is lagging
  var firebaseOnlineChecker;



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
    isInvisibleForOthers = true;
    snake = generateRandomSnake();
    // reset game isn't ended
    isGameEnded = false;

    // reset go direction
    changeDir(true, HEAD_DIR_RIGHT);

    // start the countdown
    startCountdown();
  }

  // show countdown
  function startCountdown() {
    countdown--;
    if (countdown > 0 && countdown <= 3) {
      // countdown visible
      sendInfo(countdown);
      //document.getElementById('status').innerHTML = countdown;
      setTimeout(startCountdown, 500);
      return;
    } else if (countdown > 0) {
      // "Get ready!" visible
      //document.getElementById('status').innerHTML = "Get ready!";
      sendInfo("Get ready!");
      setTimeout(startCountdown, 500);
      return;
    } else {
      // if there is a snake on our position, wait for it to go away
      if (checkForCollisionWithOtherSnakes()) {
        countdown = -1;
        //document.getElementById('status').innerHTML = "Waiting for other snake to go away...";
        sendInfo("Waiting for other snake to go away...", color="Red");
        setTimeout(startCountdown, 50);
        return;
      }

      // countdown is finished, we don't need to wait
      countdown = 0;

      isInvisibleForOthers = false;

      // "Go" visible for 3 secs
      sendInfo("Go!", 3000);
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
        tick();
      }

      // send playerdata just once after the for loop, if snake is set
      if (snake.length != 0) setPlayerData(snake);

      // set the last update time to now
      timeLastGraphicsUpdate = Date.now();

      // send last update time to DB so that other players know if this player is still active
      setLastUpdate(timeLastGraphicsUpdate);

      // only run if we are not behind the db ourself
      if (Math.round(Date.now() / 1000) - lastOwnDBUpdate < 5) {
        // check if all other players are actually still active. If not, we delete the entries from the DB.
        for (var playerName in otherSnakesLastUpdates) {
          // inactive for 10 seconds
          if (Math.round(Date.now() / 1000) - otherSnakesLastUpdates[playerName] > 10) {
            // delete the entry
            firebaseMain.ref("snake/players/" + playerName).remove();
          }
        }
      } else {
        alert("Connection lost.");
        location.reload();
        return;
      }
    }

    updateSideBar();

    clearBoard();
    drawFoods();
    handleOtherSnakes();

    // we always need to draw the snake, so if it's there, it will be shown
    drawSnake();

    // retry button clicked
    if (retryClicked) {
      retryClicked = false;
      onRetry();
    }

    setTimeout(loop, 5);
  }

  // tick the game
  function tick() {
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
      var currentPart = i * DELTA;
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

    // did we ate food?
    const ateFood = hasEatenFood();

    if (ateFood) {
      // handle collection of food and get the count, how many parts must be added
      var count = foodLevelToCount(handleFoodCollect()) - 1;

      if (count < 0) {
        // we need to remove parts
        for (var i = 0; i > count; i--) {
          // but if the snake has just a length of 1, we don't remove more
          if (getArrayLength(snake) == 1) break;
          snake.pop();
        }
      } else {
        // we need to add parts, so add the count to our wait count so the end will stop
        // and wait until the var is zero again
        tailWaitCount += count;
      }

      count++;

      // show the player, how many points he got/lost
      if (count > 0) {
        sendInfo("+" + count, 1000, "LimeGreen");
      } else if (count == 0) {
        sendInfo("0", 1000);
      } else if (count < 0) {
        sendInfo(count, 1000, "Red");
      }
    } else if (tailWaitCount <= 0) {
      // remove the last part of snake body
      snake.pop();
    } else {
      tailWaitCount--;
    }

    requestedHeadDir = requestedNextHeadDir;
    requestedNextHeadDir = HEAD_DIR_NO_CHANGE;
    changeDir(false);
  }

  // change the "walking" direction of the snake
  function userChangeDirection(up, left, down, right) {
    var newHeadDir;

    // going up
    if (up) {
      newHeadDir = HEAD_DIR_UP;
    // going left
    } else if (left) {
      newHeadDir = HEAD_DIR_LEFT;
    // going down
    } else if (down) {
      newHeadDir = HEAD_DIR_DOWN;
    // going right
    } else if (right) {
      newHeadDir = HEAD_DIR_RIGHT;
    }

    console.log(newHeadDir);

    changeDir(false, newHeadDir);
  }

  function changeDir(force, newHeadDir = HEAD_DIR_NO_CHANGE) {
    // if game is not started yet
    if (countdown != 0) {
      force = true;
    }

    if (!force && newHeadDir != HEAD_DIR_NO_CHANGE) {
      // save the requested input. if there already is one saved, save also one future requested input to make input smoother
      if (requestedHeadDir == HEAD_DIR_NO_CHANGE) {
        requestedHeadDir = newHeadDir;
      } else {
        requestedNextHeadDir = newHeadDir;
      }
      newHeadDir = requestedHeadDir;
    } else if (force) {
      requestedHeadDir = HEAD_DIR_NO_CHANGE;
      requestedNextHeadDir = HEAD_DIR_NO_CHANGE;
    } else {
      newHeadDir = requestedHeadDir;
    }

    switch (newHeadDir) {
      case HEAD_DIR_UP:
        deltaX = 0;
        deltaY = -DELTA;
        break;

      case HEAD_DIR_LEFT:
        deltaX = -DELTA;
        deltaY = 0;
        break;

      case HEAD_DIR_DOWN:
        deltaX = 0;
        deltaY = DELTA;
        break;

      case HEAD_DIR_RIGHT:
        deltaX = DELTA;
        deltaY = 0;
        break;

      default:
        break;
    }

    myHeadDir = newHeadDir == HEAD_DIR_NO_CHANGE ? myHeadDir : newHeadDir;
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
    const hitRightWall = snake[0].x > snakeboardMaxX - DELTA;
    const hitToptWall = snake[0].y < 0;
    const hitBottomWall = snake[0].y > snakeboardMaxY - DELTA;
    return hitLeftWall || hitRightWall || hitToptWall || hitBottomWall;
  }

  // check if a player has eaten a food
  function hasEatenFood() {
    var ateFood = false;
    for (var foodKey in foods) {
      var food = foods[foodKey];
      if(snake[0].x === food.x && snake[0].y === food.y) {
        ateFood = true;
        break;
      }
    }

    return ateFood;
  }

  // save a new food position
  function addFood(x, y, level) {
    foods[foods.length] = {
      "x": x,
      "y": y,
      "level": level,
      "uuid": crypto.randomUUID()
    };

    updateFoods();
  }

  // remove a food, this will also return the level of the food removed
  function removeFood(x, y) {
    // the new food data
    var newFoods = [];
    // the food level of the removed food
    var foodLevel = FOOD_LEVEL_RANDOM;

    i = 0;
    for (var foodKey in foods) {
      var food = foods[foodKey];
      // getting the data of the other food
      foodX = food.x;
      foodY = food.y;

      // if the data isn't equal to our data, we will add it to the new list
      if (x != foodX || y != foodY) {
        newFoods[i] = food;
        i++;
      } else foodLevel = food.level;
    }

    // update the food array
    foods = newFoods;
    updateFoods();

    return foodLevel;
  }

  // handle the collection of food, this will also return the level of the removed food
  function handleFoodCollect() {
    // removing old food
    var removedOldFoodLevel = removeFood(snake[0].x, snake[0].y);

    // creating new food
    var foodCount = Math.max(1, Math.round(getActivePlayers() / 2)) * foodFactor;
    foodCount = foodCount - foods.length;

    for (var i = 0; i < foodCount; i++) {
      var randomFood;
      var noFoodPosFound = true;

      // search for a food pos, which isn't in use
      while (noFoodPosFound) {
        randomFood = genFood();

        // there are no positions to check
        if (foods.length == 0)
          noFoodPosFound = false;

        // check all other food positions to avoid overlap
        for (var foodKey in foods) {
          var food = foods[foodKey];
          if (food.x != randomFood.x || food.y != randomFood.y)
            noFoodPosFound = false;
        }
      }

      // and add it
      addFood(randomFood.x, randomFood.y, randomFoodLevel());
    }

    return removedOldFoodLevel;
  }

  // generate a new random food location
  function genFood() {
    // Generate a random number the food x-coordinate
    var foodX = randomCoordinateX();
    // Generate a random number for the food y-coordinate
    var foodY = randomCoordinateY();

    // if the new food location is where the snake currently is, generate a new food location
    snake.forEach((part) => {
      const has_eaten = part.x == foodX && part.y == foodY;
      if (has_eaten) genFood();
    });

    // if the new food location is where another snake currently is, generate a new food location
    otherSnakes.forEach((part) => {
      const has_eaten = part.x == foodX && part.y == foodY;
      if (has_eaten) genFood();
    });

    return {"x": foodX, "y": foodY}
  }

  function dropRandomFood() {
    // don't drop, if player has score 0
    if (getArrayLength(snake) <= 5)
      return;

    for (var key in snake) {
      var pos = snake[key];

      // ignore this pos, if it is in the wall...
      if ((pos.x < 0 || pos.x > (snakeboardMaxX - DELTA))
          || (pos.y < 0 || pos.y > (snakeboardMaxY - DELTA)))
        continue;

      // drop random food at random positions in snake, ca. 16,67% probability to drop for each
      if (randomInt(0, 5) == 0)
        addFood(pos.x, pos.y, randomFoodLevel());
    }
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
    // drop random food from out snake
    dropRandomFood();
    snake = [];

    // show retry button and game over message
    //document.getElementById('status').style.visibility = 'visible';
    //document.getElementById('status').innerHTML = '<b><span style=\"color: tomato; display: inline;\"> Game Over!</span></b>';
    sendInfo("Game Over!", 0, "Red");

    document.getElementById('score').style.visibility = 'visible';
    document.getElementById('score').innerHTML = 'Your score: ' + lastScore + '<button id="buttonRetry" class="button retry" onclick="onRetryClick()">Retry (r)</button>';
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

    const keyPressed = event.keyCode;
    const goingUp = deltaY === -DELTA;
    const goingDown = deltaY === DELTA;
    const goingRight = deltaX === DELTA;
    const goingLeft = deltaX === -DELTA;

    // change direction based on pressed key
    userChangeDirection(((keyPressed === UP_KEY || keyPressed === W_KEY) && !goingDown),
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
    var canvas = snakeboard;
    // abs. size of element
    var rect = canvas.getBoundingClientRect();
    // relationship bitmap vs. element for X
    var scaleX = snakeboardCalculatedWidth / snakeboardMaxX;
    // relationship bitmap vs. element for Y
    var scaleY = snakeboardCalculatedHeight / snakeboardMaxY;

    const x = (e.touches[0].clientX - rect.left) / scaleX;
    const y = (e.touches[0].clientY - rect.top) / scaleY;

    const goingUp = deltaY === -DELTA;
    const goingDown = deltaY === DELTA;
    const goingRight = deltaX === DELTA;
    const goingLeft = deltaX === -DELTA;

    // is the upper part of the canvas pressed and aren't we going down?
    const upPressed = (((snakeboardMaxY / 2) > y) && !((snakeboardMaxX / 4) > x) && !((snakeboardMaxX - (snakeboardMaxX / 4)) < x)) && !goingDown;
    // is the left part of the canvas pressed and aren't we going right?
    const leftPressed = ((snakeboardMaxX / 4) > x) && !goingRight;
    // is the down part of the canvas pressed and aren't we going up?
    const downPressed = (((snakeboardMaxY / 2) < y) && !((snakeboardMaxX / 4) > x) && !((snakeboardMaxX - (snakeboardMaxX / 4)) < x)) && !goingUp;
    // is the right part of the canvas pressed and aren't we going left?
    const rightPressed = ((snakeboardMaxX - (snakeboardMaxX / 4)) < x) && !goingLeft;

    // change direction based on the values
    userChangeDirection(upPressed, leftPressed, downPressed, rightPressed);
  }

  // called when the retry button is clicked
  function onRetry() {
    // if the player isn't alive, restart
    if (isGameEnded) {
      document.getElementById('score').style.visibility = 'hidden';
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
    var widthMax = window.innerWidth * 0.8 - 32;
    var heightMax = window.innerHeight * 0.86 - 16;
    

    // calculate aspect ratio
    var aspectRatio = snakeboardMaxX / snakeboardMaxY;

    // only allow the smallest width, to be full size
    var widthFactorMax = snakeboardMaxX / widthMax;
    var heightFactorMax = snakeboardMaxY / heightMax;

    // the other size (which is too big to fit on the monitor) will shrink,
    // but it will also consider the aspect ratio
    if (widthFactorMax > heightFactorMax) {
      snakeboardCalculatedWidth = widthMax;
      snakeboardCalculatedHeight = widthMax / aspectRatio;
    } else if (heightFactorMax > widthFactorMax) {
      snakeboardCalculatedWidth = heightMax * aspectRatio;
      snakeboardCalculatedHeight = heightMax;
    } else {
      snakeboardCalculatedWidth = widthMax;
      snakeboardCalculatedHeight = heightMax;
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
    var headDir = myHeadDir;
    snake.forEach(part => {
      drawSnakePart(mySnakeCol, part, headDir);
      headDir = undefined;
    })
  }

  // Draw one snake part
  function drawSnakePart(snake_col, snakePart, headDir) {
    // Set the color of the snake part
    snakeboardCtx.fillStyle = snake_col;
    // Set the border color of the snake part
    snakeboardCtx.strokestyle = "black";

    // Draw a "filled" rectangle to represent the snake part at the coordinates
    // the part is located
    snakeboardCtx.fillRect(snakePart.x, snakePart.y, DELTA, DELTA);
    // Draw a border around the snake part
    snakeboardCtx.strokeRect(snakePart.x, snakePart.y, DELTA, DELTA);

    if (headDir != undefined) {
      snakeboardCtx.fillStyle = snake_col.toLowerCase() === "black" ? "white" : "black";
      snakeboardCtx.beginPath();

      switch (headDir) {
        case HEAD_DIR_UP:
          snakeboardCtx.moveTo(snakePart.x + DELTA / 2, snakePart.y + 1);
          snakeboardCtx.lineTo(snakePart.x, snakePart.y + DELTA * 0.25 + 1);
          snakeboardCtx.lineTo(snakePart.x + DELTA, snakePart.y + DELTA * 0.25 + 1);
          break;

        case HEAD_DIR_LEFT:
          snakeboardCtx.moveTo(snakePart.x + 1, snakePart.y + DELTA / 2);
          snakeboardCtx.lineTo(snakePart.x + DELTA * 0.25 + 1, snakePart.y);
          snakeboardCtx.lineTo(snakePart.x + DELTA * 0.25 + 1, snakePart.y + DELTA);
          break;
        
        case HEAD_DIR_DOWN:
          snakeboardCtx.moveTo(snakePart.x + DELTA / 2, snakePart.y + DELTA - 1);
          snakeboardCtx.lineTo(snakePart.x, snakePart.y + DELTA * 0.75 - 1);
          snakeboardCtx.lineTo(snakePart.x + DELTA, snakePart.y + DELTA * 0.75 - 1);
          break;

        case HEAD_DIR_RIGHT:
          snakeboardCtx.moveTo(snakePart.x + DELTA - 1, snakePart.y + DELTA / 2);
          snakeboardCtx.lineTo(snakePart.x + DELTA * 0.75 - 1, snakePart.y);
          snakeboardCtx.lineTo(snakePart.x + DELTA * 0.75 - 1, snakePart.y + DELTA);
          break;
      
        default:
          break;
      }

      snakeboardCtx.closePath();
      snakeboardCtx.fill();
    }
  }

  // draw the food
  function drawFoods() {
    // draw all the foods
    for (var foodKey in foods) {
      var food = foods[foodKey];

      snakeboardCtx.fillStyle = currentFoodLightness(getFoodColorByLevel(food.level));
      snakeboardCtx.strokestyle = 'black';
      snakeboardCtx.fillRect(food.x, food.y, DELTA, DELTA);
      snakeboardCtx.strokeRect(food.x, food.y, DELTA, DELTA);
    }

    // increase lightness
    foodLightness++;
  }

  // update side status bar
  function updateSideBar() {
    var scores = [];
    var formattedScore = "";

    i = 0;
    // put all the scores and the player name in array
    for (var playerName in allSnakes) {
      var score = ((getArrayLength(allSnakes[playerName]["pos"]) - 5));
      lastScore = score >= 0 && playerName == name ? score : lastScore;

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
      formattedScore += "<span id=\"scoreboard\" style=\"color:" + snakeData["color"] + ";\">"
      + htmlEntities(playerName) + "</span>: " + (score < -4 ? "Spectator" : score) + "<br>";
    }

    document.getElementById('sidebar').innerHTML = "Online: " + getOnlinePlayers() + "/15<br><br>"
      + formattedScore;
  }

  // send an info to the status display
  function sendInfo(str, duration=0, color="Black") {
    // show
    //document.getElementById('status').style.visibility = 'visible';
    // set text
    var content = '<div id="innerStatus" style="color: ' + color + ';">' + str + '</div>';
    document.getElementById('status').innerHTML = content;
    if (duration > 0) {
      setTimeout(() => {
        // hide, if the innerHTML is still the given string and color
        if (document.getElementById('status').innerHTML === content)
        document.getElementById('status').innerHTML = '<div id="innerStatus" style="color: transparent;">42</div';
      }, duration);
    }
  }



  /* -------------------------
   * -------------------------
   * --------- Utils ---------
   * -------------------------
   * -------------------------
   */



  // check if the version is equal to the version of the database
  function handleVersionCheck() {
    if (dbVersion > VERSION) {
      // clear our snake from db
      snake = [];
      setPlayerData([]);

      // client outdated
      alert("Client outdated. Click OK to reload the page and try again.\n\n"
          + "If reloading doesn't work after some waiting, try pressing CTRL+SHIFT+R or delete all cookies and data from this page.");

      try {
        location.reload(true);
      } catch {
        location.reload();
      }
    } else if (dbVersion < VERSION) {
      // clear our snake from db
      snake = [];
      setPlayerData([]);

      // db outdated
      alert("Database outdated. Please wait for the database to update.");
      location.reload();
    }

    versionChecked = true;
  }

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

  // get the current food color with the blink effect
  function currentFoodLightness(foodColor) {
    // prevent lightness from being to big
    if (foodLightness > 50) {
      foodLightness = -50;
    }

    var hsv = {
      h: foodColor == FOOD_LEVEL_RANDOM_COLOR ? ((foodLightness + 50) / 100) * 360 : foodColor,
      s: 100,
      v: foodColor == FOOD_LEVEL_RANDOM_COLOR ? 100 : Math.abs(foodLightness) + 50,
    };
    var color = Color( hsv );

    return color.toString();
  }

  // get the color for a food by the food level
  function getFoodColorByLevel(level) {
    switch (level) {
      case FOOD_LEVEL_LESS:
        return FOOD_LEVEL_LESS_COLOR;
      case FOOD_LEVEL_MEDIUM:
        return FOOD_LEVEL_MEDIUM_COLOR;
      case FOOD_LEVEL_MUCH:
        return FOOD_LEVEL_MUCH_COLOR;
      case FOOD_LEVEL_RANDOM:
        return FOOD_LEVEL_RANDOM_COLOR;
      default:
        return 0;
    }
  }

  function randomFoodLevel() {
    // if there is a food level forced by database, use it
    if (forcedFoodLevel >= 0) {
      return forcedFoodLevel;
    }

    var rnd = randomInt(0, 300);

    if (rnd >= 0 && rnd < 100) {
      // less and medium are most common
      return FOOD_LEVEL_LESS;
    } else if (rnd >= 100 && rnd < 200) {
      // less and medium are most common
      return FOOD_LEVEL_MEDIUM;
    } else if (rnd >= 200 && rnd < 250) {
      // much and random are less common
      return FOOD_LEVEL_MUCH;
    } else {
      // much and random are less common
      return FOOD_LEVEL_RANDOM;
    }
  }

  // convert the food level count to the count of the parts that must be added/removed
  function foodLevelToCount(level) {
    if (level == 0) {
      return randomInt(-5, 10);
    }
    return level;
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
    return Math.round(randomInt(min * DELTA, snakeboardMaxX - DELTA) / DELTA) * DELTA;
  }

  // get random coordinate for y on the board
  function randomCoordinateY() {
    return Math.round(randomInt(0, snakeboardMaxY - DELTA) / DELTA) * DELTA;
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

  // get the players, currently playing
  function getActivePlayers() {
    var count = 0;

    // go threw all snakes
    for (var playerName in allSnakes) {
      var snake = allSnakes[playerName];

      // check if the snake is playing, by checking if there are positions set
      if (snake.pos != null && getArrayLength(snake.pos) != 0) count++;
    }

    return count
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

      var headDir = otherSnake["headDir"];
      // update each parts
      otherSnake["pos"].forEach(part => {
        drawSnakePart(otherSnake["color"] == null ? "red" : otherSnake["color"], part, headDir);
        headDir = undefined;
      });
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
    if (isInvisibleForOthers) snakeData = [];
    if (name) {
      firebaseMain.ref("snake/players/" + name + "/pos").set(snakeData);
      firebaseMain.ref("snake/players/" + name + "/headDir").set(myHeadDir);
    }
  }

  // save our playerdata to database
  function setLastUpdate() {
    // only update every second
    let sec = Math.round(Date.now() / 1000);

    firebaseMain.ref("snake/players/" + name + "/lastUpdate").set(sec);
  }

  // save the foods data to database
  function updateFoods() {
    firebaseMain.ref("snake/foods").set(foods);
  }

  // set the listeners for firebase
  function setFireBaseListeners() {
    // value of foods changed, update it
    firebaseMain.ref("snake/foods").on("value", (snapshot) => {
      data = snapshot.val();
      foods = data == null ? [] : data;
    });

    // the food spawn type is forced by database
    firebaseMain.ref("snake/variables/forcedFoodLevel").on("value", (snapshot) => {
      data = snapshot.val();
      forcedFoodLevel = data == null ? -1 : data;
    });

    // the food factor is changed
    firebaseMain.ref("snake/variables/foodFactor").on("value", (snapshot) => {
      data = snapshot.val();
      foodFactor = data == null ? 1 : data;
    });

    // listen for other snake(s) changes
    firebaseMain.ref("snake/players").on("value", (snapshot) => {
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
          mySnakeCol = data[playerName]["color"];
          continue;
        }
        newArray[playerName] = data[playerName];

        // check if the other snake updated since last run
        if (otherSnakes[playerName] && newArray[playerName]["lastUpdate"] != otherSnakes[playerName]["lastUpdate"]) {
          otherSnakesLastUpdates[playerName] = Math.round(Date.now() / 1000);
        }
      }

      otherSnakes = newArray;
      // used to count online (registered) players
      allSnakes = data;
      firstInitOtherSnakes = true;
    });

    // listen again, but this time for checking if time stamp sent via firebaseMain is
    // received via firebaseOnlineChecker therfore checking if it is us that is lagging or another player
    // listen for other snake(s) changes
    firebaseOnlineChecker.ref("snake/players/" + name).on("value", (snapshot) => {
      data = snapshot.val();
      if (data == null) {
        return;
      }
      for (var playerName in data) {
        if (playerName == name) {
          let newUpdate = data[playerName]["lastUpdate"];
          // check when the database last registered input from us
          lastOwnDBUpdate = newUpdate > 0 ? newUpdate : lastOwnDBUpdate;
          break;
        }
      }
    });
  }



  /* -------------------------
   * -------------------------
   * --------- Main ----------
   * -------------------------
   * -------------------------
   */



  function main() {
    // first resize manually
    onResizeWindow();

    alert("We use cookies. By using this site, you agree with it.\n"
      + "\n"
      + "We use the Realtime Database of Google Firebase, to serve multiplayer. If you want to know how Google proceeds your data, look on their page: https://firebase.google.com/support/privacy/\n"
      + "\n"
      + "If you don't want to agree, close this site. No data has been saved yet.");

    // Initialize Firebase
    const app1 = firebase.initializeApp(firebaseConfig);
    const app2 = firebase.initializeApp(firebaseConfig, "OnlineCheck");

    firebaseMain = firebase.database(app1);
    firebaseOnlineChecker = firebase.database(app2);

    // always get the version of db
    firebaseMain.ref("snake/variables/version").on("value", (snapshot) => {
      data = snapshot.val();
      dbVersion = parseInt(data, 10);

      // handle version check
      handleVersionCheck();
    });

    // and wait for receiving data
    waitForVersionCheck();
  }

  // waiting for the version check
  function waitForVersionCheck() {
    if (!versionChecked) {
      setTimeout(waitForVersionCheck, 50);
      return;
    }

    // listener for key press, window resize and snakeboard touch
    document.addEventListener("keydown", onKeyPress);
    window.addEventListener("resize", onResizeWindow, false);
    snakeboard.addEventListener("touchstart", onSnakeboardClick);
    window.addEventListener("keydown", function(e) {
                if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1){
                    e.preventDefault();
                }
            }, false);

    // second resize manually
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

    // name set successfully, we can run the game now  and we need to save the name
    // in a separate key to get access to write our data later, this will also restrict
    // the access to this entry only for us
    firebaseMain.ref("snake/players/" + name + "/verifyName").set(name);

    // if player disconnect, remove data
    firebaseMain.ref("snake/players/" + name).onDisconnect().remove();

    // generate random color for us
    mySnakeCol = getRandomColor();

    firebaseMain.ref("snake/players/" + name + "/color").set(mySnakeCol);

    // handle food, if this is the first player
    if (foods.length == 0)
      addFood(randomCoordinateX(), randomCoordinateY(), randomFoodLevel());

    // first reset the last graphics update and db update time
    timeLastGraphicsUpdate = Date.now();
    lastOwnDBUpdate = Math.round(Date.now() / 1000);

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

      firebaseMain.ref("snake/players/" + name + "/color").get().then((snapshot) => {
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
