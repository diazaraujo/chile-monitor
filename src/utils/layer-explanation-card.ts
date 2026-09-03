import type { LayerExplanation } from '@/config/map-layer-definitions';
import { escapeHtml } from '@/utils/sanitize';
import { isSpanishUi } from '@/utils/ui-lang';
import { LAYER_EXPLANATIONS_ES } from '@/config/layer-explanations-es';

const ES_LABELS: Record<string, string> = {
  Source: 'Fuente', Freshness: 'Actualización', Confidence: 'Confianza', Limitations: 'Limitaciones',
  Related: 'Relacionado', 'Grounded in': 'Basado en', 'Layer guide': 'Guía de la capa', 'Curated v1': 'Curada v1', Fallback: 'Genérica',
};

export function renderLayerExplanationCard(layerLabel: string, explanation: LayerExplanation): string {
  // chile-monitor: fichas y etiquetas en español cuando el idioma activo es es.
  const es = isSpanishUi();
  if (es) {
    const override = LAYER_EXPLANATIONS_ES[explanation.key as string]
      ?? (explanation.coverage === 'fallback' ? LAYER_EXPLANATIONS_ES.__fallback : undefined);
    if (override) explanation = { ...explanation, ...override };
  }
  const list = (items: string[]): string => items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const related = explanation.related.length > 0
    ? explanation.related.map(item => `<span>${escapeHtml(item)}</span>`).join('')
    : `<span>Layer guide</span>`;
  const evidence = explanation.evidence.length > 0
    ? `<div class="layer-explanation-grounding"><span>Grounded in</span>${explanation.evidence.map(item => `<code>${escapeHtml(item)}</code>`).join('')}</div>`
    : '';
  const coverageLabel = explanation.coverage === 'curated' ? 'Curated v1' : 'Fallback';

  const html = `
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
          <span>Source</span>
          <p>${escapeHtml(explanation.source)}</p>
        </section>
        <section>
          <span>Freshness</span>
          <p>${escapeHtml(explanation.freshness)}</p>
        </section>
        <section>
          <span>Confidence</span>
          <p>${escapeHtml(explanation.confidence)}</p>
        </section>
      </div>
      <div class="layer-explanation-section">
        <span>Limitations</span>
        <ul>${list(explanation.limitations)}</ul>
      </div>
      <div class="layer-explanation-section">
        <span>Related</span>
        <div class="layer-explanation-related">${related}</div>
      </div>
      ${evidence}
    </div>
  `;
  // Etiquetas en inglés literales en el template (tests/layer-explanations las lee del fuente);
  // en español se sustituyen sobre el HTML ya armado.
  return es ? Object.entries(ES_LABELS).reduce((h, [en, esl]) => h.split(`>${en}<`).join(`>${esl}<`), html) : html;
}
