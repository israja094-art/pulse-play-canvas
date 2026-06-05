import { registerPlugin } from '@capacitor/core';

export type DeleteMediaResult = {
  deleted: boolean;
  count: number;
};

export type MediaDeletePlugin = {
  deleteMedia(options: { paths: string[] }): Promise<DeleteMediaResult>;
};

export const MediaDelete = registerPlugin<MediaDeletePlugin>('MediaDelete');
