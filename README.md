# Тренажер для синтезатора — онлайн-версія

Статична копія сторінки тренажера для браузера Quest: віртуальна клавіатура лягає на справжню
(61 клавіша), ноти падають і підсвічують клавіші. Відкрий адресу сайту в браузері Quest (HTTPS) і
натисни «Увійти»; на ПК та сама адреса показує перегляд на екрані.

Ця копія працює без ПК: у ній лише пісні з набору. Своїх пісень і кнопки «Назад до екранів» тут
немає. Калібрування й налаштування браузер пам'ятає для кожної адреси окремо, тож на новій
адресі клавіатуру калібрують заново.

## Що тут

- `index.html`, `js/` — сторінка тренажера.
- `songs/` — 54 пісні (MIDI), `warmups/` — 22 вправи перед піснею; `index.json` у кожній теці — список
  для сторінки, `catalog.json` — назви, рівні й ліцензія кожного файлу.
- `sounds/piano/` — 21 запис рояля для звуку пісні.
- `fonts/` — шрифти панелі.
- `fingering/` — аплікатура кожної пісні й вправи.

## Ліцензії й джерела

Кожен файл пісні, вправи й запису має розділ у `ATTRIBUTION.md` своєї теки: звідки він, ліцензія
з посиланням і SHA-256 його байтів.

- **Пісні** (CC0 1.0 — 23; Public Domain — 21; CC BY-SA 3.0 — 3; CC BY-SA 2.5 — 3; CC BY 3.0 — 2; CC BY-SA 4.0 — 1; CC BY 4.0 — 1): 31 — з The Mutopia Project
  (https://www.mutopiaproject.org/), незмінні, кожна з посиланням на свою сторінку там; решта —
  перекладення для тренажера, CC0 1.0. `songs/ATTRIBUTION.md`.
- **Вправи** (CC0 1.0 — 22): написані для тренажера. `warmups/ATTRIBUTION.md`.
- **Записи рояля:** "Salamander Grand Piano" by Alexander Holm, CC BY 3.0
  (https://creativecommons.org/licenses/by/3.0/); MP3 subset by the Tone.js project
  (https://github.com/Tonejs/audio). `sounds/ATTRIBUTION.md`.
- **Шрифти:** Manrope (https://github.com/googlefonts/manrope) і JetBrains Mono
  (https://github.com/JetBrains/JetBrainsMono), SIL Open Font License 1.1 (`fonts/OFL-*.txt`).
  `fonts/ATTRIBUTION.md`.

Ліцензії Creative Commons:

- CC BY 3.0: https://creativecommons.org/licenses/by/3.0/
- CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
- CC BY-SA 2.5: https://creativecommons.org/licenses/by-sa/2.5/
- CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
- CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
