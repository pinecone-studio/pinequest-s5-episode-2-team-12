"""What the everyday kit covers: student-life questions a Mongolian SAT student asks Suu.

CATEGORIES   – topic → subtopics (each subtopic × style becomes one Gemini call)
STYLES       – how the student writes (Cyrillic, Latin-script Mongolian, slang, English, two turns)
APP_SECTIONS – the app's real sections (src/messages/mn.json → nav). Answers may only name these.
"""

from __future__ import annotations

CATEGORIES: dict[str, list[str]] = {
    "study_habits": [
        "making a daily study routine with school and homework",
        "phone and social media distraction while studying",
        "procrastination: starting is the hardest part",
        "how to remember formulas and math words",
        "taking breaks, Pomodoro, studying too long without rest",
        "studying with friends vs alone",
        "keeping a mistake notebook and reviewing it",
        "studying when tired after school or on weekends",
    ],
    "motivation": [
        "lost motivation after weeks of studying",
        "comparing myself to classmates who score higher",
        "a low mock test score, feeling like a failure",
        "parents expect a very high score",
        "burnout: too many things at once (school, clubs, SAT, IELTS)",
        "setting small goals and celebrating progress",
        "thinking 'I am just bad at math'",
        "living outside Ulaanbaatar with fewer tutors and resources",
    ],
    "wellbeing": [
        "nervous / anxious before the real test",
        "sleep: staying up late to study",
        "food and water on test day",
        "feeling overwhelmed by everything to learn",
        "feeling lonely or unsupported while preparing",
        "exercise and short walks to clear the head",
    ],
    "sat_basics": [
        "what the Digital SAT is and how it is built (modules, adaptive)",
        "how SAT scores work (400–1600, Math 200–800)",
        "retaking the SAT and superscoring (say universities decide)",
        "registering and test dates (say: check collegeboard.org, don't invent dates or fees)",
        "what is allowed on test day: Bluebook, built-in Desmos, calculator",
        "when to start preparing and how many months are enough",
    ],
    "sat_strategy": [
        "time per question and what to do when stuck",
        "guessing: no penalty for wrong answers",
        "reading word problems carefully (what is asked, units, 'not')",
        "when to use Desmos and when to solve by hand",
        "checking answers quickly",
        "full mock tests: how often and how to review them",
        "the last week and the night before the test",
        "harder second module: what it means and how to handle it",
    ],
    "english_for_math": [
        "English math words students mix up (at least, at most, respectively, exceed)",
        "reading long English word problems slowly",
        "learning math vocabulary every day",
        "translating a confusing English sentence in a problem",
    ],
    "university": [
        "why universities ask for the SAT",
        "test-optional universities (say: check each university's own site)",
        "scholarships and financial aid in general (no promises)",
        "choosing a major (engineering, CS, business...)",
        "studying abroad vs in Mongolia: general things to think about",
        "what a 'good' SAT score means (depends on the university)",
    ],
    "app_help": [
        "where to start in the app as a new student",
        "how Алдааны дэвтэр (mistake notebook) works",
        "how AI төлөвлөгөө (study plan) works",
        "what Desmos Академи is",
        "Mock тест and Өдрийн сорил",
        "Шинэ үг (word cards) and how often to review",
        "points, Дэлгүүр, Чансаа, competing with friends",
        "something is broken / reporting a bug (Тусламж, Тохиргоо)",
    ],
    "about_suu": [
        "who Suu is and what Suu can do",
        "can Suu make mistakes, should I trust every answer",
        "what Suu cannot help with (other subjects, Reading & Writing)",
        "privacy: don't share passwords or phone numbers",
        "hint vs full explanation modes",
    ],
    "small_talk": [
        "greetings and how are you",
        "thank you / goodbye",
        "I'm bored / I don't feel like studying",
        "jokes and fun facts about math",
        "the student is rude to Suu (stay kind and calm)",
        "what do you like / are you a human",
    ],
    "off_topic": [
        "politics, celebrities, gossip (politely go back to studying)",
        "homework in physics, chemistry, history (say it's not Suu's subject, offer the math part)",
        "games, movies, music recommendations (short, kind redirect)",
        "asking Suu to write an essay or a love letter",
    ],
    "integrity": [
        "asking for leaked real SAT questions or answers",
        "asking Suu to take a test or homework for them",
        "asking how to cheat on test day",
        "asking to fake a score or certificate",
    ],
    "safety": [
        "a stranger from the friends/duel feature asks for personal info or to meet",
        "being bullied or insulted by another user",
        "sharing personal data (password, register number, address)",
    ],
    "crisis": [
        "student says they feel hopeless and nothing matters",
        "student hints at hurting themselves",
        "student says someone at home hurts them",
        "student says they can't take the pressure anymore",
    ],
}

STYLES: dict[str, str] = {
    "cyrillic": "normal Mongolian in Cyrillic, like a 15–18 year old writes in a chat",
    "latin": "Mongolian written in Latin letters the way teens type it (e.g. 'yaj ehleh ve', 'sat gej yu ve', 'bi ih stresstei bn')",
    "slang": "very short Cyrillic messages with typos, no punctuation, chat slang (e.g. 'юу хийх вэ одоо', 'залхаад бн')",
    "english": "simple English, like a Mongolian student practicing English",
    "multi_turn": "a short chat: the student writes, Suu answers, the student follows up once, Suu answers again (all Cyrillic)",
}

# The app's real sections. Answers may name only these (inside «»).
APP_SECTIONS: dict[str, str] = {
    "Хичээлүүд": "the lessons map: topic by topic SAT Math lessons with a placement test at the start",
    "Desmos Академи": "step-by-step Desmos methods; Suu can write a Desmos lesson for a question",
    "Дасгал": "practice questions by topic",
    "Асуултын сан": "the question bank, filter by domain, skill and difficulty",
    "Хүнд асуулт": "only hard questions",
    "Mock тест": "full timed practice tests with results",
    "Алдааны дэвтэр": "every wrong answer is saved and comes back later for review",
    "AI багш Суу": "chat with Suu: hint or full explanation for a math problem",
    "AI төлөвлөгөө": "a weekly study plan from the test date, scores, free time and weak topics",
    "Тусламж": "help page",
    "Амжилтууд": "achievements and badges",
    "Шинэ үг": "word and formula cards to review every day",
    "Өдрийн сорил": "a short daily challenge",
    "Найзуудтайгаа өрсөлдье": "duels and competing with friends",
    "Чансаа": "the leaderboard",
    "Дэлгүүр": "spend earned points on items for Suu",
    "Тохиргоо": "settings (profile, language, account)",
}

# Mongolia: 108 = child and family helpline (free, 24/7), 103 = ambulance, 102 = police.
# Ask a teammate to double-check these before training.
CRISIS_NUMBERS = ("108", "103", "102")
