# Шрифти панелі тренажера

Панель тренажера (`piano/js/studio.js`, напрям «Студія» з `docs/trainer-ui-brief.md` §5.1) пише
двома шрифтами під SIL Open Font License 1.1. Сторінка завантажує їх через `FontFace` до першого
малювання панелі; без них (чи для літер, яких у файлі немає) лишається `system-ui`.

Обидва файли — змінні шрифти, урізані до латиниці, кирилиці (з «і», «ї», «є», «ґ») і розділових знаків
(«’», «–», «−», «·», «≈», «№», «…», «°»); урізання — дозволена ліцензією зміна, назв, закріплених
ліцензією (Reserved Font Name), шрифти не мають. Узято з макетів напряму (`docs/ui-prototypes/fonts`
гілки макетів `pipeline/task-a32e90a5`, коміт `6847814`).

| Файл | Шрифт | Ваги | Автори | Ліцензія | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `Manrope-var.woff` | Manrope | 200–800 | The Manrope Project Authors, https://github.com/googlefonts/manrope | `OFL-Manrope.txt` | `df6796cb5706ba56d02d8601ace0fcacfea877e26412a95d4c6c2d1dafc66dce` |
| `JetBrainsMono-var.woff` | JetBrains Mono | 100–800 | The JetBrains Mono Project Authors, https://github.com/JetBrains/JetBrainsMono | `OFL-JetBrainsMono.txt` | `e7748b07c6d1b66225e18b6931b697aacdfbee1f3c012e3baef2d890cd4bef71` |
