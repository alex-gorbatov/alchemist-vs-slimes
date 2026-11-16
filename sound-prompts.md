# Промты для звуков «Алхимик и слизни» (ElevenLabs)

Эффекты генерируются в разделе **Sound Effects**, музыка — в разделе **Music**.
Промты на английском: так генератор понимает их точнее.

## Общие настройки для эффектов

- **Duration:** ставьте вручную значение из таблицы, не оставляйте Auto. Минимум у генератора около 0,5 с — для коротких звуков ставьте минимум, лишнее я обрежу при подключении.
- **Prompt influence:** высокое (около 70–80 %), чтобы звук был ближе к описанию и без лишних деталей.
- **Loop:** выключено для всех эффектов.
- Генератор выдаёт несколько вариантов — выбирайте тот, где звук начинается сразу, без вступления, и нет фонового шума или эха.
- Скачивайте в MP3. Имя файла — как в заголовке, латиницей.
- Тишину в начале и хвосты можно не обрезать: это сделаю я, заодно выровняю громкость.

Все звуки должны быть из одного «мира»: камень, стекло, латунь, вязкая жидкость, мягкая магия. Без электронных «бипов», голосов и слов.

---

## Эффекты

### 1. `move.mp3` — сдвиг пары влево/вправо
Duration: 0.5 s (минимум)

```text
Single very short soft tick of a small polished pebble tapping on stone, dry, quiet, clean, no reverb, no tail, game UI sound
```

### 2. `rotate.mp3` — поворот пары
Duration: 0.5 s (минимум)

```text
Single short light metallic clink of a small brass clasp turning, with a tiny quick whoosh, dry, clean, no reverb, game UI sound
```

### 3. `lock.mp3` — пара легла на место
Duration: 0.5 s

```text
Single short dull thud of two heavy gemstones landing on a stone floor, low and solid, slight click on impact, dry, no reverb, casual puzzle game sound
```

### 4. `clear.mp3` — исчезли камни
Duration: 0.7 s

```text
Crystal gemstone shattering into small shards with a bright glassy sparkle, short and satisfying, magical chime on top, no reverb tail, casual puzzle game sound
```

### 5. `combo.mp3` — цепочка (после падения собралась ещё одна линия)
Duration: 0.8 s

```text
Crystal gemstones shattering with a bright rising magical chime, higher pitched and more sparkling than a normal break, quick ascending glissando of small bells, rewarding, casual puzzle game sound
```

### 6. `slime.mp3` — исчез слизень
Duration: 0.6 s

```text
Cute wet squishy pop of a small jelly slime bursting, with a tiny comical squeak, soft and funny, not gross, cartoon game sound, no reverb
```

### 7. `throw.mp3` — алхимик бросает пару в котёл
Duration: 0.5 s (минимум)

```text
Single short soft cloth whoosh of a sleeve swinging as an object is tossed, light and airy, no impact, dry, cartoon game sound
```

### 8. `speed.mp3` — игра ускорилась
Duration: 0.8 s

```text
Short bubbling of a magic cauldron with a quick rising sparkle, three fast ascending bell notes, signals speeding up, light and magical, casual game sound
```

### 9. `click.mp3` — нажатие кнопок меню
Duration: 0.5 s (минимум)

```text
Single soft wooden button click with a faint glassy tap, warm, short, clean, no reverb, game menu UI sound
```

### 10. `win.mp3` — уровень пройден
Duration: 2.5 s

```text
Short cheerful victory jingle, harp and small bells playing a quick rising phrase that resolves on a bright major chord with a magical sparkle, cosy fantasy style, casual puzzle game, ends cleanly
```

### 11. `over.mp3` — проигрыш
Duration: 2.5 s

```text
Short gentle failure jingle, soft bassoon and pizzicato strings playing a descending phrase that ends with a low cauldron bubble plop, slightly comical, not harsh or scary, cosy fantasy style, casual puzzle game
```

---

## Музыка

### 12. `music.mp3` — фон во время уровня
Раздел **Music**, инструментальная, длина 45–60 с.

```text
Instrumental loopable background music for a cosy fantasy puzzle game set in an alchemist's laboratory. Calm, playful and slightly mysterious. Pizzicato strings, harp, celesta, soft bassoon, light hand percussion. Moderate tempo around 100 BPM, steady rhythm throughout, simple catchy melody that does not demand attention. No vocals, no lyrics, no big intro, no build-up, no ending flourish: the track starts and ends at the same energy and in the same key so it can loop seamlessly.
```

Что проверить в результате:

- нет вокала и слов;
- громкость и темп ровные от начала до конца, без затихания в финале;
- мелодия не надоедает за 2–3 повтора подряд — игрок будет слушать её десятки минут.

Идеально бесшовный стык генератор обычно не даёт. Если конец не сходится с началом, пришлите как есть: я сделаю короткий перекрёстный переход на стыке.

---

## Если звук получился не тот

- **Слишком длинный или с хвостом** — добавьте в промт `very short, abrupt end, no tail`.
- **С эхом, как в пещере** — добавьте `dry, close microphone, no reverb, no room`.
- **Слишком реалистичный и резкий** — добавьте `soft, cartoon, casual mobile game`.
- **Несколько ударов вместо одного** — начните промт со слов `One single`.

## Права

Коммерческое использование сгенерированного в ElevenLabs зависит от тарифа. Перед публикацией на площадках проверьте, что ваш тариф это разрешает: условия бесплатного и платных тарифов различаются.
