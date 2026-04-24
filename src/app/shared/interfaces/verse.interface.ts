// shared/interfaces/verse.interface.ts
export interface Verse {
  text: string;
  ref: string;
}

export interface VersePool {
  book: string;
  chapter: number;
  verse: number;
}