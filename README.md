# Quiz App

A timed trivia quiz built with HTML, CSS and vanilla JavaScript. It fetches 10 questions from the [Open Trivia DB](https://opentdb.com/), gives the player 15 seconds per question, and shows a results screen with a saved best score.

## How to run

1. Download or clone this folder.
2. Open `index.html` in any modern browser (double-click it, or use the VS Code "Live Server" extension).
3. You need an internet connection, because the questions come from the Open Trivia DB API.

There is nothing to install and no build step.

## How to play

1. Choose a category and difficulty on the Start screen, then click **Start Quiz**.
2. Answer each question before the 15-second timer runs out.
3. The clicked answer turns green if it is right and red if it is wrong, and the correct answer is always shown in green.
4. Click **Next** to move on. After the last question you see your score, percentage and a message.
5. Click **Play Again** to return to the Start screen. Your best score is saved in `localStorage` and shown there.

## Features

- Three screens (Start, Quiz, Results), with only one visible at a time
- Questions fetched with `async` / `await` from a single API request per game
- Checks both `response.ok` and the API's `response_code`, with friendly error messages and a **Try again** button
- "Loading..." message, and the Start button is disabled while loading so it cannot be clicked twice
- `Question` and `Quiz` classes; `map` turns API results into `Question` objects
- Answer options are shuffled (Fisher-Yates) so the correct answer moves around
- Answer buttons are created dynamically with JavaScript and disabled after one is chosen
- 15-second countdown per question using `setInterval`, with the timer always cleared when the player answers or moves on
- Best score saved with `localStorage`
- Responsive layout for phones and desktops

## About the API

- Requests use `encode=url3986`, and the text is decoded with `decodeURIComponent` so characters like quotes and ampersands display correctly.
- The API allows about one request every 5 seconds. The app asks for all 10 questions in one request, and if a new game starts less than 5 seconds after the last request, it waits before fetching again.

## Project structure

```
quiz-app/
├── index.html
├── style.css
├── script.js
├── README.md
└── screenshots/
```

## Screenshots

See the `screenshots/` folder for the Start screen, loading state, question with timer, correct and wrong answer feedback, time-up, results screen, error screen and mobile layout.

## One thing I would add with more time

A review screen at the end that lists every question with the player's answer next to the correct one, so players can learn from what they got wrong.
