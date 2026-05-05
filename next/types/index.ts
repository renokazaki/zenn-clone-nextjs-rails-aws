export type Article = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  fromToday: string;
  user: { name: string };
};

export type CurrentArticle = {
  id: number;
  title: string;
  content: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
};

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
};
