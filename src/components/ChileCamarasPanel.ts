import { Panel } from './Panel';
import { unsafeRawHtml } from '@/utils/sanitize';

/**
 * Chile Monitor — Cámaras por comuna. Lee public/chile/camaras.json
 * (catálogo del deep research, regenerable). Filtro por texto (comuna/región/
 * nombre); las cámaras YouTube se embeben al click, el resto abre su página.
 */
interface Camara {
  nombre: string;
  comuna?: string;
  region?: string;
  plataforma?: string;
  url: string;
  tipo?: string;
  videoId?: string;
}

interface Catalogo {
  generatedAt?: string;
  fuente?: string;
  camaras: Camara[];
}

const esc = (v: unknown): string => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const YT_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export class ChileCamarasPanel extends Panel {
  private data: Catalogo | null = null;
  private filtro = '';

  constructor() {
    super({
      id: 'camaras',
      title: 'Cámaras por comuna',
      showCount: true,
      infoTooltip: 'Catálogo de cámaras web públicas de Chile por comuna (tráfico, playas, volcanes, ciudades, ski). Generado por investigación automatizada; cada cámara viene de una fuente real. Las de YouTube se reproducen aquí; el resto abre su página.',
    });
    // ponytail: mismo patrón que ChileTerritorialPanel — se carga solo.
    this.runWhenConnected(() => { void this.fetchData(); });
  }

  public async fetchData(): Promise<boolean> {
    if (!this.hasData()) this.showLoading();
    try {
      const resp = await fetch('/chile/camaras.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as Catalogo;
      if (!json || !Array.isArray(json.camaras)) throw new Error('shape');
      this.data = json;
      this.render();
      return true;
    } catch (err) {
      if (!this.hasData()) this.showError(`Catálogo de cámaras no disponible (${(err as Error).message})`, () => { void this.fetchData(); });
      return false;
    }
  }

  public hasData(): boolean {
    return this.data !== null;
  }

  private camaraHtml(c: Camara, i: number): string {
    const yt = c.videoId || (YT_ID.exec(c.url)?.[1] ?? '');
    const meta = [c.comuna, c.region, c.tipo, c.plataforma].filter(Boolean).map(esc).join(' · ');
    const play = yt
      ? `<button class="chile-cam-play" data-yt="${esc(yt)}" data-i="${i}">▶ Ver acá</button>`
      : '';
    return `<li class="chile-cam" data-i="${i}">
      <div class="chile-cam-head"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.nombre)}</a>${play}</div>
      <div class="chile-cam-meta">${meta}</div>
      <div class="chile-cam-embed" id="chile-cam-embed-${i}"></div>
    </li>`;
  }

  private render(): void {
    const d = this.data;
    if (!d) return;
    const f = this.filtro.trim().toLowerCase();
    const cams = d.camaras.filter((c) => !f
      || [c.nombre, c.comuna, c.region, c.tipo].some((v) => (v || '').toLowerCase().includes(f)));
    const comunas = new Set(d.camaras.map((c) => c.comuna).filter(Boolean));
    this.setCount(cams.length);
    const html = `
      <div class="chile-cams">
        <input class="chile-cam-buscar" type="search" placeholder="Filtrar por comuna, región o nombre…" value="${esc(this.filtro)}" />
        <div class="chile-brief-sub">${d.camaras.length} cámaras · ${comunas.size} comunas${d.generatedAt ? ` · actualizado ${esc(String(d.generatedAt).slice(0, 10))}` : ''}</div>
        <ul class="chile-hechos chile-cam-lista">${cams.slice(0, 120).map((c, i) => this.camaraHtml(c, i)).join('')}</ul>
        ${cams.length > 120 ? `<div class="chile-brief-sub">Mostrando 120 de ${cams.length} — afina el filtro.</div>` : ''}
      </div>`;
    this.setSafeContent(unsafeRawHtml(html, 'ChileCamarasPanel escapes every dynamic value via esc() before building markup'));
    const input = this.content.querySelector<HTMLInputElement>('.chile-cam-buscar');
    input?.addEventListener('input', () => { this.filtro = input.value; this.render(); });
    if (this.filtro) { input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }
    this.content.querySelectorAll<HTMLButtonElement>('.chile-cam-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = this.content.querySelector(`#chile-cam-embed-${btn.dataset.i}`);
        if (!slot) return;
        if (slot.childElementCount > 0) { slot.replaceChildren(); return; }
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${btn.dataset.yt}?autoplay=1&mute=1&playsinline=1`;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.className = 'chile-cam-iframe';
        slot.replaceChildren(iframe);
      });
    });
  }
}
