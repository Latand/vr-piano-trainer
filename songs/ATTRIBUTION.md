# Songs in this folder

Two kinds of file, all of them free to share:

- **From The Mutopia Project** (https://www.mutopiaproject.org/): downloaded unchanged and
  renamed. The licence of each is the one its Mutopia page states. The compositions of the
  classical pieces are in the public domain; the five modern pieces (Toccatina, Variations
  d'automne, A Child's Wish, Valse, Enchanted Island) are published by their composers under the
  Creative Commons licence named.
- **Arranged for this trainer** (licence CC0 1.0): written as note text in
  `piano/tools/arrangements.mjs` and turned into MIDI by `piano/tools/build-songs.mjs`, which a
  test runs again to check the bytes. Every tune is in the public domain. Each melody was
  checked note for note against the score named in its section: where the score could be
  rendered to MIDI (Wikipedia score markup and Commons LilyPond sources rendered with LilyPond
  2.25, MIDI files) a script compared pitch, onset and written length; engraved images were
  compared by eye. Those scores were used only to check the notes; nothing of them is copied
  here. A key change is named where there is one.

`catalog.json` lists the songs in the order of the song list, with their titles, audience,
difficulty and the metrics worked out from the notes; `tests/catalog.test.mjs` and
`tools/check-licences.mjs` check every hash below against the bytes.

## twinkle-twinkle-little-star.mid

- **Piece:** Twinkle, Twinkle, Little Star: the French tune "Ah ! vous dirai-je, maman" (1761), words by Jane Taylor (1806).
- **Tune:** traditional, published 1761; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, C major, the whole song (12 bars).
- **Checked against:** the score in the Wikipedia article "Twinkle, Twinkle, Little Star" (https://en.wikipedia.org/wiki/Twinkle,_Twinkle,_Little_Star), C major; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `b1a7be9f14f230301eb3e6f39d891b2fb6182e9dce8edefeb380f72aedb3251a`.

## mary-had-a-little-lamb.mid

- **Piece:** Mary Had a Little Lamb, tune attributed to Lowell Mason (1792-1872), words by Sarah Josepha Hale (1830).
- **Tune:** published in the 1830s; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, G major (G position, five fingers), the whole song (8 bars).
- **Checked against:** "Mary Had a Little Lamb.pdf" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Mary_Had_a_Little_Lamb.pdf), marked PD-US, G major; compared note for note by eye against the engraving; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `10be62218e74f92875f12bf334dd5f467492a391f10440cdb069a6de1740524b`.

## hot-cross-buns.mid

- **Piece:** Hot Cross Buns, English street cry and nursery rhyme (18th century).
- **Tune:** traditional; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, G major, the familiar tune (4 bars) played twice.
- **Checked against:** the score in the Wikipedia article "Hot Cross Buns (song)" (https://en.wikipedia.org/wiki/Hot_Cross_Buns_(song)), its second tune (bars 9-12), G major; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `6385fdf2090dddf8b191a1ea5af62ea182807d4e0e1a9021f1e91fae7eb9c932`.

## ho-ho-ho-koza.mid

- **Piece:** «Го-го-го, коза», Ukrainian folk children's song.
- **Tune:** Ukrainian folk song; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, C major (C position, five fingers), the 7 bars with their repeat.
- **Checked against:** "Го-го-го коза.GIF" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Го-го-го_коза.GIF), an engraving released as public domain by its author (PD-self), C major; compared note for note by eye against the engraving; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `52c507a75909d2c839e113c86d355b2b5150fed6ee0968a297e6ada026327f33`.

## frere-jacques.mid

- **Piece:** Frère Jacques, French round (18th century).
- **Tune:** traditional; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, the melody of one voice (8 bars); transposed from F major up a whole tone to G major, so it uses white keys and stays above middle C.
- **Checked against:** the score in the Wikipedia article "Frère Jacques" (https://en.wikipedia.org/wiki/Frère_Jacques), F major, its four phrases; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI after transposing by +2 semitones; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `057d2a7ad557f6b60721f100713d4a0cf0a5d9c70c8ff08d5472b67b5c036f02`.

## row-row-row-your-boat.mid

- **Piece:** Row, Row, Row Your Boat, American nursery rhyme (published 1852).
- **Tune:** traditional; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, C major, 6/8, the whole song (8 bars).
- **Checked against:** the score in the Wikipedia article "Row, Row, Row Your Boat" (https://en.wikipedia.org/wiki/Row,_Row,_Row_Your_Boat), C major; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `b51d008d043d8e0faefa8515ff28a778202469e37e36e6817f9667571422d88f`.

## london-bridge.mid

- **Piece:** London Bridge Is Falling Down, English nursery rhyme (17th century).
- **Tune:** traditional; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, the 8 bars played twice; transposed from F major down a fourth to C major (white keys, C to A).
- **Checked against:** the score in the Wikipedia article "London Bridge Is Falling Down" (https://en.wikipedia.org/wiki/London_Bridge_Is_Falling_Down), F major; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI after transposing by -5 semitones; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `efde46e6f606ac65de7b3de434d9ecfb4c28d530e1647e4ec8c2bd967c7cc913`.

## old-macdonald.mid

- **Piece:** Old MacDonald Had a Farm, children's song (versions printed from 1917).
- **Tune:** traditional; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, one verse (16 bars); transposed from A major down a whole tone to G major (white keys).
- **Checked against:** "Old MacDonald Had a Farm (pg).mid" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Old_MacDonald_Had_a_Farm_(pg).mid), a CC0 setting, A major, its melody voice; compared note for note (pitch and onset) by a script after transposing by -2 semitones; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `e599246f48872b4b9d65b9f19467d17fe0d52a9d7e209fc173be275037dca4c3`.

## happy-birthday.mid

- **Piece:** Happy Birthday to You: the tune of "Good Morning to All" by Mildred J. Hill (1859-1916) and Patty Smith Hill (1868-1946), 1893.
- **Tune:** in the public domain: the tune was published in 1893; in the United States a federal court found in 2015 that the claimed copyright on the song was not valid and the 2016 settlement declared it public domain; under life + 70 years it is free everywhere from 2017 (Patty Hill died in 1946). Only the tune is used here. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, G major, 3/4 with its upbeat, the whole song (8 bars).
- **Checked against:** the score in the Wikipedia article "Happy Birthday to You" (https://en.wikipedia.org/wiki/Happy_Birthday_to_You), G major; the copyright history is in the same article; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `922a7f337fe39c9e97c2bc62a5aa8a48f79f12a2b1f6d79a991a4707fec2fbe2`.

## jingle-bells.mid

- **Piece:** Jingle Bells, refrain, James Lord Pierpont (1822-1893), 1857.
- **Tune:** published 1857; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, G major, the refrain (8 bars).
- **Checked against:** "Jingle Bells refrain vector.mid" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Jingle_Bells_refrain_vector.mid), public domain, G major, its top voice; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `689a7d31f6cc8f74036623b3a8c115032c3f6462ac5155ecbb27ed7c72131c79`.

## a-my-proso-siialy.mid

- **Piece:** «А ми просо сіяли», Ukrainian folk game song.
- **Tune:** Ukrainian folk song; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, the whole song (12 bars); transposed from G minor up a whole tone to A minor (white keys).
- **Checked against:** "А ми просо сіяли.GIF" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:А_ми_просо_сіяли.GIF), engraving CC0, G minor; compared note for note by eye against the engraving after transposing by +2 semitones; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `a3b8aeaa4d63af3ec3e9adc928e8678cd2b5247077b0287e6dd202b2f2707b9e`.

## kotyku-sirenkyi.mid

- **Piece:** «Котику сіренький», Ukrainian folk lullaby.
- **Tune:** Ukrainian folk song; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: right hand only, A minor, the whole song (11 bars: the first two phrases, both again, the two closing bars and the «а-а» bar).
- **Checked against:** "Котику сіренький.GIF" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Котику_сіренький.GIF), engraving CC0, A minor; the engraving read bar by bar into note text and compared note for note (pitch, onset and written length) by a script against the file; no differences (77 notes, 11 bars). An earlier version played the «Не ходи по хаті» phrase twice too often (13 bars); the comparison found it and it is fixed. The test «two tunes against their scores» in `piano/tests/catalog.test.mjs` keeps the comparison. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `fd3dddba5176b7228f8271ba9e95e6580209151cefd583270c18440b5c396caa`.

## beethoven-ode-to-joy-easy.mid

- **Piece:** Ode to Joy, the theme of the finale of Symphony No. 9, L. van Beethoven (1824).
- **Tune:** Beethoven died in 1827; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the tune in the right hand (16 bars, G major), one bass note at a time in the left, taken from the bass of the chorale beethoven-ode-to-joy.mid (Mutopia 528).
- **Checked against:** the score in the Wikipedia article "Ode to Joy" (https://en.wikipedia.org/wiki/Ode_to_Joy), G major; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `3fdab30ba00f4c4a7d4ace3e85a221e7c617d1fddefac681062ee294f32f850e`.

## brahms-lullaby-easy.mid

- **Piece:** Wiegenlied (Lullaby), Op. 49 No. 4, J. Brahms (1868).
- **Tune:** Brahms died in 1897; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the tune in the right hand (E-flat major, with its upbeat), the left hand a bass note a bar on E-flat, B-flat and A-flat as in Brahms's accompaniment; the two grace notes are left out.
- **Checked against:** the score in the Wikipedia article "Wiegenlied (Brahms)" (https://en.wikipedia.org/wiki/Wiegenlied_(Brahms)) and Mutopia 1037 (https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1037, public domain), E-flat major; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences apart from the grace notes left out. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `e8ba3402cb87d0ba08f2f9b2b69c290b957b3d2776eabf11db7809cd4264b247`.

## dobryi-vechir-tobi-easy.mid

- **Piece:** «Добрий вечір тобі, пане господарю», Ukrainian folk carol.
- **Tune:** Ukrainian folk song; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the tune in the right hand (A major, 6 bars, played twice), a bass note a half bar in the left.
- **Checked against:** "Добрий вечір тобі, пане господарю.GIF" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Добрий_вечір_тобі,_пане_господарю.GIF), engraving CC0, A major; compared note for note by eye against the engraving; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `91eeee2bfb36ebbd2bce4ce42373f2ec7171c881b60b4517c4bc2d0ecba5f73f`.

## grieg-morning-mood-easy.mid

- **Piece:** Morning Mood (Morgenstemning), Peer Gynt Suite No. 1, Op. 46, E. Grieg (1875).
- **Tune:** Grieg died in 1907; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the opening flute phrase (4 bars, E major, 6/8) twice in the right hand without its grace notes, the held E of the bass in the left.
- **Checked against:** "Orchesterwerke Romantik Themen.pdf" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Orchesterwerke_Romantik_Themen.pdf), public domain, page 287, E major; compared note for note by eye against the engraving (a scan); no differences apart from the grace notes left out. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `39fa9125ebf24cabc9e5bd731ab7b1a3de056ac65c956c24a10bbc22d09f7547`.

## pachelbel-canon-easy.mid

- **Piece:** Canon in D, J. Pachelbel (c. 1700).
- **Tune:** Pachelbel died in 1706; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the ground bass in the left hand throughout, the first violin's first eight bars in the right (after two bars of bass alone), ending on D.
- **Checked against:** the score in the Wikipedia article "Pachelbel's Canon" (https://en.wikipedia.org/wiki/Pachelbel%27s_Canon), D major, Violin I and Cello; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `f46f13d5cbb6139aa15d704fc32d4feb3d039ce5ecfadc6e5b2e78d94ba34a95`.

## beethoven-fur-elise-easy.mid

- **Piece:** Für Elise, WoO 59, L. van Beethoven (1810).
- **Tune:** Beethoven died in 1827; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the theme (upbeat and bars 1-8, A minor) twice: the right hand as written, the left hand's broken chords reduced to their lowest note.
- **Checked against:** beethoven-fur-elise-woo59.mid in this folder (Mutopia 931, public domain) and the score in the Wikipedia article "Für Elise"; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `f8fb65c4ed40bc658827000a44ffef763d85bdf9947e69f471c1f0e94205b0a0`.

## bach-minuet-g-easy.mid

- **Piece:** Menuet in G major, BWV Anh. 114 (attributed to J. S. Bach, now usually to C. Petzold).
- **Tune:** early 18th century; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the right hand of the first part (16 bars) as written without the one ornament, the left hand one note a bar.
- **Checked against:** bach-menuet-g-bwv-anh-114.mid in this folder (Mutopia 75, public domain); compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `bc6346ccaa8bfb07a9a516949c1d5b4c868147936485c3644fb34a005f6942df`.

## leontovych-shchedryk-easy.mid

- **Piece:** «Щедрик», M. Leontovych (1877-1921), on the Ukrainian folk carol.
- **Tune:** Leontovych died in 1921; the choral setting is in the public domain (life + 70 years), and so is the folk tune. Only the notes are used, not the later English words. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the soprano line in the right hand (G minor, 33 bars: the four-note figure 16 times, the "В тебе товар" phrase, the scales and the return), played once through: the repeat and its first ending are left out, the closing G is held one bar instead of three, and the last bar (D C D G) is left out. The left hand, one note a bar, follows the falling alto and tenor lines of the choir, then the bass's Eb G C G an octave down when the bass enters (bar 13).
- **Checked against:** the score in the Wikipedia article "Shchedryk (song)" (https://en.wikipedia.org/wiki/Shchedryk_(song)) and "Щедрик.pdf" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Щедрик.pdf, from Leontovych's choral works, 1970, public domain); the Wikipedia score's LilyPond soprano read by a script (relative pitches, `\repeat unfold`, first time through, the held G one bar) and compared note for note (pitch, onset and written length) against the file's right hand; no differences (136 notes, 33 bars). An earlier version had 12 bars of the figure where the score has 16; the comparison found it and it is fixed. The test «two tunes against their scores» in `piano/tests/catalog.test.mjs` keeps the comparison. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `f7aec4ef1c4ae4f3c31ab68ee86396bc7e219456abc0ce0423c658b6126f5daf`.

## tchaikovsky-swan-lake-easy.mid

- **Piece:** Swan Lake, Act II No. 10 (Scène), the oboe theme, P. I. Tchaikovsky (1876).
- **Tune:** Tchaikovsky died in 1893; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the theme in the right hand (B minor; parts A, B and C, 25 bars), the last bar held as a whole note, a bass note a bar or half bar in the left.
- **Checked against:** "Theme lac des cygnes hautbois.svg" on Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Theme_lac_des_cygnes_hautbois.svg), its LilyPond source, public domain; compared note for note (pitch, onset and written length) by a script against the reference rendered to MIDI; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `2d3e3746063b1188ef962b860a70c0ecbc8e8e8c2a7c16af7e678c416a0e6f4c`.

## brahms-waltz-op39-15-easy.mid

- **Piece:** Waltz in A-flat major, Op. 39 No. 15, J. Brahms (1865).
- **Tune:** Brahms died in 1897; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: the top line of the first part in the right hand without its thirds and sixths (30 bars), a bass note a bar in the left, ending on A-flat.
- **Checked against:** brahms-waltz-op39-15.mid in this folder (Mutopia 794, public domain), its highest voice; compared note for note (pitch and onset) by a script; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `968a411862a702cac57cff13fff904ec4a8878e243a3b774fa9a9db439f81cc8`.

## tchaikovsky-old-french-song.mid

- **Piece:** Old French Song, Album for the Young, Op. 39 No. 16, P. I. Tchaikovsky.
- **Source:** The Mutopia Project, piece 2080, Music ID `Mutopia-2015/11/27-2080`, typeset from Schirmer, 1904.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080
  File: https://www.mutopiaproject.org/ftp/TchaikovskyPI/O39/16OldFrenchSong/16OldFrenchSong.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `112c3b61dab55f58bc44d9f3522ef21b3479ffa1953097783ff8c4f10e40175d`).

## beethoven-ode-to-joy.mid

- **Piece:** Ode to Joy (hymn tune, SATB chorale), L. van Beethoven.
- **Source:** The Mutopia Project, piece 528, Music ID `Mutopia-2009/08/05-528`, typeset from various editions.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528
  File: https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `fb1604c08c865b275b464d74e5a7c526ff1a8acccdf9853cb92f0778daaed14b`).

## greensleeves.mid

- **Piece:** Greensleeves (hymn tune, chorale), traditional.
- **Source:** The Mutopia Project, piece 1247, Music ID `Mutopia-2014/03/30-1247`, typeset from www.cyberhymnal.org.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1247
  File: https://www.mutopiaproject.org/ftp/Traditional/greensleeves/greensleeves.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `04a6e03dd6128aa291aa75e4df757bbba40567ef885eca18d14d51d9365cb8e8`).

## bach-menuet-g-bwv-anh-114.mid

- **Piece:** Menuet in G major, BWV Anh. 114, from the 1725 Notebook for Anna Magdalena Bach
  (attributed to J. S. Bach, now usually to Christian Petzold), two hands.
- **Source:** The Mutopia Project, piece 75, Music ID `Mutopia-2017/01/19-75`, typeset with
  LilyPond 2.19.49 from the Bach-Gesellschaft edition.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75
  File: https://www.mutopiaproject.org/ftp/BachJS/BWVAnh114/anna-magdalena-04/anna-magdalena-04.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `fd87a6673e18104047842a1c858d2c9d8eb9ad845d7a8fa46e3664b17642cb75`).

## burgmuller-la-candeur-op100-1.mid

- **Piece:** La Candeur, Op. 100 No. 1, J. F. F. Burgmüller.
- **Source:** The Mutopia Project, piece 202, Music ID `Mutopia-2013/01/12-202`, typeset from Collection Litolff, 19th century.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=202
  File: https://www.mutopiaproject.org/ftp/BurgmullerJFF/O100/25EF-01/25EF-01.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `ad185dbf3cb7e3e187cbe6e38c5ead706cf375b9d441f7191429027436b2a8e4`).

## clementi-sonatina-op36-1-i.mid

- **Piece:** Sonatina Op. 36 No. 1, first movement (Allegro), M. Clementi.
- **Source:** The Mutopia Project, piece 804, Music ID `Mutopia-2016/11/30-804`, typeset from Sonatina Album, G. Schirmer, 1893.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=804
  File: `sonatina-1.mid` from the archive https://www.mutopiaproject.org/ftp/ClementiM/O36/sonatina-1/sonatina-1-mids.zip
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `365dc51f22f89c005d71343df592d9b08fdc314042027989557f1eebcd8bc107`).

## bach-prelude-c-bwv-846.mid

- **Piece:** Prelude in C major, BWV 846 (Well-Tempered Clavier I), J. S. Bach.
- **Source:** The Mutopia Project, piece 5, Music ID `Mutopia-2011/09/12-5`, typeset from not stated.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5
  File: https://www.mutopiaproject.org/ftp/BachJS/BWV846/wtk1-prelude1/wtk1-prelude1.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `874e07d0479542971bfceaf420d6117da8d602d89d26eea4610e7dd1ef58bf26`).

## grieg-mountain-king-arr.mid

- **Piece:** In the Hall of the Mountain King, Peer Gynt Suite No. 1, Op. 46, E. Grieg (1875).
- **Tune:** Grieg died in 1907; in the public domain. Checked 2026-10-21.
- **Arrangement:** written for this trainer as note text in `piano/tools/arrangements.mjs` and written out by `piano/tools/build-songs.mjs`: an arrangement for the 61 keys: the theme in B minor, then in octaves, then in F-sharp major, then in octaves, then once more in B minor (21 bars), over the score's alternating bass, which is two octaves lower there than these keys reach.
- **Checked against:** the piano score of Mutopia 1888 (https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1888, public domain), bars 2-21; compared note for note (pitch and onset) by a script, each part with its octave transposition; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the arrangement is dedicated to the public domain.
- **File:** SHA-256 `5f96fa6f53aa98f64557035caf2b26308c677288270d8c91af6986d393320420`.

## schumann-traumerei-op15-7.mid

- **Piece:** Träumerei, Kinderszenen Op. 15 No. 7, R. Schumann.
- **Source:** The Mutopia Project, piece 504, Music ID `Mutopia-2005/12/27-504`, typeset from Leichte Stucke, 1900.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504
  File: https://www.mutopiaproject.org/ftp/SchumannR/O15/SchumannOp15No07/SchumannOp15No07.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `6e0045d5783ff28dedcf05813074fe407ca3846e5e2a7246f2793ac5614e4851`).

## chopin-prelude-a-major-op28-7.mid

- **Piece:** Prelude in A major, Op. 28 No. 7, F. Chopin.
- **Source:** The Mutopia Project, piece 470, Music ID `Mutopia-2015/01/17-470`, typeset from Edition Peters.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=470
  File: https://www.mutopiaproject.org/ftp/ChopinFF/O28/Chop-28-7/Chop-28-7.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `6eed7f2185afd852f01d695e50db84cdb4c8742de1a26294dc3202569346ef36`).

## strauss-blue-danube-theme.mid

- **Piece:** An der schönen blauen Donau (The Blue Danube), Op. 314, the main theme set for piano, J. Strauss II.
- **Source:** The Mutopia Project, piece 519, Music ID `Mutopia-2014/03/24-519`, typeset from Christian Mondrup, from the Werner Icking Music Archive.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=519
  File: https://www.mutopiaproject.org/ftp/StraussJJ/O314/blue_danube/blue_danube.mid
- **Licence:** CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Nikos Kouremenos
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `9de3cb52a3ef8a118369d22d49c33896080afd1113749e4c07c559a1502c4df4`).

## brown-toccatina.mid

- **Piece:** Toccatina, C. J. Brown (1947-2016), 2008: typeset from the manuscript for The Mutopia Project by permission of the composer.
- **Source:** The Mutopia Project, piece 1450, Music ID `Mutopia-2008/06/09-1450`, typeset from Typeset from the manuscript by permission of the composer.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1450
  File: https://www.mutopiaproject.org/ftp/BrownCJ/toccatina/toccatina.mid
- **Licence:** CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Silas Brown
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `158f49f07196516292ff667a2b2d2e791f0852425b32389396f7fec356ee64f3`).

## magnenat-variations-dautomne.mid

- **Piece:** Variations d'automne, S. Magnenat (2007): an original composition its composer published on The Mutopia Project.
- **Source:** The Mutopia Project, piece 973, Music ID `Mutopia-2007/05/03-973`, typeset from Own work.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=973
  File: https://www.mutopiaproject.org/ftp/MagnenatS/variations-automne/variations-automne.mid
- **Licence:** CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Stéphane Magnenat
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `401749a3700863b758fe004102d36e24c992c011b228f270ed9ba0ddc4e7f71a`).

## iliev-a-childs-wish.mid

- **Piece:** A Child's Wish, G. K. Iliev (2006): an original composition its composer published on The Mutopia Project.
- **Source:** The Mutopia Project, piece 727, Music ID `Mutopia-2013/03/23-727`, typeset from Grigor Iliev.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=727
  File: https://www.mutopiaproject.org/ftp/IlievGK/A_Childs_Wish/A_Childs_Wish.mid
- **Licence:** CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Grigor Iliev
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `d45812ee897295eaa766d8f9fd1102b0cd56e76a2333e096135f46cfb61a7bc0`).

## kumar-valse.mid

- **Piece:** Valse, R. Kumar (2002): an original composition its composer published on The Mutopia Project.
- **Source:** The Mutopia Project, piece 658, Music ID `Mutopia-2006/01/28-658`, typeset from Original composition.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=658
  File: https://www.mutopiaproject.org/ftp/KumarR/valse/valse.mid
- **Licence:** CC BY-SA 2.5 (https://creativecommons.org/licenses/by-sa/2.5/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Ramana Kumar
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `13b573bdd9667cebf9287e0dabdee31b4db1cc8e4096b960b6031c26d382d536`).

## satie-gymnopedie-1.mid

- **Piece:** Gymnopédie No. 1, E. Satie.
- **Source:** The Mutopia Project, piece 37, Music ID `Mutopia-2014/12/14-37`, typeset from Dover edition.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37
  File: https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `09ce7337b4bf42ba12e1aa64b4c7dc7fcfa6455f1070cb12f8880a755df97384`).

## beethoven-fur-elise-woo59.mid

- **Piece:** Für Elise, WoO 59, L. van Beethoven.
- **Source:** The Mutopia Project, piece 931, Music ID `Mutopia-2015/08/18-931`, typeset from Breitkopf & Härtel, 1888.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931
  File: https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/fur_Elise_WoO59.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `1c12c21c7bbf4cf163896732672648a69d497636059837abd153c71abe50215a`).

## chopin-prelude-e-minor-op28-4.mid

- **Piece:** Prelude in E minor, Op. 28 No. 4, F. Chopin.
- **Source:** The Mutopia Project, piece 468, Music ID `Mutopia-2016/10/28-468`, typeset from Peters, 1879.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=468
  File: https://www.mutopiaproject.org/ftp/ChopinFF/O28/Chop-28-4/Chop-28-4.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `c1d7e05aa4e6e2baeec2e9108402a969c16d5df302b82fd66d110634697f2e3b`).

## mozart-sonata-k545-i.mid

- **Piece:** Sonata in C major K. 545 (Sonata facile), first movement, W. A. Mozart.
- **Source:** The Mutopia Project, piece 998, Music ID `Mutopia-2013/09/01-998`, typeset from IMSLP.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998
  File: https://www.mutopiaproject.org/ftp/MozartWA/KV545/K545-1/K545-1.mid
- **Licence:** CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Alejandro Sierra
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `54e510ba1e5865aeedc4e96bf70b83c93ecddf5b66660033ef98a5a8204ab02d`).

## beethoven-moonlight-sonata-i.mid

- **Piece:** Piano Sonata No. 14, Op. 27 No. 2 (“Moonlight”), first movement, L. van Beethoven.
- **Source:** The Mutopia Project, piece 276, Music ID `Mutopia-2007/02/11-276`, typeset from Berners, 1908, edited by A. Winterberger.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=276
  File: `moonlight1.mid` from the archive https://www.mutopiaproject.org/ftp/BeethovenLv/O27/moonlight/moonlight-mids.zip
- **Licence:** CC BY-SA 2.5 (https://creativecommons.org/licenses/by-sa/2.5/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Stewart Holmes
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `a34e969c4957f0e9e98fc9ff0278cc1284931bdae6d463469797faa2b73a9c5c`).

## chopin-nocturne-op9-2.mid

- **Piece:** Nocturne in E-flat major, Op. 9 No. 2, F. Chopin.
- **Source:** The Mutopia Project, piece 1590, Music ID `Mutopia-2014/12/18-1590`, typeset from G. Schirmer, New York, 1881.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590
  File: https://www.mutopiaproject.org/ftp/ChopinFF/O9/chopin_nocturne_op9_n2/chopin_nocturne_op9_n2.mid
- **Licence:** CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Renato Biolcati Rinaldi
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `e202d3941ce5f26397f57f59f0e2e4e3ad9e19061fa3c4dc596c5ee6a6a2548e`).

## beethoven-pathetique-ii.mid

- **Piece:** Piano Sonata No. 8, Op. 13 ("Pathétique"), second movement (Adagio cantabile), L. van Beethoven.
- **Source:** The Mutopia Project, piece 295, Music ID `Mutopia-2011/10/25-295`, typeset from Berners, 1908 (edited by A. Winterberger); Peters, 1910.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=295
  File: https://www.mutopiaproject.org/ftp/BeethovenLv/O13/pathetique-2/pathetique-2.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `92c685ca98001473bcc21fa98110cc125ab489c1bf49be185e062d204a268492`).

## brahms-waltz-op39-15.mid

- **Piece:** Waltz in A-flat major, Op. 39 No. 15, J. Brahms.
- **Source:** The Mutopia Project, piece 794, Music ID `Mutopia-2006/07/30-794`, typeset from Ed. R. Joseffy.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=794
  File: https://www.mutopiaproject.org/ftp/BrahmsJ/O39/waltz-op39-15/waltz-op39-15.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `e081ef3fe7023cdf4656e1528df50534b2e3df863cd0a194a04a82206f783ace`).

## schubert-moment-musical-3.mid

- **Piece:** Moment musical No. 3 in F minor, D. 780, F. Schubert.
- **Source:** The Mutopia Project, piece 1023, Music ID `Mutopia-2007/08/11-1023`, typeset from Sauer & Leidersdorf, Wien, 1827.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023
  File: https://www.mutopiaproject.org/ftp/SchubertF/D780/MomentsNo3/MomentsNo3.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `77b5ccc3a0f33128f9f4c162743d6a484bbfaa952206b69584a4c14bafc60358`).

## doonan-enchanted-island.mid

- **Piece:** Enchanted Island, S. C. Doonan (1976): an original composition its composer published on The Mutopia Project.
- **Source:** The Mutopia Project, piece 536, Music ID `Mutopia-2005/08/06-536`, typeset from Composer.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=536
  File: https://www.mutopiaproject.org/ftp/DoonanSC/enchanted-island/enchanted-island.mid
- **Licence:** CC BY-SA 2.5 (https://creativecommons.org/licenses/by-sa/2.5/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Stephen Charles Doonan
  for The Mutopia Project.
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `313c8cdc875e47f3ffaaf475c2fdb427b27adcfbad816dfcb69a173e5c30bf16`).

## pachelbel-canon-d.mid

- **Piece:** Canon per 3 Violini e Basso (Canon in D), J. Pachelbel; the full score for three violins and bass.
- **Source:** The Mutopia Project, piece 2047, Music ID `Mutopia-2015/09/02-2047`, typeset from IMSLP.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047
  File: `canon_per_3_violini_e_basso.mid` from the archive https://www.mutopiaproject.org/ftp/PachelbelJ/Canon_per_3_Violini_e_Basso/Canon_per_3_Violini_e_Basso-mids.zip
- **Licence:** CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), as stated on the piece's Mutopia page (read 2026-10-21); the edition by Michael Fischer v. Mollard
  for The Mutopia Project.
- **Changes:** simplified for two hands on 2026-10-23: where the three violin parts strike more
  than one hand spans over the bass, 11 notes (doublings and inner voices) are left out and 15
  inner-voice notes are moved by an octave; the top voice, the bass and every other note are as
  downloaded. Each change and its reason: `piano/tools/simplify.mjs` and
  `docs/piano-fingering-audit.md`; `node piano/tools/build-songs.mjs` writes this file from the
  downloaded one, kept as `piano/tools/sources/pachelbel-canon-d.mid`
  (SHA-256 `953b73e270117d388e9ef1a76f8b9e97ff640d1400768849f41a3cf71c59cbc1`). This file:
  SHA-256 `a5a0df191b0874faa9875e63e54830b0da4202ca656831282a2a513ffc3ba523`.

## joplin-the-entertainer.mid

- **Piece:** The Entertainer, S. Joplin.
- **Source:** The Mutopia Project, piece 263, Music ID `Mutopia-2016/11/25-263`, typeset from reproduction of the original edition, 1902.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=263
  File: https://www.mutopiaproject.org/ftp/JoplinS/entertainer/entertainer.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `33e4e81ee64ffb2edf90d1c6a1ddee7276507296bfb915c2bb775231a467f066`).

## mozart-rondo-alla-turca-k331.mid

- **Piece:** Sonata K. 331, third movement, Rondo alla turca (Turkish March), W. A. Mozart.
- **Source:** The Mutopia Project, piece 108, Music ID `Mutopia-2015/08/13-108`, typeset from IMSLP.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108
  File: https://www.mutopiaproject.org/ftp/MozartWA/KV331/KV331_3_RondoAllaTurca/KV331_3_RondoAllaTurca.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `c14299cbdd34c8b2081da84dc06519ef8a52a0d589ee53c758d28b8e3d727d1c`).

## debussy-arabesque-1.mid

- **Piece:** Première Arabesque, L. 66 No. 1, C. Debussy (died 1918).
- **Source:** The Mutopia Project, piece 1777, Music ID `Mutopia-2011/10/25-1777`, typeset from Durand et Fils (1904).
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1777
  File: https://www.mutopiaproject.org/ftp/DebussyC/L66/debussy_Arabesque_1/debussy_Arabesque_1.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `6732dc10799ec0af47d19d9095562d0671864a750129e0279901def169a34757`).

## joplin-maple-leaf-rag.mid

- **Piece:** Maple Leaf Rag, S. Joplin (1899).
- **Source:** The Mutopia Project, piece 23, Music ID `Mutopia-2011/11/13-23`, typeset from Reproduction of original edition (1899).
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=23
  File: https://www.mutopiaproject.org/ftp/JoplinS/maple/maple.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `3dd712a85fabd267f5a2cee5cb23af4683408c2f29b8814721844498f1ee4f66`).

## chopin-waltz-op64-1.mid

- **Piece:** Waltz in D-flat major, Op. 64 No. 1 ("Minute Waltz"), F. Chopin.
- **Source:** The Mutopia Project, piece 483, Music ID `Mutopia-2015/01/17-483`, typeset from Edition Peters.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483
  File: https://www.mutopiaproject.org/ftp/ChopinFF/O64/chopin_valse_op64_no1/chopin_valse_op64_no1.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `62333ad9f9b22603d009734ab500330a12ac09aeca13d185ac0ba64a7fb9d206`).

## debussy-clair-de-lune.mid

- **Piece:** Suite bergamasque, L. 75: Clair de lune, C. Debussy.
- **Source:** The Mutopia Project, piece 1778, Music ID `Mutopia-2010/12/21-1778`, typeset from E. Fromont, 1905.
  Page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778
  File: https://www.mutopiaproject.org/ftp/DebussyC/L75/debussy_Ste_Bergamesq_Clair/debussy_Ste_Bergamesq_Clair.mid
- **Licence:** Public Domain, as stated on the piece's Mutopia page (read 2026-10-21).
- **Changes:** renamed only; the bytes are the downloaded file
  (SHA-256 `4eee9a1546ffde1ff74cb9824ba0e57cbc821185a15185bfea9faed97820bf8c`).

Only freely licensed files go into this folder. Personal practice files belong in the user's
own song folder (see the README), which is never committed.
