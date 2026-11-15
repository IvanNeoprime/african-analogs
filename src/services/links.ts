/** Shareable address of a study (hash route handled by App). */
export const studyLink = (sampleId: string) =>
  `${window.location.origin}${window.location.pathname}#/comunidade/estudo/${encodeURIComponent(sampleId)}`;
