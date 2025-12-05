import type { Api } from '../preload';

export const appApi = (window as Window & { api: Api }).api;

export default appApi;
