/* src/app/shared/ui/carly-character/carly-character.component.ts */

import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, input, signal, untracked, viewChild } from '@angular/core';

import { CarlyReaction, CarlyVisualTransition } from '../../../core/carly/carly.models';
import { CarlyService } from '../../../core/carly/carly.service';

type CarlyCharacterMode = 'head' | 'full';
type CarlyEyeMode = 'open' | 'half' | 'closed' | 'dizzy';
type CarlyMouthMode = 'idle' | 'smile' | 'half-open' | 'open' | 'sleep';

interface CarlyVisualSnapshot {
  transition: CarlyVisualTransition;
  reaction: CarlyReaction;
  sleeping: boolean;
  speaking: boolean;
  speechSequence: number;
  reduced: boolean;
  mode: CarlyCharacterMode;
  animateTail: boolean;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const CARLY_ASSET_URL = '/assets/carly/carly.svg';
const TAIL_KEYFRAME_COUNT = 11;
const TAIL_TWEEN_FRAME_COUNT = 3;
const TAIL_FRAME_DURATION_MS = 28;
const TAIL_IDLE_MIN_MS = 4_500;
const TAIL_IDLE_MAX_MS = 11_500;
const POINTER_IDLE_BEFORE_RANDOM_MS = 1_700;

/** Erstellt die Abspielreihenfolge aus Illustrator-Keyframes und generierten Zwischenframes. */
function createTailFrameIds(): string[] {
  const frameIds: string[] = [];

  for (let frame = 1; frame <= TAIL_KEYFRAME_COUNT; frame += 1) {
    const current = `KF${String(frame).padStart(2, '0')}`;
    frameIds.push(current);

    if (frame === TAIL_KEYFRAME_COUNT) continue;

    for (let tween = 1; tween <= TAIL_TWEEN_FRAME_COUNT; tween += 1) {
      frameIds.push(`${current}-T${String(tween).padStart(2, '0')}`);
    }
  }

  return frameIds;
}

const TAIL_FRAME_IDS = createTailFrameIds();

let carlySvgSourcePromise: Promise<string> | null = null;

/**
 * Lädt Carlys SVG-Quelle nur einmal und nutzt anschließend den Browser-Cache.
 */
function loadCarlySvgSource(): Promise<string> {
  if (!carlySvgSourcePromise) {
    carlySvgSourcePromise = fetch(CARLY_ASSET_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`Carly-Asset konnte nicht geladen werden: ${response.status}`);
      }

      return response.text();
    });
  }

  return carlySvgSourcePromise;
}

@Component({
  selector: 'cm-carly-character',
  templateUrl: './carly-character.component.html',
  styleUrl: './carly-character.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyCharacterComponent {
  readonly mode = input<CarlyCharacterMode>('head');
  readonly animateTail = input(false);
  readonly reduced = input(false);
  readonly trackCursor = input(true);

  protected readonly carlyService: CarlyService;
  protected readonly assetFailed = signal(false);

  private readonly svgHost = viewChild<ElementRef<HTMLElement>>('svgHost');
  private svgElement: SVGSVGElement | null = null;
  private originalViewBox = '0 0 351.144 571.7211';
  private expressionTimers: number[] = [];
  private blinkTimer: number | null = null;
  private gazeTimer: number | null = null;
  private mouthTimer: number | null = null;
  private tailIdleTimer: number | null = null;
  private tailFrameRequest: number | null = null;
  private pointerFrame: number | null = null;
  private lastPointerAt = 0;
  private currentTailFrame = 0;
  private readonly tailFrameIds = [...TAIL_FRAME_IDS];

  constructor(carlyService: CarlyService, destroyRef: DestroyRef) {
    this.carlyService = carlyService;

    effect(() => {
      const snapshot: CarlyVisualSnapshot = {
        transition: this.carlyService.visualTransition(),
        reaction: this.carlyService.reaction(),
        sleeping: this.carlyService.isSleeping(),
        speaking: this.carlyService.speaking(),
        speechSequence: this.carlyService.speechSequence(),
        reduced: this.reduced() || this.carlyService.settings().reduceAnimations,
        mode: this.mode(),
        animateTail: this.animateTail(),
      };

      untracked(() => this.applyVisualSnapshot(snapshot));
    });

    const handlePointerMove = (event: PointerEvent): void => this.handlePointerMove(event);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    afterNextRender(() => {
      void this.loadSvg();
    });

    destroyRef.onDestroy(() => {
      window.removeEventListener('pointermove', handlePointerMove);
      this.clearExpressionTimers();
      this.clearIdleTimers();

      if (this.pointerFrame !== null) {
        window.cancelAnimationFrame(this.pointerFrame);
      }
    });
  }

  /** Lädt, bereinigt und initialisiert Carlys SVG-Struktur. */
  private async loadSvg(): Promise<void> {
    const host = this.svgHost()?.nativeElement;
    if (!host) return;

    try {
      const source = await loadCarlySvgSource();
      const documentValue = new DOMParser().parseFromString(source, 'image/svg+xml');
      const parsedSvg = documentValue.documentElement;

      if (parsedSvg.tagName.toLowerCase() !== 'svg') {
        throw new Error('Carly-Asset enthält kein gültiges SVG-Wurzelelement.');
      }

      this.sanitizeSvg(parsedSvg);
      const svg = document.importNode(parsedSvg, true) as unknown as SVGSVGElement;
      this.originalViewBox = svg.getAttribute('viewBox') ?? this.originalViewBox;
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.display = 'block';
      svg.style.width = '100%';
      svg.style.height = 'auto';

      this.prepareGazeGroups(svg);
      this.svgElement = svg;
      this.initializeVisibility();

      host.replaceChildren(svg);
      this.configureViewBox();
      this.applyVisualSnapshot(this.createCurrentSnapshot());
      this.scheduleRandomGaze();
      this.scheduleRandomBlink();
    } catch (error) {
      console.error(error);
      this.assetFailed.set(true);
    }
  }

  /**
   * Entfernt ausführbare oder externe Inhalte aus dem lokal geladenen SVG,
   * bevor es in den DOM übernommen wird.
   */
  private sanitizeSvg(svg: Element): void {
    svg.querySelectorAll('script, foreignObject').forEach((element) => element.remove());

    svg.querySelectorAll('*').forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();

        if (name.startsWith('on')) {
          element.removeAttribute(attribute.name);
          return;
        }

        if ((name === 'href' || name === 'xlink:href') && !value.startsWith('#')) {
          element.removeAttribute(attribute.name);
        }
      });
    });
  }

  /** Erstellt bewegliche Blickgruppen aus Pupille und zugehörigem Lichtreflex. */
  private prepareGazeGroups(svg: SVGSVGElement): void {
    this.createGazeGroup(
      svg,
      'gaze-left-normal',
      ['normal-pupil-left', 'normal-highlight-left'],
      'normal-iris-left',
    );
    this.createGazeGroup(
      svg,
      'gaze-right-normal',
      ['normal-pupil-right', 'normal-highlight-right'],
      'normal-iris-right',
    );
    this.createGazeGroup(
      svg,
      'gaze-left-half',
      ['pupil-left-ho', 'highlight-left-ho'],
      'iris-left-ho',
    );
    this.createGazeGroup(
      svg,
      'gaze-right-half',
      ['pupil-right-ho', 'highlight-right-ho'],
      'iris-right-ho',
    );
  }

  /** Fasst vorhandene SVG-Elemente in einer transformierbaren Gruppe zusammen. */
  private createGazeGroup(
    svg: SVGSVGElement,
    groupId: string,
    childIds: string[],
    clipSourceId: string,
  ): void {
    const children = childIds
      .map((id) => svg.querySelector<SVGGraphicsElement>(`#${id}`))
      .filter((element): element is SVGGraphicsElement => element !== null);

    if (children.length === 0) return;

    const parent = children[0].parentNode;
    if (!parent) return;

    const group = document.createElementNS(SVG_NAMESPACE, 'g');
    group.id = groupId;
    group.style.transformBox = 'fill-box';
    group.style.transformOrigin = 'center';
    parent.insertBefore(group, children[0]);

    children.forEach((child) => group.appendChild(child));
    this.applyGazeClip(svg, group, clipSourceId);
  }

  /** Begrenzt die beweglichen Augenbestandteile auf die gezeichnete Augenfläche. */
  private applyGazeClip(svg: SVGSVGElement, group: SVGGElement, clipSourceId: string): void {
    const source = svg.querySelector<SVGGraphicsElement>(`#${clipSourceId}`);
    const defs = svg.querySelector<SVGDefsElement>('defs');
    if (!source || !defs) return;

    const clipPath = document.createElementNS(SVG_NAMESPACE, 'clipPath');
    const clipId = `${group.id}-clip`;
    const shape = source.cloneNode(true) as SVGGraphicsElement;
    shape.removeAttribute('id');
    clipPath.id = clipId;
    clipPath.appendChild(shape);
    defs.appendChild(clipPath);
    group.setAttribute('clip-path', `url(#${clipId})`);
  }

  /** Setzt alle Varianten zunächst in einen definierten Ausgangszustand. */
  private initializeVisibility(): void {
    this.setEyeMode(this.carlyService.progress().isSleeping ? 'closed' : 'open');
    this.setMouthMode(this.carlyService.progress().isSleeping ? 'sleep' : 'idle');

    this.hideTailFrames();
  }

  /** Erzeugt den aktuell gültigen visuellen Zustand für einen erneuten Renderlauf. */
  private createCurrentSnapshot(): CarlyVisualSnapshot {
    return {
      transition: this.carlyService.visualTransition(),
      reaction: this.carlyService.reaction(),
      sleeping: this.carlyService.isSleeping(),
      speaking: this.carlyService.speaking(),
      speechSequence: this.carlyService.speechSequence(),
      reduced: this.reduced() || this.carlyService.settings().reduceAnimations,
      mode: this.mode(),
      animateTail: this.animateTail(),
    };
  }

  /** Synchronisiert Gesicht, Blick und Schwanz mit Carlys gemeinsamem Zustand. */
  private applyVisualSnapshot(snapshot: CarlyVisualSnapshot): void {
    if (!this.svgElement) return;

    const motionReduced = snapshot.reduced || this.isMotionReduced();
    this.configureViewBox();
    this.configureCharacterLayers(snapshot);
    this.clearExpressionTimers();
    this.stopTalking();

    if (snapshot.reaction === 'dizzy' && !snapshot.sleeping) {
      this.setEyeMode('dizzy');
      this.setMouthMode('half-open');
      this.setGaze(-0.95, 0, 0, -0.95);
      this.stopIdleAnimations();
      this.configureTail(snapshot);
      return;
    }

    if ((snapshot.reaction === 'petted' || snapshot.reaction === 'celebrating') && !snapshot.sleeping) {
      this.setEyeMode('closed');
      this.setMouthMode('smile');
      this.setGaze(0, 0);
      this.stopIdleAnimations();
      this.configureTail(snapshot);
      return;
    }

    if (snapshot.transition === 'sleeping') {
      if (motionReduced) {
        this.setEyeMode('closed');
        this.setMouthMode('sleep');
      } else {
        this.runSleepSequence();
      }
      this.stopIdleAnimations();
      this.configureTail(snapshot);
      return;
    }

    if (snapshot.transition === 'waking') {
      if (motionReduced) {
        this.setEyeMode('open');
        this.setMouthMode('idle');
      } else {
        this.runWakeSequence();
      }
      this.stopIdleAnimations();
      this.configureTail(snapshot);
      return;
    }

    if (snapshot.sleeping) {
      this.setEyeMode('closed');
      this.setMouthMode('sleep');
      this.setGaze(0, 0);
      this.stopIdleAnimations();
      this.configureTail(snapshot);
      return;
    }

    this.setEyeMode('open');
    this.setGaze(0, 0);

    if (snapshot.speaking) {
      this.startTalking();
    } else {
      this.setMouthMode('idle');
    }

    if (motionReduced) {
      this.setGaze(0, 0);
      this.stopIdleAnimations();
    } else {
      this.scheduleRandomGaze();
      this.scheduleRandomBlink();
    }

    this.configureTail(snapshot);
  }

  /** Schneidet im Kopfmodus knapp unter Carlys Hals und zeigt sonst die vollständige Figur. */
  private configureViewBox(): void {
    const svg = this.svgElement;
    if (!svg) return;

    if (this.mode() === 'full') {
      svg.setAttribute('viewBox', this.originalViewBox);
      return;
    }

    const head = svg.querySelector<SVGGraphicsElement>('#_04_HEAD');
    if (!head) return;

    try {
      const box = head.getBBox();
      const marginX = box.width * 0.055;
      const marginTop = box.height * 0.065;
      const marginBottom = box.height * 0.035;

      svg.setAttribute(
        'viewBox',
        `${box.x - marginX} ${box.y - marginTop} ${box.width + marginX * 2} ${box.height + marginTop + marginBottom}`,
      );
    } catch {
      svg.setAttribute('viewBox', this.originalViewBox);
    }
  }

  /** Blendet im Kopfmodus Körper und Schwanz aus und konfiguriert den Vollkörpermodus. */
  private configureCharacterLayers(snapshot: CarlyVisualSnapshot): void {
    const full = snapshot.mode === 'full';
    this.setVisible('_02_BODY', full);
    this.setVisible('_03_TAIL', full);
    this.setVisible('KEYFRAMES', full);
  }

  /** Führt ein kurzes Doppelblinzeln aus und schließt die Augen anschließend langsam. */
  private runSleepSequence(): void {
    this.setEyeMode('open');
    this.setMouthMode('idle');
    this.setGaze(0, 0);

    this.queueExpression(120, () => this.setEyeMode('half'));
    this.queueExpression(205, () => this.setEyeMode('closed'));
    this.queueExpression(285, () => this.setEyeMode('open'));
    this.queueExpression(410, () => this.setEyeMode('half'));
    this.queueExpression(495, () => this.setEyeMode('closed'));
    this.queueExpression(585, () => this.setEyeMode('open'));
    this.queueExpression(720, () => this.setEyeMode('half'));
    this.queueExpression(890, () => {
      this.setEyeMode('closed');
      this.setMouthMode('sleep');
    });
  }

  /** Öffnet Carlys Augen nach dem Schlaf mit einem langsamen Aufwachblinzeln. */
  private runWakeSequence(): void {
    this.setEyeMode('closed');
    this.setMouthMode('sleep');
    this.setGaze(0, 0);

    this.queueExpression(210, () => this.setEyeMode('half'));
    this.queueExpression(350, () => this.setEyeMode('closed'));
    this.queueExpression(535, () => {
      this.setEyeMode('half');
      this.setMouthMode('idle');
    });
    this.queueExpression(720, () => this.setEyeMode('open'));
    this.queueExpression(855, () => this.setEyeMode('half'));
    this.queueExpression(1_020, () => this.setEyeMode('open'));
  }

  /** Wechselt während einer Sprachausgabe schnell zwischen den vorbereiteten Mundformen. */
  private startTalking(): void {
    this.stopTalking();

    const animateMouth = (): void => {
      if (
        !this.carlyService.speaking() ||
        !this.canUseAwakeExpression() ||
        this.isMotionReduced()
      ) {
        this.stopTalking();
        this.setMouthMode('idle');
        return;
      }

      const roll = Math.random();
      const mouth: CarlyMouthMode =
        roll < 0.18 ? 'idle' : roll < 0.62 ? 'half-open' : 'open';
      this.setMouthMode(mouth);

      this.mouthTimer = window.setTimeout(animateMouth, 85 + Math.random() * 95);
    };

    animateMouth();
  }

  /** Beendet die Mundbewegung einer laufenden Sprachausgabe. */
  private stopTalking(): void {
    if (this.mouthTimer !== null) {
      window.clearTimeout(this.mouthTimer);
      this.mouthTimer = null;
    }
  }

  /** Plant ein natürlich unregelmäßiges Blinzeln für den Wachzustand. */
  private scheduleRandomBlink(): void {
    if (this.blinkTimer !== null || this.isMotionReduced()) return;

    this.blinkTimer = window.setTimeout(
      () => {
        this.blinkTimer = null;
        if (!this.canIdleAnimate()) {
          this.scheduleRandomBlink();
          return;
        }

        const doubleBlink = Math.random() < 0.22;
        this.setEyeMode('half');
        this.queueExpression(65, () => this.setEyeMode('closed'));
        this.queueExpression(125, () => this.setEyeMode('open'));

        if (doubleBlink) {
          this.queueExpression(245, () => this.setEyeMode('half'));
          this.queueExpression(305, () => this.setEyeMode('closed'));
          this.queueExpression(365, () => this.setEyeMode('open'));
        }

        this.queueExpression(doubleBlink ? 440 : 200, () => this.scheduleRandomBlink());
      },
      3_000 + Math.random() * 4_500,
    );
  }

  /** Plant zufällige Blickrichtungen ohne wiederkehrendes festes Muster. */
  private scheduleRandomGaze(): void {
    if (this.gazeTimer !== null || this.isMotionReduced()) return;

    this.gazeTimer = window.setTimeout(
      () => {
        this.gazeTimer = null;

        if (!this.canIdleAnimate()) {
          this.scheduleRandomGaze();
          return;
        }

        if (Date.now() - this.lastPointerAt < POINTER_IDLE_BEFORE_RANDOM_MS) {
          this.scheduleRandomGaze();
          return;
        }

        const centered = Math.random() < 0.18;
        const x = centered ? 0 : Math.max(-1, Math.min(1, (Math.random() - 0.5) * 2.15));
        const y = centered ? 0 : Math.max(-0.75, Math.min(0.65, (Math.random() - 0.5) * 1.55));
        this.setGaze(x, y);
        this.scheduleRandomGaze();
      },
      1_150 + Math.random() * 2_900,
    );
  }

  /** Lässt Carly im Wachzustand in Richtung des Mauszeigers blicken. */
  private handlePointerMove(event: PointerEvent): void {
    if (!this.trackCursor() || this.isMotionReduced() || !this.canIdleAnimate()) return;

    this.lastPointerAt = Date.now();

    if (this.pointerFrame !== null) return;

    this.pointerFrame = window.requestAnimationFrame(() => {
      this.pointerFrame = null;
      const host = this.svgHost()?.nativeElement;
      if (!host) return;

      const noseFocus = this.getCrossEyedNoseFocus(event.clientX, event.clientY);
      if (noseFocus) {
        this.setGaze(...noseFocus);
        return;
      }

      const rect = host.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height * (this.mode() === 'full' ? 0.27 : 0.48);
      const x = Math.max(-1, Math.min(1, (event.clientX - centerX) / Math.max(rect.width * 1.4, 1)));
      const y = Math.max(-0.8, Math.min(0.8, (event.clientY - centerY) / Math.max(rect.height * 1.5, 1)));
      this.setGaze(x, y);
    });
  }

  /** Lässt beide Pupillen gezielt auf den Cursor an Carlys Nasenspitze schauen. */
  private getCrossEyedNoseFocus(clientX: number, clientY: number): [number, number, number, number] | null {
    const nose =
      this.svgElement?.querySelector<SVGGraphicsElement>('#nose') ??
      this.svgElement?.querySelector<SVGGraphicsElement>('#nose-base');
    const leftEye = this.svgElement?.querySelector<SVGGraphicsElement>('#eye-left');
    const rightEye = this.svgElement?.querySelector<SVGGraphicsElement>('#eye-right');

    if (!nose || !leftEye || !rightEye) {
      return null;
    }

    const noseBox = nose.getBoundingClientRect();
    const noseX = noseBox.left + noseBox.width / 2;
    const noseY = noseBox.top + noseBox.height / 2;
    const radius = Math.max(noseBox.width, noseBox.height) * 4.8;

    if (Math.hypot(clientX - noseX, clientY - noseY) > radius) {
      return null;
    }

    const getDirection = (element: SVGGraphicsElement): [number, number] => {
      const box = element.getBoundingClientRect();
      const eyeX = box.left + box.width / 2;
      const eyeY = box.top + box.height / 2;
      const deltaX = clientX - eyeX;
      const deltaY = clientY - eyeY;
      const length = Math.max(Math.hypot(deltaX, deltaY), 1);
      const horizontalStrength = 0.92;
      const verticalStrength = 1.35;
      const verticalFocus = Math.max(
        0.72,
        Math.min(1.2, (deltaY / length) * verticalStrength),
      );

      return [
        Math.max(-1, Math.min(1, (deltaX / length) * horizontalStrength)),
        verticalFocus,
      ];
    };

    const [leftX, leftY] = getDirection(leftEye);
    const [rightX, rightY] = getDirection(rightEye);

    return [leftX, leftY, rightX, rightY];
  }

  /**
   * Setzt die Blickrichtung beider Augen. Für den Schwindelzustand können
   * die Augen bewusst unterschiedliche Richtungen erhalten.
   */
  private setGaze(
    leftX: number,
    leftY: number,
    rightX = leftX,
    rightY = leftY,
  ): void {
    const maxX = 4.2;
    const getVerticalOffset = (value: number): number => value * (value > 0 ? 2.65 : 3.1);
    const leftOffsetY = getVerticalOffset(leftY);
    const rightOffsetY = getVerticalOffset(rightY);

    this.transformGazeGroup('gaze-left-normal', leftX * maxX, leftOffsetY);
    this.transformGazeGroup('gaze-right-normal', rightX * maxX, rightOffsetY);
    this.transformGazeGroup('gaze-left-half', leftX * maxX, leftOffsetY);
    this.transformGazeGroup('gaze-right-half', rightX * maxX, rightOffsetY);
  }

  /** Verschiebt Pupille und Lichtreflex gemeinsam weich innerhalb des Auges. */
  private transformGazeGroup(id: string, x: number, y: number): void {
    const group = this.svgElement?.querySelector<SVGGElement>(`#${id}`);
    if (!group) return;

    group.style.transition = this.isMotionReduced()
      ? 'none'
      : 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    group.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** Aktiviert genau eine der vorbereiteten Augenvarianten. */
  private setEyeMode(mode: CarlyEyeMode): void {
    const normalLeft = mode === 'open' || mode === 'dizzy';
    const normalRight = mode === 'open';
    const halfLeft = mode === 'half';
    const halfRight = mode === 'half' || mode === 'dizzy';
    const closed = mode === 'closed';

    this.setVisible('eye-left', normalLeft);
    this.setVisible('eye-right', normalRight);
    this.setVisible('eye-left-half-open', halfLeft);
    this.setVisible('eye-right-half-open', halfRight);
    this.setVisible('eye-left-closed-grp', closed);
    this.setVisible('eye-right-closed-grp', closed);
  }

  /** Aktiviert genau eine vorbereitete Mundform. */
  private setMouthMode(mode: CarlyMouthMode): void {
    this.setVisible('mouth-idle', mode === 'idle');
    this.setVisible('mouth-smile-soft', mode === 'smile');
    this.setVisible('mouth-half-open', mode === 'half-open');
    this.setVisible('mouth-open', mode === 'open');
    this.setVisible('mouth-sleep', mode === 'sleep');
  }

  /** Aktiviert Carlys zufälliges Schwanzwedeln ausschließlich im Vollkörpermodus. */
  private configureTail(snapshot: CarlyVisualSnapshot): void {
    const canAnimate =
      snapshot.mode === 'full' &&
      snapshot.animateTail &&
      !snapshot.sleeping &&
      snapshot.transition === 'none' &&
      snapshot.reaction === 'none' &&
      !snapshot.reduced &&
      !this.isMotionReduced();

    if (!canAnimate) {
      this.stopTailAnimation();

      if (snapshot.mode === 'full' && snapshot.animateTail) {
        this.showTailRestFrame();
      } else {
        this.setVisible('tail-master', true);
      }
      return;
    }

    this.showTailRestFrame();
    this.scheduleRandomTailWag();
  }

  /** Plant eine einzelne Schwanzbewegung mit bewusst unregelmäßigem Abstand. */
  private scheduleRandomTailWag(): void {
    if (this.tailIdleTimer !== null || this.tailFrameRequest !== null || !this.canTailAnimate()) {
      return;
    }

    const delay = TAIL_IDLE_MIN_MS + Math.random() * (TAIL_IDLE_MAX_MS - TAIL_IDLE_MIN_MS);

    this.tailIdleTimer = window.setTimeout(() => {
      this.tailIdleTimer = null;

      if (!this.canTailAnimate()) {
        return;
      }

      this.playTailWag();
    }, delay);
  }

  /** Spielt einen vollständigen Tail-Durchlauf inklusive echter Vektor-Zwischenframes ab. */
  private playTailWag(): void {
    if (!this.canTailAnimate()) return;

    this.currentTailFrame = 0;
    this.setVisible('tail-master', false);
    this.showTailFrame(this.currentTailFrame);

    const startedAt = performance.now();
    const frameDurations = this.tailFrameIds.map((_, index) => this.getTailFrameDuration(index));
    const frameEnds = frameDurations.reduce<number[]>((ends, duration) => {
      ends.push((ends[ends.length - 1] ?? 0) + duration);
      return ends;
    }, []);
    const totalDuration = frameEnds[frameEnds.length - 1] ?? 0;

    const advance = (timestamp: number): void => {
      if (!this.canTailAnimate()) {
        this.stopTailAnimation();
        this.showTailRestFrame();
        return;
      }

      const elapsed = timestamp - startedAt;
      const frame = Math.min(
        this.tailFrameIds.length - 1,
        Math.max(0, frameEnds.findIndex((end) => elapsed < end)),
      );

      if (frame !== this.currentTailFrame) {
        this.currentTailFrame = frame;
        this.showTailFrame(frame);
      }

      if (elapsed >= totalDuration) {
        this.tailFrameRequest = null;
        this.showTailRestFrame();
        this.scheduleRandomTailWag();
        return;
      }

      this.tailFrameRequest = window.requestAnimationFrame(advance);
    };

    this.tailFrameRequest = window.requestAnimationFrame(advance);
  }

  /** Verlangsamt die letzten Tail-Keyframes leicht, damit die starke S-Krümmung weich ausläuft. */
  private getTailFrameDuration(frameIndex: number): number {
    const id = this.tailFrameIds[frameIndex] ?? '';

    if (id === 'KF11') return 120;
    if (id.startsWith('KF10')) return 44;
    if (id.startsWith('KF09')) return 36;

    return TAIL_FRAME_DURATION_MS;
  }

  /** Nutzt KF01 als ruhende Tail-Pose, damit nach dem Wedeln kein Sprung zum Master entsteht. */
  private showTailRestFrame(): void {
    this.setVisible('tail-master', false);
    this.showTailFrame(0);
  }

  /** Zeigt genau einen gezeichneten oder generierten Tail-Frame. */
  private showTailFrame(frameIndex: number): void {
    const visibleId = this.tailFrameIds[frameIndex];

    this.tailFrameIds.forEach((id) => {
      this.setVisible(id, id === visibleId);
    });
  }

  /** Blendet alle gezeichneten und generierten Tail-Frames aus. */
  private hideTailFrames(): void {
    this.tailFrameIds.forEach((id) => this.setVisible(id, false));
  }

  /** Stoppt laufende oder geplante Schwanzbewegungen vollständig. */
  private stopTailAnimation(): void {
    if (this.tailIdleTimer !== null) {
      window.clearTimeout(this.tailIdleTimer);
      this.tailIdleTimer = null;
    }

    if (this.tailFrameRequest !== null) {
      window.cancelAnimationFrame(this.tailFrameRequest);
      this.tailFrameRequest = null;
    }

    this.hideTailFrames();
  }

  /** Prüft, ob Carly aktuell eine zufällige Schwanzbewegung ausführen darf. */
  private canTailAnimate(): boolean {
    return (
      this.svgElement !== null &&
      this.mode() === 'full' &&
      this.animateTail() &&
      !this.carlyService.progress().isSleeping &&
      this.carlyService.visualTransition() === 'none' &&
      this.carlyService.reaction() === 'none' &&
      !this.isMotionReduced()
    );
  }

  /** Prüft, ob Carly gerade frei für Idle-Blick und Blinzeln ist. */
  private canIdleAnimate(): boolean {
    return (
      this.svgElement !== null &&
      !this.carlyService.progress().isSleeping &&
      this.carlyService.visualTransition() === 'none' &&
      this.carlyService.reaction() === 'none' &&
      !this.isMotionReduced()
    );
  }

  /** Prüft, ob die normale Wachmimik verwendet werden kann. */
  private canUseAwakeExpression(): boolean {
    return (
      !this.carlyService.progress().isSleeping &&
      this.carlyService.visualTransition() === 'none' &&
      this.carlyService.reaction() === 'none'
    );
  }

  /** Berücksichtigt Carlys und die globalen Einstellungen für reduzierte Bewegung. */
  private isMotionReduced(): boolean {
    const root = document.documentElement;
    const motion = root.dataset['motion'];

    return (
      this.reduced() ||
      this.carlyService.settings().reduceAnimations ||
      motion === 'reduced' ||
      motion === 'off' ||
      root.dataset['neuro'] === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Stoppt die zufälligen Idle-Abläufe, ohne den aktuellen Gesichtszustand zu verändern. */
  private stopIdleAnimations(): void {
    if (this.blinkTimer !== null) {
      window.clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }

    if (this.gazeTimer !== null) {
      window.clearTimeout(this.gazeTimer);
      this.gazeTimer = null;
    }
  }

  /** Entfernt alle geplanten Übergangs-Timeouts. */
  private clearExpressionTimers(): void {
    this.expressionTimers.forEach((timer) => window.clearTimeout(timer));
    this.expressionTimers = [];
  }

  /** Stoppt alle Idle- und Sprach-Timer. */
  private clearIdleTimers(): void {
    this.stopIdleAnimations();
    this.stopTalking();
    this.stopTailAnimation();
  }

  /** Plant einen einzelnen Schritt einer Gesichtssequenz. */
  private queueExpression(delay: number, callback: () => void): void {
    const timer = window.setTimeout(() => {
      this.expressionTimers = this.expressionTimers.filter((value) => value !== timer);
      callback();
    }, delay);

    this.expressionTimers.push(timer);
  }

  /** Ändert die Sichtbarkeit eines benannten SVG-Elements. */
  private setVisible(id: string, visible: boolean): void {
    const element = this.svgElement?.querySelector<SVGElement>(`#${id}`);
    if (!element) return;
    element.style.display = visible ? 'inline' : 'none';
  }
}
