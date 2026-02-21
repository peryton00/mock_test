# UPSC Prelims Mock Test Platform

> A professional Single Page Application (SPA) that simulates a real UPSC CBT (Computer Based Test) environment. Built entirely with HTML5, CSS3, JavaScript (ES6+), and jQuery — no backend required.

---

## 🎯 Project Overview

This platform provides a realistic UPSC Prelims examination experience with:
- **Paper I** (General Studies) and **Paper II** (CSAT) mock tests
- Full-length and subject-wise test modes
- Real-time countdown timer with auto-submit
- Color-coded question navigation palette
- Negative marking with detailed scoring
- Topic-wise performance analytics
- Answer review with explanations
- Complete attempt history tracking
- LocalStorage-based persistence (resume tests on refresh)

---

## ✅ Completed Features

### Core Exam Features
- [x] Paper 1 (General Studies) — 30 questions across 6 subjects
- [x] Paper 2 (CSAT) — 25 questions across 5 subjects
- [x] Full-length mock test mode
- [x] Subject-wise test mode with dynamic subject listing
- [x] Real-time countdown timer with warning mode (< 5 min)
- [x] Auto-submit when time expires
- [x] Timer persistence — resumes correctly on page refresh
- [x] Question navigation palette (color-coded: Not Visited, Not Answered, Answered, Marked, Answered & Marked)
- [x] Mark for Review functionality
- [x] Clear Response button
- [x] Save & Next / Previous navigation
- [x] Confirmation popup before submission
- [x] Negative marking (configurable per paper)

### Results & Analytics
- [x] Score card with animated circular progress
- [x] Total questions, attempted, correct, incorrect, accuracy, time taken
- [x] Topic-wise performance breakdown table with accuracy bars
- [x] Full answer review mode with correct/incorrect highlighting
- [x] Explanations shown for every question in review
- [x] Filter review by: All, Correct, Incorrect, Skipped

### Data Persistence
- [x] Ongoing test session saved to localStorage
- [x] Selected answers, marked questions, remaining time all persisted
- [x] Resume test from exact state on page refresh
- [x] Test results stored in attempt history (up to 50 entries)
- [x] Candidate name remembered across sessions

### Advanced Features
- [x] Shuffle questions option (toggle before starting)
- [x] Shuffle options option (toggle before starting)
- [x] Dark mode toggle with persistence
- [x] Keyboard shortcuts for quick navigation
- [x] Mobile-responsive navigation panel (slide-out)
- [x] Desktop-first responsive layout
- [x] No full page reloads (true SPA)
- [x] Event delegation for efficient DOM handling

### Keyboard Shortcuts (during exam)
| Key | Action |
|-----|--------|
| `→` or `N` | Next question |
| `←` or `P` | Previous question |
| `A` or `1` | Select option A |
| `B` or `2` | Select option B |
| `C` or `3` | Select option C |
| `D` or `4` | Select option D |
| `M` | Toggle Mark for Review |
| `X` | Clear Response |

---

## 📁 Project Structure

```
/
├── index.html                 # Main SPA entry point (all screens)
├── css/
│   └── style.css             # Complete stylesheet (800+ lines)
├── js/
│   ├── storageManager.js     # localStorage persistence layer
│   ├── timer.js              # Countdown timer module
│   ├── testEngine.js         # Question state & exam logic
│   ├── resultEngine.js       # Scoring & analytics engine
│   └── app.js                # Main SPA controller & UI
├── data/
│   ├── paper1.json           # Paper I questions (30 Qs, 6 subjects)
│   └── paper2.json           # Paper II questions (25 Qs, 5 subjects)
└── README.md
```

---

## 🔗 Entry Points & URI Paths

| Path | Description |
|------|-------------|
| `/index.html` | Main application — all screens are handled client-side as an SPA |
| `/data/paper1.json` | Paper I (GS) question bank |
| `/data/paper2.json` | Paper II (CSAT) question bank |

### SPA Screens (all within index.html)
| Screen ID | Description |
|-----------|-------------|
| `#screen-home` | Home/landing page — paper & mode selection |
| `#screen-exam` | Exam interface — question panel + navigation grid |
| `#screen-result` | Score card & topic-wise analytics |
| `#screen-review` | Answer review with explanations |
| `#screen-history` | Attempt history dashboard |

---

## 📊 Data Models

### JSON Question Format
```json
{
  "id": 1,
  "question": "Question text here",
  "options": {
    "A": "Option A",
    "B": "Option B",
    "C": "Option C",
    "D": "Option D"
  },
  "correctAnswer": "A",
  "explanation": "Detailed explanation",
  "topic": "Indian Polity",
  "subject": "polity",
  "difficulty": "medium"
}
```

### localStorage Keys
| Key | Description |
|-----|-------------|
| `upsc_active_session` | Current ongoing test session (full state snapshot) |
| `upsc_attempt_history` | Array of completed test results (max 50) |
| `upsc_dark_mode` | Dark mode preference (boolean) |
| `upsc_candidate_name` | Last entered candidate name |

### Question State Model
```javascript
{
  questionId: number,
  visited: boolean,
  answered: boolean,
  selectedOption: string|null,  // 'A','B','C','D'
  markedForReview: boolean
}
```

---

## 🏗️ Architecture

The application follows a **modular namespace pattern** to avoid global variable pollution:

| Module | Responsibility |
|--------|---------------|
| `StorageManager` | All localStorage read/write operations |
| `Timer` | Countdown timer with callbacks and persistence |
| `TestEngine` | Question state management, navigation, shuffling |
| `ResultEngine` | Score calculation, topic breakdown, review data |
| `App` | UI controller, event binding, screen transitions |

**Dependencies flow:** `App` → `TestEngine` + `Timer` + `ResultEngine` + `StorageManager`

---

## 🚀 How to Run

### Option 1: Direct file open
Open `index.html` in a modern browser. **Note:** JSON loading via `$.getJSON` requires a server context due to CORS.

### Option 2: Local development server (recommended)
```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8000
```
Then open `http://localhost:8000` in your browser.

### Option 3: Publish via the platform
Use the **Publish** tab in the platform to deploy and get a live URL.

---

## 📋 Paper Content Summary

### Paper I — General Studies (30 Questions)
| Subject | Questions | Duration |
|---------|-----------|----------|
| Indian Polity & Governance | 5 | 20 min |
| History of India | 5 | 20 min |
| Indian & World Geography | 5 | 20 min |
| Indian Economy | 5 | 20 min |
| General Science & Technology | 5 | 20 min |
| Environment & Ecology | 5 | 20 min |
| **Full Mock** | **30** | **120 min** |

### Paper II — CSAT (25 Questions)
| Subject | Questions | Duration |
|---------|-----------|----------|
| Reading Comprehension | 5 | 20 min |
| Logical Reasoning | 5 | 20 min |
| Basic Numeracy & Data Interpretation | 5 | 20 min |
| Decision Making | 5 | 20 min |
| English Comprehension | 5 | 20 min |
| **Full Mock** | **25** | **120 min** |

---

## 🔮 Recommended Next Steps

1. **Expand question bank** — Add 70+ more questions per paper to reach real UPSC scale (100 for Paper I, 80 for Paper II)
2. **Add more mock tests** — Create multiple full-length variants (GS_FULL_002, etc.)
3. **Performance charts** — Integrate Chart.js for visual accuracy trends over attempts
4. **Export results** — Allow PDF download of score cards
5. **Leaderboard** — Add comparison rankings using a backend API
6. **Question images** — Support image-based questions (maps, diagrams)
7. **Section-wise timing** — Add per-section time tracking
8. **Accessibility** — Add ARIA labels and screen reader support
9. **PWA support** — Add service worker for offline access

---

## 🛠️ Tech Stack

- **HTML5** — Semantic structure, SPA architecture
- **CSS3** — Custom properties, Grid, Flexbox, animations, dark mode
- **JavaScript ES6+** — Modules, async/await, arrow functions, template literals
- **jQuery 3.7.1** — DOM manipulation, event handling, AJAX
- **Font Awesome 6.4** — Icons
- **Google Fonts (Inter)** — Typography
- **localStorage** — Client-side data persistence

---

*Built as a static web application — no backend required. All data and logic runs entirely in the browser.*