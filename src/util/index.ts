export * from './store';

import { CONFIG } from '@digital-assistant/core';

export const generateShareUrl = (recordingId: string): string => {
  const params = new URLSearchParams(window.location.search);
  params.set(CONFIG.UDA_URL_Param, recordingId);
  return window.location.href.split('?')[0] + '?' + params.toString();
};
