import type { LayerExplanation } from '@/config/map-layer-definitions';
import { escapeHtml } from '@/utils/sanitize';
import { getCurrentLanguage } from '@/services/i18n';
import { LAYER_EXPLANATIONS_ES } from '@/config/layer-explanations-es';

export function renderLayerExplanationCard(layerLabel: string, explanation: LayerExplanation): string {
  // chile-monitor: fichas y etiquetas en español cuando el idioma activo es es.
  const es = getCurrentLanguage().startsWith('es');
  if (es) {
    const override = LAYER_EXPLANATIONS_ES[explanation.key as string]
      ?? (explanation.coverage === 'fallback' ? LAYER_EXPLANATIONS_ES.__fallback : undefined);
    if (override) explanation = { ...explanation, ...override };
  }
  const L = es
    ? { source: 'Fuente', freshness: 'Actualización', confidence: 'Confianza', limitations: 'Limitaciones', related: 'Relacionado', grounded: 'Basado en', guide: 'Guía de la capa', curated: 'Curada v1', fallback: 'Genérica' }
    : { source: 'Source', freshness: 'Freshness', confidence: 'Confidence', limitations: 'Limitations', related: 'Related', grounded: 'Grounded in', guide: 'Layer guide', curated: 'Curated v1', fallback: 'Fallback' };
  const list = (items: string[]): string => items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const related = explanation.related.length > 0
    ? explanation.related.map(item => `<span>${escapeHtml(item)}</span>`).join('')
    : `<span>${L.guide}</span>`;
  const evidence = explanation.evidence.length > 0
    ? `<div class="layer-explanation-grounding"><span>${L.grounded}</span>${explanation.evidence.map(item => `<code>${escapeHtml(item)}</code>`).join('')}</div>`
    : '';
  const coverageLabel = explanation.coverage === 'curated' ? L.curated : L.fallback;

  return `
    <div class="layer-explanation-header">
      <div>
        <span class="layer-explanation-kicker">${escapeHtml(explanation.category)}</span>
        <strong>${escapeHtml(layerLabel)}</strong>
      </div>
      <button class="layer-explanation-close" aria-label="Close">×</button>
    </div>
    <div class="layer-explanation-content">
      <div class="layer-explanation-status ${explanation.coverage}">${coverageLabel}</div>
      <p class="layer-explanation-purpose">${escapeHtml(explanation.purpose)}</p>
      <div class="layer-explanation-grid">
        <section>
          <span>${L.source}</span>
          <p>${escapeHtml(explanation.source)}</p>
        </section>
        <section>
          <span>${L.freshness}</span>
          <p>${escapeHtml(explanation.freshness)}</p>
        </section>
        <section>
          <span>${L.confidence}</span>
          <p>${escapeHtml(explanation.confidence)}</p>
        </section>
      </div>
      <div class="layer-explanation-section">
        <span>${L.limitations}</span>
        <ul>${list(explanation.limitations)}</ul>
      </div>
      <div class="layer-explanation-section">
        <span>${L.related}</span>
        <div class="layer-explanation-related">${related}</div>
      </div>
      ${evidence}
    </div>
  `;
}
