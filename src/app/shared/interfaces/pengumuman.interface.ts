// shared/interfaces/announcement.interface.ts
export interface Announcement {
  noun_id: number;
  noun_title: string;
  noun_desc?: string;
}

export interface AnnouncementFull {
  noun_id: number;
  noun_title: string;
  noun_desc: string;
  trans_remark: string;
  month: string;
  file_image: string | null;
}

export interface PengumumanDoc {
  noun_id: number;
  noun_title: string;
  noun_desc: string;
  trans_remark: string;
  month: string;
  posters: string[];
  currentPosterIndex: number;
  autoSlideTimer?: any;
}

export interface PengumumanMonthGroup {
  month: string;
  docs: PengumumanDoc[];
}

export interface Poster {
  src: string;
  alt: string;
  caption: string;
}

export interface MobileNotif {
  noun_id: number;
  noun_notif: string;
}