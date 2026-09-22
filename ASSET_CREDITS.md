# Ресурси СЕКТОРУ

## У поточній збірці

Мапи, ізометричні ілюстрації, спрайти операторів, текстури стін і звуки ефектів створені процедурно кодом цього проєкту. Використані системні шрифти. Зовнішні бібліотеки, шрифти, аналітика та мережеві ресурси для запуску не потрібні.

Спрайти зброї — з набору AystarGames (CC0, див. таблицю). Зображення вбудовані локально (`public/assets/weapons/`, копії у `play.html`/`dist/` як data-URI), тож гра лишається автономною.

«Mirage · Pixel» та «Dust II · Pixel» — спрощені піксельні адаптації планувань за зображеннями, наданими користувачем. Геометрія і матеріали намальовані кодом; оригінальні файли мапи, текстури й логотипи Counter-Strike не включені.

## Підібрано для наступної інтеграції

| Автор | Набір | Умови на сторінці автора, перевірені 19.09.2026 | Статус |
| --- | --- | --- | --- |
| AystarGames | [Free 16x16 Pixel Art Guns & Weapons Pack](https://aystargames.itch.io/16x16-micro-pixel-art-gun-pack) | CC0, без обов’язкової атрибуції | **Інтегровано 21.09.2026**: 4 спрайти (пістолет→P-12, ПП→VIPER, автомат→RANGER, дробовик→HAMMER) у `public/assets/weapons/`; ліцензія в `assets/licenses/itch-aystargames-guns.txt` |
| SnakeF8 | [Snake’s Authentic Gun Sounds](https://f8studios.itch.io/snakes-authentic-gun-sounds) | Безкоштовно, автор дозволяє комерційне використання без обов’язкової атрибуції | Не завантажено |
| SnakeF8 | [Second Authentic Gun Sounds](https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack) | Безкоштовно, автор дозволяє комерційне використання та підтверджує public domain/CC0 у коментарях | Не завантажено |
| Kronbits | [Free CG Textures](https://kronbits.itch.io/matriax-free-cg-textures) | CC0 | Не завантажено |
| Kenney | [Prototype Textures](https://kenney-assets.itch.io/prototype-textures) | CC0 | Не завантажено |
| Quaternius | [50+ LowPoly Guns](https://quaternius.itch.io/50-lowpoly-guns) | CC0 | Не завантажено |
| Quaternius | [Universal Base Characters](https://quaternius.itch.io/universal-base-characters) | CC0, безкоштовний варіант Standard | Не завантажено |

3D-моделі Quaternius потребуватимуть переходу на полігональний рендерер або підготовки 2D-рендерів: поточна гра використовує 2.5D raycasting і спрайти.
