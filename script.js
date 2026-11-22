// SETTINGS

const API_URL = "https://opentdb.com/api.php";
const QUESTIONS_PER_GAME = 10;
const SECONDS_PER_QUESTION = 15;
const URGENT_SECONDS = 5;              // timer turns red at or below this
const MIN_FETCH_GAP = 5000;            // the API allows about 1 request every 5 seconds
const BEST_SCORE_KEY = "quizBestScore";


// CLASSES
// An error whose message is safe and friendly to show to the player
class QuizError extends Error {}

class Question {
  constructor(text, correctAnswer, options) {
    this.text          = text;
    this.correctAnswer = correctAnswer;
    this.options       = options;       // correct + incorrect answers, already shuffled
  }

  isCorrect(answer) {
    return answer === this.correctAnswer;
  }
}

class Quiz {
  constructor(questions) {
    this.questions    = questions;
    this.currentIndex = 0;
    this.score        = 0;
  }

  getCurrentQuestion() {
    return this.questions[this.currentIndex];
  }

  // Returns true or false, and adds a point when the answer is right
  checkAnswer(answer) {
    const correct = this.getCurrentQuestion().isCorrect(answer);
    if (correct) {
      this.score++;
    }
    return correct;
  }

  nextQuestion() {
    this.currentIndex++;
  }

  isFinished() {
    return this.currentIndex >= this.questions.length;
  }
}


// DOM ELEMENTS


const startScreen   = document.getElementById("start-screen");
const quizScreen    = document.getElementById("quiz-screen");
const resultsScreen = document.getElementById("results-screen");

const categorySelect   = document.getElementById("category-select");
const difficultySelect = document.getElementById("difficulty-select");
const startBtn         = document.getElementById("start-btn");
const loadingMsg       = document.getElementById("loading-msg");
const errorBox         = document.getElementById("error-box");
const errorMsg         = document.getElementById("error-msg");
const retryBtn         = document.getElementById("retry-btn");
const bestScoreText    = document.getElementById("best-score");

const progressText = document.getElementById("progress-text");
const scoreText    = document.getElementById("score-text");
const timerBar     = document.getElementById("timer-bar");
const timerText    = document.getElementById("timer-text");
const questionText = document.getElementById("question-text");
const answersBox   = document.getElementById("answers");
const feedback     = document.getElementById("feedback");
const nextBtn      = document.getElementById("next-btn");

const finalScore    = document.getElementById("final-score");
const finalPercent  = document.getElementById("final-percent");
const resultMessage = document.getElementById("result-message");
const newBestBadge  = document.getElementById("new-best");
const playAgainBtn  = document.getElementById("play-again-btn");


// STATE

let quiz          = null;
let timerId       = null;
let timeLeft      = SECONDS_PER_QUESTION;
let isLoading     = false;
let lastFetchTime = 0;


// HELPERS


// Fisher-Yates shuffle — returns a new shuffled array
function shuffle(items) {
  const copy = items.slice();

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

// The API sends URL-encoded text (encode=url3986), so decode it back to normal text
function decode(text) {
  return decodeURIComponent(text);
}

function showScreen(screen) {
  startScreen.classList.add("hidden");
  quizScreen.classList.add("hidden");
  resultsScreen.classList.add("hidden");
  screen.classList.remove("hidden");
}

function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}


// BEST SCORE (localStorage)

function getBestScore() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch (error) {
    return 0;       // localStorage can be blocked in private browsing
  }
}

function saveBestScore(score) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, score);
  } catch (error) {
    // Nothing to do — the game still works without a saved best score
  }
}

function showBestScore() {
  const best = getBestScore();

  if (best > 0) {
    bestScoreText.textContent = "Best score: " + best + " / " + QUESTIONS_PER_GAME;
  } else {
    bestScoreText.textContent = "Best score: none yet";
  }
}


// FETCHING QUESTIONS

// Turn one API result into a Question object
function buildQuestion(item) {
  const correct   = decode(item.correct_answer);
  const incorrect = item.incorrect_answers.map(decode);

  // True / False questions keep their usual order; multiple choice is shuffled
  const options = decode(item.type) === "boolean"
    ? ["True", "False"]
    : shuffle(incorrect.concat(correct));

  return new Question(decode(item.question), correct, options);
}

// If the last request was less than 5 seconds ago, wait before sending another
async function waitForRateLimit() {
  const remaining = lastFetchTime + MIN_FETCH_GAP - Date.now();

  if (remaining > 0) {
    await wait(remaining);
  }
}

async function fetchQuestions(category, difficulty) {
  const params = new URLSearchParams({
    amount: QUESTIONS_PER_GAME,
    encode: "url3986"
  });

  if (category) {
    params.set("category", category);
  }
  if (difficulty) {
    params.set("difficulty", difficulty);
  }

  await waitForRateLimit();
  lastFetchTime = Date.now();

  let response;
  try {
    response = await fetch(API_URL + "?" + params.toString());
  } catch (error) {
    throw new QuizError("Could not reach the quiz server. Check your internet connection and try again.");
  }

  // 1. Check the HTTP response
  if (!response.ok) {
    if (response.status === 429) {
      throw new QuizError("Too many requests. Please wait a few seconds and try again.");
    }
    throw new QuizError("The quiz server had a problem (error " + response.status + "). Please try again.");
  }

  const data = await response.json();

  // 2. Check the API's own response_code (0 means success)
  if (data.response_code === 1) {
    throw new QuizError("There are not enough questions for that category and difficulty. Try different options.");
  }
  if (data.response_code === 5) {
    throw new QuizError("Too many requests. Please wait a few seconds and try again.");
  }
  if (data.response_code !== 0) {
    throw new QuizError("Something went wrong while loading the questions. Please try again.");
  }

  return data.results.map(buildQuestion);
}


// START SCREEN

function setLoading(loading) {
  isLoading = loading;
  startBtn.disabled         = loading;       // stops a second click while loading
  categorySelect.disabled   = loading;
  difficultySelect.disabled = loading;
  loadingMsg.classList.toggle("hidden", !loading);
}

function showError(message) {
  errorMsg.textContent = message;
  errorBox.classList.remove("hidden");
}

async function startQuiz() {
  if (isLoading) {
    return;
  }

  errorBox.classList.add("hidden");
  setLoading(true);

  try {
    const questions = await fetchQuestions(categorySelect.value, difficultySelect.value);
    quiz = new Quiz(questions);
    showScreen(quizScreen);
    showQuestion();
  } catch (error) {
    if (error instanceof QuizError) {
      showError(error.message);
    } else {
      showError("Something went wrong. Please try again.");
    }
  } finally {
    setLoading(false);
  }
}


// TIMER

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerDisplay() {
  const urgent = timeLeft <= URGENT_SECONDS;

  timerText.textContent = timeLeft + "s";
  timerBar.style.width  = (timeLeft / SECONDS_PER_QUESTION) * 100 + "%";
  timerBar.classList.toggle("urgent", urgent);
  timerText.classList.toggle("urgent", urgent);
}

function startTimer() {
  stopTimer();                       // never leave two timers running
  timeLeft = SECONDS_PER_QUESTION;
  updateTimerDisplay();

  timerId = setInterval(function () {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      handleTimeUp();
    }
  }, 1000);
}


// QUIZ SCREEN


function showQuestion() {
  const question = quiz.getCurrentQuestion();
  const isLast   = quiz.currentIndex === quiz.questions.length - 1;

  progressText.textContent = "Question " + (quiz.currentIndex + 1) + " of " + quiz.questions.length;
  scoreText.textContent    = "Score: " + quiz.score;
  questionText.textContent = question.text;

  feedback.textContent = "";
  feedback.className   = "feedback";

  nextBtn.textContent = isLast ? "See Results" : "Next";
  nextBtn.disabled    = true;

  // Create the answer buttons with JavaScript
  answersBox.innerHTML = "";

  question.options.forEach(function (option) {
    const button = document.createElement("button");
    button.className   = "answer-btn";
    button.textContent = option;
    button.addEventListener("click", function () {
      handleAnswer(button, option);
    });
    answersBox.appendChild(button);
  });

  startTimer();
}

// Disable every answer button and highlight the correct one in green
function revealCorrectAnswer() {
  const correctAnswer = quiz.getCurrentQuestion().correctAnswer;
  const buttons       = answersBox.querySelectorAll(".answer-btn");

  buttons.forEach(function (button) {
    button.disabled = true;

    if (button.textContent === correctAnswer) {
      button.classList.add("correct");
    }
  });
}

function handleAnswer(clickedButton, answer) {
  stopTimer();

  const isCorrect = quiz.checkAnswer(answer);

  // Color the clicked answer first, then reveal the right one
  clickedButton.classList.add(isCorrect ? "correct" : "wrong");
  revealCorrectAnswer();

  if (isCorrect) {
    feedback.textContent = "Correct!";
    feedback.className   = "feedback correct";
  } else {
    feedback.textContent = "Wrong. The correct answer is " + quiz.getCurrentQuestion().correctAnswer + ".";
    feedback.className   = "feedback wrong";
  }

  scoreText.textContent = "Score: " + quiz.score;
  nextBtn.disabled      = false;
  nextBtn.focus();
}

function handleTimeUp() {
  stopTimer();

  quiz.checkAnswer(null);              // no answer given, so it counts as wrong
  revealCorrectAnswer();

  feedback.textContent = "Time's up! The correct answer is " + quiz.getCurrentQuestion().correctAnswer + ".";
  feedback.className   = "feedback timeup";

  nextBtn.disabled = false;
  nextBtn.focus();
}

function handleNext() {
  stopTimer();
  quiz.nextQuestion();

  if (quiz.isFinished()) {
    showResults();
  } else {
    showQuestion();
  }
}


// RESULTS SCREEN


function showResults() {
  const total   = quiz.questions.length;
  const percent = Math.round((quiz.score / total) * 100);

  let message;
  if (percent >= 80) {
    message = "Great job!";
  } else if (percent >= 50) {
    message = "Good effort! Keep practising.";
  } else {
    message = "Keep practising. You will get there!";
  }

  finalScore.textContent    = quiz.score + " / " + total;
  finalPercent.textContent  = percent + "%";
  resultMessage.textContent = message;

  // Save the best score
  const isNewBest = quiz.score > getBestScore();
  if (isNewBest) {
    saveBestScore(quiz.score);
  }
  newBestBadge.classList.toggle("hidden", !isNewBest);

  showScreen(resultsScreen);
}

function playAgain() {
  stopTimer();
  quiz = null;

  categorySelect.value   = "";
  difficultySelect.value = "";
  errorBox.classList.add("hidden");

  showBestScore();
  showScreen(startScreen);
}


// EVENT LISTENERS


startBtn.addEventListener("click", startQuiz);
retryBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", handleNext);
playAgainBtn.addEventListener("click", playAgain);

showBestScore();
