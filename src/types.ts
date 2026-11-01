export interface Click {
  at: string;
  referrer: string | null;
  userAgent: string | null;
}

export interface Link {
  slug: string;
  url: string;
  createdAt: string;
  expiresAt: string | null;
  clicks: Click[];
}

export interface LinkRepository {
  create(link: Link): Promise<void>;
  findBySlug(slug: string): Promise<Link | undefined>;
  list(): Promise<Link[]>;
  delete(slug: string): Promise<boolean>;
  addClick(slug: string, click: Click): Promise<void>;
}
