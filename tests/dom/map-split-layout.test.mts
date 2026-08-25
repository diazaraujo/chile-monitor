import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventHandlerManager } from '@/app/event-handlers';
import {
  MAP_COL_MIN_PX,
  PANELS_COL_MIN_PX,
  MAP_COL_DIVIDER_PX,
  SPLIT_LAYOUT_MIN_WIDTH,
} from '@/app/split-layout';

// Behavioral contract for issue #6417: the split layout activates at the
// unified breakpoint, the map column clamps to the widened bounds (a
// percentage floor tightened by pixel floors on both sides), the divider
// works by touch, the map can sit on either side, and the two height modes
// stop sharing one storage key.

describe('map split layout (#6417)', () => {
  let resize: ReturnType<typeof vi.fn>;
  let manager: EventHandlerManager;

  function stubInnerWidth(value: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value });
  }

  function buildSplitDom(totalWidth: number): { main: HTMLElement; handle: HTMLElement } {
    const main = document.createElement('main');
    main.className = 'main-content';
    Object.defineProperty(main, 'offsetWidth', { configurable: true, value: totalWidth });
    main.style.setProperty('--map-col-width', '60%');
    const section = document.createElement('section');
    section.id = 'mapSection';
    const handle = document.createElement('div');
    handle.id = 'mapWidthResizeHandle';
    main.append(section, handle);
    document.body.append(main);
    return { main, handle };
  }

  function buildHeightDom(): { section: HTMLElement; container: HTMLElement; handle: HTMLElement } {
    const section = document.createElement('section');
    section.id = 'mapSection';
    Object.defineProperty(section, 'offsetHeight', { configurable: true, value: 500 });
    const container = document.createElement('div');
    container.id = 'mapContainer';
    Object.defineProperty(container, 'offsetHeight', { configurable: true, value: 500 });
    const handle = document.createElement('div');
    handle.id = 'mapResizeHandle';
    const bottomGrid = document.createElement('div');
    bottomGrid.id = 'mapBottomGrid';
    section.append(container, handle, bottomGrid);
    document.body.append(section);
    return { section, container, handle };
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    resize = vi.fn();
    manager = new EventHandlerManager({
      container: document.createElement('div'),
      isDesktopApp: false,
      panels: {},
      panelSettings: {},
      mapLayers: {},
      map: { resize, setIsResizing: vi.fn() },
    } as never, {} as never);
  });

  afterEach(() => {
    manager.destroy();
    document.body.replaceChildren();
    localStorage.clear();
  });

  describe('map column width bounds', () => {
    it('allows dragging the map below 25% down to the pixel floor', () => {
      // 2200px: MAP_COL_MIN_PX (220) is exactly 10%, so the percentage
      // floor and the pixel floor agree.
      const { main, handle } = buildSplitDom(2200);
      manager.setupMapWidthResize();

      expect(handle.getAttribute('aria-valuemin')).toBe('10');
      expect(handle.getAttribute('aria-valuemax')).toBe('75');

      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 1320, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(main.style.getPropertyValue('--map-col-width')).toBe('10.0%');
      expect(handle.getAttribute('aria-valuenow')).toBe('10');
      expect(localStorage.getItem('map-col-width')).toBe('10.0%');
    });

    it('keeps the pixel floor when 10% would make the map unusable', () => {
      // 1000px container: 10% would be 100px, well under MAP_COL_MIN_PX.
      const { main, handle } = buildSplitDom(1000);
      main.style.setProperty('--map-col-width', '25%');
      manager.setupMapWidthResize();

      const minPct = (MAP_COL_MIN_PX / 1000) * 100;
      expect(handle.getAttribute('aria-valuemin')).toBe(String(Math.round(minPct)));

      handle.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true,
      }));

      expect(main.style.getPropertyValue('--map-col-width')).toBe(`${minPct.toFixed(1)}%`);
    });

    it('reserves room for one panel column at the upper bound', () => {
      const { main, handle } = buildSplitDom(1000);
      manager.setupMapWidthResize();

      const maxPct = ((1000 - PANELS_COL_MIN_PX - MAP_COL_DIVIDER_PX) / 1000) * 100;

      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 600, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(main.style.getPropertyValue('--map-col-width')).toBe(`${maxPct.toFixed(1)}%`);
    });
  });

  describe('touch support on the width handle', () => {
    it('resizes and persists from touch events', () => {
      const { main, handle } = buildSplitDom(2200);
      manager.setupMapWidthResize();

      handle.dispatchEvent(Object.assign(new Event('touchstart', { bubbles: true, cancelable: true }), {
        touches: [{ clientX: 1320 }],
      }));
      document.dispatchEvent(Object.assign(new Event('touchmove', { bubbles: true }), {
        touches: [{ clientX: 1100 }],
      }));
      document.dispatchEvent(new Event('touchend', { bubbles: true }));

      expect(main.style.getPropertyValue('--map-col-width')).toBe('50.0%');
      expect(localStorage.getItem('map-col-width')).toBe('50.0%');
    });
  });

  describe('width handle affordance', () => {
    it('exposes a tooltip alongside the accessible name', () => {
      const { handle } = buildSplitDom(2200);
      manager.setupMapWidthResize();

      expect(handle.getAttribute('role')).toBe('separator');
      expect(handle.getAttribute('aria-label')).toBeTruthy();
      expect(handle.title).toBeTruthy();
    });
  });

  describe('map side preference', () => {
    function buildSideDom(): { main: HTMLElement; btn: HTMLButtonElement } {
      const { main } = buildSplitDom(2200);
      const btn = document.createElement('button');
      btn.id = 'mapSideBtn';
      main.querySelector('#mapSection')!.append(btn);
      return { main, btn };
    }

    it('toggles the map side and persists the choice', () => {
      const { main, btn } = buildSideDom();
      manager.setupMapSideToggle();

      btn.click();
      expect(main.classList.contains('map-right')).toBe(true);
      expect(localStorage.getItem('map-side')).toBe('right');
      expect(resize).toHaveBeenCalled();

      btn.click();
      expect(main.classList.contains('map-right')).toBe(false);
      expect(localStorage.getItem('map-side')).toBe('left');
    });

    it('inverts the drag direction when the map sits on the right', () => {
      const { main, handle } = buildSplitDom(2200);
      main.classList.add('map-right');
      manager.setupMapWidthResize();

      // Map on the right: moving the divider LEFT grows the map.
      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 1000, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(main.style.getPropertyValue('--map-col-width')).toBe('64.5%');
    });

    it('inverts the keyboard direction when the map sits on the right', () => {
      const { main, handle } = buildSplitDom(2200);
      main.classList.add('map-right');
      manager.setupMapWidthResize();

      // ArrowRight moves the divider right, which shrinks a right-side map.
      handle.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      }));

      expect(main.style.getPropertyValue('--map-col-width')).toBe('55.0%');
    });
  });

  describe('split layout activation threshold', () => {
    it(`resizes the map container, not the section, from ${SPLIT_LAYOUT_MIN_WIDTH}px up`, () => {
      stubInnerWidth(SPLIT_LAYOUT_MIN_WIDTH + 100);
      const { section, container, handle } = buildHeightDom();
      manager.setupMapResize();

      handle.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }));

      expect(container.style.height).toBe('540px');
      expect(section.style.height).toBe('');
    });

    it('still resizes the section below the threshold', () => {
      stubInnerWidth(SPLIT_LAYOUT_MIN_WIDTH - 100);
      const { section, container, handle } = buildHeightDom();
      manager.setupMapResize();

      handle.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }));

      expect(section.style.height).toBe('540px');
      expect(container.style.height).toBe('');
    });
  });

  describe('mode-scoped map height storage', () => {
    it('split mode writes map-split-height and leaves map-height alone', () => {
      stubInnerWidth(2000);
      localStorage.setItem('map-height', '400px');
      const { handle } = buildHeightDom();
      manager.setupMapResize();

      handle.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }));

      expect(localStorage.getItem('map-split-height')).toBe('540px');
      expect(localStorage.getItem('map-height')).toBe('400px');
    });

    it('stacked mode keeps writing map-height', () => {
      stubInnerWidth(800);
      const { handle } = buildHeightDom();
      manager.setupMapResize();

      handle.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }));

      expect(localStorage.getItem('map-height')).toBe('540px');
      expect(localStorage.getItem('map-split-height')).toBeNull();
    });

    it('split restore prefers map-split-height over the legacy shared key', () => {
      stubInnerWidth(2000);
      localStorage.setItem('map-height', '450px');
      localStorage.setItem('map-split-height', '600px');
      const { section, container } = buildHeightDom();
      manager.setupMapResize();

      expect(container.style.height).toBe('600px');
      expect(section.style.height).toBe('');
    });

    it('split restore falls back to the legacy key when no split value exists', () => {
      stubInnerWidth(2000);
      localStorage.setItem('map-height', '450px');
      const { container } = buildHeightDom();
      manager.setupMapResize();

      expect(container.style.height).toBe('450px');
    });
  });
});
