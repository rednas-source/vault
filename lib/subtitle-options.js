'use strict';

const MODELS = new Set(['tiny', 'base', 'small', 'medium', 'large-v3', 'turbo']);
const PROFILES = { fast: 'base', balanced: 'small', accurate: 'medium' };
function subtitleModel(request, configured = 'small') {
  return (Object.hasOwn(PROFILES, request.profile) ? PROFILES[request.profile] : null) || (MODELS.has(request.model) ? request.model : MODELS.has(configured) ? configured : 'small');
}
function cudaFailure(message) {
  return /cuda|cudnn|cublas|nvidia|driver version|libctranslate/i.test(String(message));
}
function subtitleEstimate(job, now = Date.now()) {
  const elapsed = Math.max(0, (now - (job.transcribingAt || now)) / 1000);
  const processed = Number(job.processedSeconds) || 0, duration = Number(job.durationSeconds) || 0;
  const speed = elapsed >= 5 && processed > 0 ? processed / elapsed : 0;
  return { elapsedSeconds: Math.round(elapsed), speed: Math.round(speed * 10) / 10,
    remainingSeconds: speed > 0 && duration > processed ? Math.ceil((duration - processed) / speed) : null };
}
module.exports = { subtitleModel, cudaFailure, subtitleEstimate };
