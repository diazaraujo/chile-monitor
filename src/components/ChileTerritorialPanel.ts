import { Panel } from './Panel';
import { unsafeRawHtml } from '@/utils/sanitize';

/**
 * Chile Monitor — Brief territorial. Reads public/chile/brief-territorial.json,
 * written by scripts/chile-seed-territorial.py (Postgres IA → Ollama) every 4h.
 */
interface Hecho {
  n: number;
  tipo: 'ingreso' | 'calificacion' | 'tribunal' | 'conflicto' | 'incendio';
  rca?: string;
  detecciones?: number;
  altaConfianza?: number;
  frpMw?: number;
  proyecto?: string;
  titular?: string;
  region?: string;
  comuna?: string;
  via?: string;
  estado?: string;
  capex_musd?: number;
  fecha?: string;
  url?: string;
  tribunal?: string;
  materia?: string;
  resultado?: string;
  clase?: string;
}

interface BriefTerritorial {
  generatedAt: string;
  periodoDias: number;
  kpis: { ingresos: number; capexMusd: number; eia: number; regiones: number; calificaciones: { estado: string; n: number; capexMusd: number }[]; focosIncendio?: number | null; comunasConFuego?: number | null };
  incendios?: { fuente?: string; detecciones?: number; comunasAfectadas?: number };
  daa?: { disponible: boolean; nota?: string };
  regiones: { region: string; n: number; capexMusd: number }[];
  hechos: Hecho[];
  resumen: string;
  modelo: string;
}

const esc = (v: unknown): string => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const musd = (v?: number): string => (v && v > 0 ? `USD ${Math.round(v).toLocaleString('es-CL')} MM` : '');

export class ChileTerritorialPanel extends Panel {
  private data: BriefTerritorial | null = null;

  constructor() {
    super({
      id: 'territorial',
      title: 'Brief territorial',
      showCount: false,
      infoTooltip: 'Ingresos SEIA, transiciones de estado (RCA), incendios satelitales por comuna (NASA FIRMS), tribunales y conflictos de los últimos 7 días, desde la base Inteligencia Ambiental. Resumen generado por LLM local; cada afirmación cita su hecho [n].',
    });
    // ponytail: el data-loader agenda paneles uno a uno; este se carga solo al conectarse y refresca cada 15 min.
    this.runWhenConnected(() => {
      void this.fetchData();
      setInterval(() => { void this.fetchData(); }, 15 * 60 * 1000);
    });
  }

  public async fetchData(): Promise<boolean> {
    if (!this.hasData()) this.showLoading();
    try {
      const resp = await fetch('/chile/brief-territorial.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as BriefTerritorial;
      if (!json || !Array.isArray(json.hechos)) throw new Error('shape');
      this.data = json;
      this.render();
      return true;
    } catch (err) {
      if (!this.hasData()) this.showError(`Brief territorial no disponible (${(err as Error).message})`, () => { void this.fetchData(); });
      return false;
    }
  }

  public hasData(): boolean {
    return this.data !== null;
  }

  private hechoHtml(h: Hecho): string {
    const tag = { ingreso: 'INGRESO', calificacion: 'CALIFICACIÓN', tribunal: 'TRIBUNAL', conflicto: 'CONFLICTO', incendio: 'INCENDIOS' }[h.tipo] ?? h.tipo;
    const head = h.tipo === 'tribunal'
      ? `${esc(h.tribunal)} · ${esc(h.materia)}`
      : h.tipo === 'incendio'
        ? `${esc(h.comuna)}: ${h.detecciones ?? 0} focos (${h.altaConfianza ?? 0} alta confianza, FRP ${h.frpMw ?? 0} MW)`
        : `${esc(h.proyecto)}`;
    const meta = [
      h.via, h.estado, h.rca ? `RCA ${h.rca}` : '', h.clase, h.resultado, h.titular,
      [h.region, h.comuna].filter(Boolean).join(' / '),
      musd(h.capex_musd), h.fecha,
    ].filter(Boolean).map(esc).join(' · ');
    const title = h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">${head}</a>` : head;
    return `<li class="chile-hecho chile-hecho-${esc(h.tipo)}"><span class="chile-hecho-n">[${h.n}]</span> <span class="chile-hecho-tag">${tag}</span> ${title}<div class="chile-hecho-meta">${meta}</div></li>`;
  }

  private render(): void {
    const d = this.data;
    if (!d) return;
    const k = d.kpis;
    const calif = k.calificaciones.map((c) => `${esc(c.estado)} ${c.n}`).join(' · ') || 'sin calificaciones';
    const resumen = d.resumen
      ? `<p class="chile-brief-resumen">${esc(d.resumen).replace(/\[(\d{1,2})\]/g, '<sup>[$1]</sup>')}</p>`
      : '<p class="chile-brief-resumen chile-brief-degradado">Sin resumen LLM en esta corrida — los hechos siguen abajo.</p>';
    const regiones = d.regiones.map((r) => `${esc(r.region)} ${r.n}`).join(' · ');
    const html = `
      <div class="chile-brief">
        <div class="chile-brief-kpis">
          <span><strong>${k.ingresos}</strong> ingresos SEIA</span>
          <span><strong>${musd(k.capexMusd) || 'USD 0'}</strong></span>
          <span><strong>${k.eia}</strong> EIA</span>
          <span><strong>${k.regiones}</strong> regiones</span>
          ${k.focosIncendio != null ? `<span><strong>${k.focosIncendio}</strong> focos de incendio en ${k.comunasConFuego ?? 0} comunas</span>` : ''}
        </div>
        ${resumen}
        <div class="chile-brief-sub">Calificaciones: ${calif}</div>
        <div class="chile-brief-sub">Regiones: ${regiones}</div>
        ${d.daa && !d.daa.disponible ? `<div class="chile-brief-sub chile-brief-degradado">DAA constituidos: ${esc(d.daa.nota ?? 'sin fuente')}</div>` : ''}
        <ul class="chile-hechos">${d.hechos.map((h) => this.hechoHtml(h)).join('')}</ul>
        <div class="chile-brief-foot">Últimos ${d.periodoDias} días · generado ${esc(d.generatedAt.slice(0, 16).replace('T', ' '))} UTC${d.modelo ? ` · ${esc(d.modelo)}` : ''}</div>
      </div>`;
    this.setSafeContent(unsafeRawHtml(html, 'ChileTerritorialPanel escapes every dynamic value via esc() before building markup'));
  }
}
