# Warm-ups in this folder

The exercises played before a song (see `docs/piano-warmups.md`). All of them are written for this
trainer as note text in `piano/tools/warmups.mjs` and turned into MIDI by
`piano/tools/build-songs.mjs`, which a test runs again to check the bytes; all are dedicated to the
public domain (CC0 1.0).

- **Hanon's exercises 1 and 2** (source `arrangement`) are transcribed from *The Virtuoso Pianist*
  (1873), which is in the public domain, and were compared note for note by a script with the
  Mutopia Project's edition rendered to MIDI. That edition was used only to check the notes;
  nothing of it is copied here.
- **The other exercises** (source `exercise`) are standard teaching patterns: five-finger
  positions, scales, arpeggios and the drop-and-roll. Each section names the open textbook chapter
  that describes the pattern; only the pattern is used, no text or notation of the book.

`catalog.json` lists the warm-ups with their audience, group, key, tempo, passes, a short
instruction, and the length, metrics and defaults worked out from the notes;
`tests/warmups.test.mjs` and `tools/check-licences.mjs` check every hash below against the bytes.

## warmup-child-steps-c.mid

- **Exercise:** «Сходинки й стрибки», C major: right hand only, the five-finger position from C4, steps up and down twice, then the skips 1-3-5-3-1 twice; one key at a time.
- **Pattern:** the major five-finger pattern (whole, whole, half, whole step), as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapter 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `ee63818867abe654002c2df0cb3e3a0df4d0b8beeb5e90528f440ae29ef9e719`.

## warmup-child-steps-g.mid

- **Exercise:** «Сходинки й стрибки», G major: right hand only, the five-finger position from G4, steps up and down twice, then the skips 1-3-5-3-1 twice; one key at a time.
- **Pattern:** the major five-finger pattern (whole, whole, half, whole step), as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapter 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `2a9a1b71906ad9b7a8255ce68110d54949231177b5c1979c672f7afbbc48a4b5`.

## warmup-child-knock-c.mid

- **Exercise:** «Кожен пальчик стукає», C major: right hand only, each finger of the C position plays its key three times, from the thumb to the fifth finger and back; one key at a time.
- **Pattern:** the major five-finger pattern, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapter 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `d176227f599100042b2a897cf6c713268f9c548c9d0c36c8e30054984f820def`.

## warmup-drop-roll-c.mid

- **Exercise:** «Опустити й перекотити», C major: the hand drops with its weight into the fifth C-G (fingers 1 and 5), rolls onto E (finger 3), and rests a bar; twice with the right hand, twice with the left, twice together.
- **Pattern:** the "Two-Note Slur Drop and Roll" warm-up in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapter 1 "Fundamentals of Piano Technique", section "Warming Up" (https://openbooks.library.baylor.edu/pianobasics/chapter/fundamentals-of-piano-technique/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `41009663d8b56ac7f3c71de34fcff3cf59c6ec93e3149fbfb2c876ddd5407e03`.

## warmup-five-finger-c.mid

- **Exercise:** «П’ять пальців», C major: fingers 1-2-3-4-5-4-3-2-1 with the right hand from C4, the left hand an octave lower, then both together twice, then the tonic chord broken and as a block chord.
- **Pattern:** the major five-finger pattern and the tonic triad, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/; the same whole, whole, half, whole steps from any key) and 10 "Tonic Triad" (https://openbooks.library.baylor.edu/pianobasics/chapter/tonic-triad/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `f14baea2ff883a0e7e6a8c9b56e8eb9c17f2827c9b948cfb08604abcd12a7ec3`.

## warmup-five-finger-g.mid

- **Exercise:** «П’ять пальців», G major: fingers 1-2-3-4-5-4-3-2-1 with the right hand from G4, the left hand an octave lower, then both together twice, then the tonic chord broken and as a block chord.
- **Pattern:** the major five-finger pattern and the tonic triad, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/; the same whole, whole, half, whole steps from any key) and 10 "Tonic Triad" (https://openbooks.library.baylor.edu/pianobasics/chapter/tonic-triad/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `0994b60ed095144e8936c810804b50e640555350064addb77522451809be095e`.

## warmup-five-finger-d.mid

- **Exercise:** «П’ять пальців», D major: fingers 1-2-3-4-5-4-3-2-1 with the right hand from D4, the left hand an octave lower, then both together twice, then the tonic chord broken and as a block chord.
- **Pattern:** the major five-finger pattern and the tonic triad, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/; the same whole, whole, half, whole steps from any key) and 10 "Tonic Triad" (https://openbooks.library.baylor.edu/pianobasics/chapter/tonic-triad/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `de3c27c0f95bb8156639fd4088c947f01069fc92ad3e1ddb41898ef0e86bf730`.

## warmup-five-finger-f.mid

- **Exercise:** «П’ять пальців», F major: fingers 1-2-3-4-5-4-3-2-1 with the right hand from F4, the left hand an octave lower, then both together twice, then the tonic chord broken and as a block chord.
- **Pattern:** the major five-finger pattern and the tonic triad, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/; the same whole, whole, half, whole steps from any key) and 10 "Tonic Triad" (https://openbooks.library.baylor.edu/pianobasics/chapter/tonic-triad/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `275e1f44a78b23a3e5e91f0320d087a98a33f2c3b63df4ac98b577d8b0366445`.

## warmup-five-finger-bb.mid

- **Exercise:** «П’ять пальців», B-flat major: fingers 1-2-3-4-5-4-3-2-1 with the right hand from Bb3, the left hand an octave lower, then both together twice, then the tonic chord broken and as a block chord.
- **Pattern:** the major five-finger pattern and the tonic triad, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/; the same whole, whole, half, whole steps from any key) and 10 "Tonic Triad" (https://openbooks.library.baylor.edu/pianobasics/chapter/tonic-triad/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `542a76263d0c533f68ef0193fa10cd159c61af25d7c6b1c996dc0bf4dfdc674f`.

## warmup-five-finger-eb.mid

- **Exercise:** «П’ять пальців», E-flat major: fingers 1-2-3-4-5-4-3-2-1 with the right hand from Eb4, the left hand an octave lower, then both together twice, then the tonic chord broken and as a block chord.
- **Pattern:** the major five-finger pattern and the tonic triad, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/; the same whole, whole, half, whole steps from any key) and 10 "Tonic Triad" (https://openbooks.library.baylor.edu/pianobasics/chapter/tonic-triad/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `4982a9516bb5e2564d5088cfec116ada592187e9133888e23c68e8d815dc5dea`.

## warmup-five-finger-ab.mid

- **Exercise:** «П’ять пальців», A-flat major: fingers 1-2-3-4-5-4-3-2-1 with the right hand from Ab3, the left hand an octave lower, then both together twice, then the tonic chord broken and as a block chord.
- **Pattern:** the major five-finger pattern and the tonic triad, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 8 "Major Five-Finger Patterns" (https://openbooks.library.baylor.edu/pianobasics/chapter/major-five-finger-patterns/; the same whole, whole, half, whole steps from any key) and 10 "Tonic Triad" (https://openbooks.library.baylor.edu/pianobasics/chapter/tonic-triad/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `ad10a4523cf26444ba4aeb08ae35ac8ea5211617dd8b387075ecda4f67a75b08`.

## warmup-scale-c-contrary.mid

- **Exercise:** «Гама до мажор: кожна рука й протирух»: one octave up and down with the right hand from C4, the left from C3, then the hands in contrary motion (the right up from C4, the left down from C3) and back.
- **Pattern:** the one-octave major scale with its fingering (right hand 1-2-3-1-2-3-4-5, left hand 5-4-3-2-1-3-2-1) and contrary motion, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapter 23 "One-Octave Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/one-octave-major-scales/). The book starts contrary motion with both thumbs on middle C; here the hands start an octave apart, so that no key is played by both hands at once. Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `855a61a179875f3ec734ff73df9e6f59eaabc8fc4a3b17bbdbfeaa9fb872836f`.

## warmup-hanon-01.mid

- **Piece:** Charles-Louis Hanon (1819-1900), *The Virtuoso Pianist* (*Le Pianiste virtuose*), Part I, exercise 1; first published in 1873; in the public domain. The Schirmer edition (New York, n.d. [1900], English text by Theodore Baker) is on IMSLP (https://imslp.org/wiki/The_Virtuoso_Pianist_(Hanon,_Charles-Louis)), marked Public Domain there. Checked 2026-10-21.
- **Arrangement:** transcribed for this trainer as note text in `piano/tools/warmups.mjs` and written out by `piano/tools/build-songs.mjs`: the whole exercise, ascending and descending two octaves, played once without its repeat, 2/4 at ♩ = 60 (Hanon: 60 rising to 108). Both hands play one octave higher than printed (right hand from C4, left from C3), because the printed left hand of exercise 1 descends to the B below the lowest C of the 61 keys.
- **Checked against:** Mutopia Project piece 2037, "The Virtuoso Pianist (Part I)" (https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2037), typeset from the Schirmer 1900 edition, CC BY-SA 4.0, its file `hanon01.mid` from `virtuoso-pianist-pt1-mids.zip`; compared by a script: pitch (one octave up), onset and written length of all 466 notes, the right hand the upper note of each octave pair; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the transcription is dedicated to the public domain.
- **File:** SHA-256 `cf3296317a145b5904a07a0366317fa6cfb45f676f0331c7b06ab5dbe802a1c6`.

## warmup-hanon-02.mid

- **Piece:** Charles-Louis Hanon (1819-1900), *The Virtuoso Pianist* (*Le Pianiste virtuose*), Part I, exercise 2; first published in 1873; in the public domain. The Schirmer edition (New York, n.d. [1900], English text by Theodore Baker) is on IMSLP (https://imslp.org/wiki/The_Virtuoso_Pianist_(Hanon,_Charles-Louis)), marked Public Domain there. Checked 2026-10-21.
- **Arrangement:** transcribed for this trainer as note text in `piano/tools/warmups.mjs` and written out by `piano/tools/build-songs.mjs`: the whole exercise, ascending and descending two octaves, played once without its repeat, 2/4 at ♩ = 60 (Hanon: 60 rising to 108). Both hands play one octave higher than printed (right hand from C4, left from C3), because the printed left hand of exercise 1 descends to the B below the lowest C of the 61 keys.
- **Checked against:** Mutopia Project piece 2037, "The Virtuoso Pianist (Part I)" (https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2037), typeset from the Schirmer 1900 edition, CC BY-SA 4.0, its file `hanon02.mid` from `virtuoso-pianist-pt1-mids.zip`; compared by a script: pitch (one octave up), onset and written length of all 450 notes, the right hand the upper note of each octave pair; no differences. Checked 2026-10-21.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the transcription is dedicated to the public domain.
- **File:** SHA-256 `19120c05539a2e4e580fe596ffe99ccf6b26a881ceb83aa23350e8ccc41a849e`.

## warmup-scale-arpeggio-c.mid

- **Exercise:** «Гама й арпеджіо», C major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 30 "Two-Octave Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-scales/) and 61 "Two-Octave Major Arpeggios" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-arpeggios/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `b283da1befddd63ef406ae65eb4e648aba4371cfa9ea1341028d302b27af7955`.

## warmup-scale-arpeggio-g.mid

- **Exercise:** «Гама й арпеджіо», G major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 30 "Two-Octave Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-scales/) and 61 "Two-Octave Major Arpeggios" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-arpeggios/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `779a9a7db2ffde338ff7bb217f0d911d4df16a3e0986d8b30fb118c130cc9c90`.

## warmup-scale-arpeggio-d.mid

- **Exercise:** «Гама й арпеджіо», D major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 30 "Two-Octave Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-scales/) and 61 "Two-Octave Major Arpeggios" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-arpeggios/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `98ca0116c4346dd8d7d5b8056c1420175a4a2b07b3ac6c7038219ec8e520ad49`.

## warmup-scale-arpeggio-f.mid

- **Exercise:** «Гама й арпеджіо», F major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 30 "Two-Octave Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-scales/) and 61 "Two-Octave Major Arpeggios" (https://openbooks.library.baylor.edu/pianobasics/chapter/two-octave-major-arpeggios/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `1045b487104e182170f289b5b7275d5337135246963d185401be0f91ffbd106c`.

## warmup-scale-arpeggio-bb.mid

- **Exercise:** «Гама й арпеджіо», B-flat major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 101 "B-flat, E-flat, and A-flat Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/b-flat-e-flat-a-flat-major-scales/) and 102 "B-flat Major Arpeggio" (https://openbooks.library.baylor.edu/pianobasics/chapter/b-flat-major-arpeggio/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `0002efd12feee0514461e7d07ad9e4da1cea7d7bbb4c5f14a1b05cffa04bc491`.

## warmup-scale-arpeggio-eb.mid

- **Exercise:** «Гама й арпеджіо», E-flat major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 101 "B-flat, E-flat, and A-flat Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/b-flat-e-flat-a-flat-major-scales/) and 95 "D-flat, A-flat, and E-flat Major Arpeggios" (https://openbooks.library.baylor.edu/pianobasics/chapter/d-flat-a-flat-and-e-flat-major-arpeggios/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `a44dc36d3fd9b8085e793757fadc7ce83ec23993539cf40e311f5881f51f8c45`.

## warmup-scale-arpeggio-ab.mid

- **Exercise:** «Гама й арпеджіо», A-flat major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 101 "B-flat, E-flat, and A-flat Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/b-flat-e-flat-a-flat-major-scales/) and 95 "D-flat, A-flat, and E-flat Major Arpeggios" (https://openbooks.library.baylor.edu/pianobasics/chapter/d-flat-a-flat-and-e-flat-major-arpeggios/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `1ed0c16cc66f9eb3560a53d6a01fbc714bcc70658d56bcaa6af12486722b8b9c`.

## warmup-scale-arpeggio-db.mid

- **Exercise:** «Гама й арпеджіо», D-flat major: two octaves, hands together an octave apart, in eighths, then in sixteenths; then the tonic arpeggio over two octaves in triplets, twice.
- **Pattern:** two-octave major scales and arpeggios with their fingerings, as in Michael Clark, *Baylor Piano Basics* (Baylor University, open textbook, CC BY-NC-SA 4.0), chapters 87 "D-flat and G-flat Major Scales" (https://openbooks.library.baylor.edu/pianobasics/chapter/d-flat-and-g-flat-major-scales/) and 95 "D-flat, A-flat, and E-flat Major Arpeggios" (https://openbooks.library.baylor.edu/pianobasics/chapter/d-flat-a-flat-and-e-flat-major-arpeggios/). Read 2026-10-21.
- **Written:** for this trainer, as note text in `piano/tools/warmups.mjs`, written out by `piano/tools/build-songs.mjs`.
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): the exercise is dedicated to the public domain.
- **File:** SHA-256 `a10764c6fa6eb86d66a6361242c790d38decef4030f2bfc62b20933bc301b4aa`.
