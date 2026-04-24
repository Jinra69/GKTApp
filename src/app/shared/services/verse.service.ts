// shared/services/verse.service.ts
import { Injectable } from '@angular/core';
import { Verse, VersePool } from '../interfaces/verse.interface';

@Injectable({ providedIn: 'root' })
export class VerseService {
  private versePool: VersePool[] = [
    { book: 'Yohanes', chapter: 3, verse: 16 },
    { book: 'Mazmur', chapter: 23, verse: 1 },
    { book: 'Yeremia', chapter: 29, verse: 11 },
    { book: 'Filipi', chapter: 4, verse: 13 },
    { book: 'Roma', chapter: 8, verse: 28 },
    { book: 'Amsal', chapter: 3, verse: 5 },
    { book: 'Yesaya', chapter: 40, verse: 31 },
    { book: 'Matius', chapter: 11, verse: 28 },
    { book: 'Mazmur', chapter: 46, verse: 1 },
    { book: 'Galatia', chapter: 2, verse: 20 },
    { book: 'Efesus', chapter: 2, verse: 8 },
    { book: '1 Korintus', chapter: 13, verse: 4 },
    { book: 'Amsal', chapter: 22, verse: 6 },
    { book: 'Yosua', chapter: 1, verse: 9 },
    { book: 'Mazmur', chapter: 119, verse: 105 },
    { book: 'Roma', chapter: 12, verse: 2 },
    { book: '2 Timotius', chapter: 1, verse: 7 },
    { book: 'Matius', chapter: 5, verse: 9 },
    { book: 'Yohanes', chapter: 14, verse: 6 },
    { book: 'Filipi', chapter: 4, verse: 7 },
  ];

  async loadDailyVerse(): Promise<Verse> {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'gkt_daily_verse';
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.date === today && parsed.text && parsed.ref) {
          return { text: parsed.text, ref: parsed.ref };
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    const idx = this.getDayOfYear() % this.versePool.length;
    const pick = this.versePool[idx];

    try {
      const url = `https://query.bibleget.io/?passage=${encodeURIComponent(pick.book + ' ' + pick.chapter + ':' + pick.verse)}&version=tb`;
      const data = await (await fetch(url)).json();
      const text = data?.[0]?.verses?.[0]?.text?.trim() ?? '';
      
      if (text) {
        const verse = { text, ref: `${pick.book} ${pick.chapter}:${pick.verse}` };
        localStorage.setItem(cacheKey, JSON.stringify({ date: today, ...verse }));
        return verse;
      }
    } catch {}
    
    return this.getFallbackVerse();
  }

  private getFallbackVerse(): Verse {
    return {
      text: 'Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.',
      ref: 'Yohanes 3:16'
    };
  }

  private getDayOfYear(): number {
    const now = new Date();
    return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  }
}