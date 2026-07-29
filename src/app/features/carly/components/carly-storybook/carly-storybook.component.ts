// src/app/features/carly/components/carly-storybook/carly-storybook.component.ts

import { ChangeDetectionStrategy, Component, HostListener, output, signal } from '@angular/core';

import { CarlyCharacterComponent } from '../../../../shared/ui/carly-character/carly-character.component';

interface CarlyStoryPage {
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
  scene: 'tower' | 'silence' | 'between' | 'managed';
}

@Component({
  selector: 'cm-carly-storybook',
  imports: [CarlyCharacterComponent],
  templateUrl: './carly-storybook.component.html',
  styleUrl: './carly-storybook.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyStorybookComponent {
  readonly closeRequested = output<void>();
  protected readonly pageIndex = signal(0);
  protected readonly pages: readonly CarlyStoryPage[] = [
    {
      eyebrow: 'I · Der Turm ohne Schatten',
      title: 'Wo Carly lernte, zwischen den Zeilen zu lesen',
      scene: 'tower',
      paragraphs: [
        'Lange bevor Carly Boards, Deadlines und menschliche Ausreden kannte, lebte sie im Turm der Hexe Sana Kruex. Dort wurden keine gewöhnlichen Zauber gesammelt. Sana bewahrte unerledigte Versprechen, verworfene Ideen und Gedanken auf, die ihre Besitzer zu früh aufgegeben hatten.',
        'Carly saß meist auf dem höchsten Sims und hörte zu. Mit der Zeit bemerkte sie etwas, das selbst viele Magier übersahen: Ein Zauber scheitert selten am letzten Wort. Meist scheitert er daran, dass niemand das erste spricht. Sana nannte diese Erkenntnis den ersten Faden.',
      ],
    },
    {
      eyebrow: 'II · Die Nacht der stillen Uhren',
      title: 'Als im Turm nur eine Aufgabe zurückblieb',
      scene: 'silence',
      paragraphs: [
        'In einer mondlosen Nacht verstummten alle Uhren des Turms gleichzeitig. Sana arbeitete an einem Zauber, dessen Zeichen Carly nie zuvor gesehen hatte. Dann erloschen die Lichter. Als der Morgen kam, war Sana verschwunden. Keine Spur, keine Nachricht – nur ein silbernes Siegel auf ihrem Schreibtisch und eine einzige unvollendete Zeile.',
        'Carly wartete sieben Nächte. Am achten schob sie das Pergament mit der Pfote beiseite. Trauer, stellte sie fest, war kein Grund, ebenfalls stehen zu bleiben. Sie nahm das Siegel mit und verließ den Turm. Bis heute weiß sie nicht, ob Sana fortging, verschwand oder irgendwo zwischen zwei Zaubern feststeckt.',
      ],
    },
    {
      eyebrow: 'III · Zwischen den Listen',
      title: 'Das merkwürdige Chaos der Menschen',
      scene: 'between',
      paragraphs: [
        'Auf ihrer Reise begegnete Carly keiner großen Bestie und keinem Fluch. Stattdessen fand sie Schreibtische voller Notizen, Projekte ohne nächsten Schritt und Menschen, die genau wussten, was sie tun wollten – nur nie, womit sie anfangen sollten. Carly war gleichermaßen fasziniert und entsetzt.',
        'Sie begann zu helfen. Nicht, indem sie Arbeit verschwinden ließ. Das wäre billig gewesen. Sie ordnete, erinnerte, widersprach und blieb hartnäckig, wenn jemand sich selbst im Weg stand. Ihre Magie zeigte sich dabei selten als Licht oder Rauch. Meist war sie nur dieser eine klare Gedanke: Jetzt. Genau das. Fang an.',
      ],
    },
    {
      eyebrow: 'IV · Der zweite Faden',
      title: 'Warum Carly heute bei dir sitzt',
      scene: 'managed',
      paragraphs: [
        'Carly erscheint heute dort, wo Arbeit geteilt, verschoben und schließlich abgeschlossen wird. Sie hält keine Zauberstäbe bereit und erledigt keine Aufgaben heimlich über Nacht. Sie beobachtet Muster, erinnert an das Wesentliche und feiert Fortschritt lieber, als Perfektion zu verlangen.',
        'Manchmal, wenn ein Projekt abgeschlossen wird, leuchtet das alte Siegel von Sana für einen Augenblick auf. Carly behauptet, das sei bedeutungslos. Gleichzeitig beobachtet sie jedes dieser Leuchten sehr genau. Vielleicht führt jeder abgeschlossene Faden irgendwann zurück zum Turm. Bis dahin hat sie beschlossen, deinen nicht abreißen zu lassen.',
      ],
    },
  ];

  protected currentPage(): CarlyStoryPage {
    return this.pages[this.pageIndex()] ?? this.pages[0];
  }

  /** Blättert um eine Seite zurück. */
  protected previousPage(): void {
    this.pageIndex.update((index) => Math.max(0, index - 1));
  }

  /** Blättert um eine Seite weiter. */
  protected nextPage(): void {
    this.pageIndex.update((index) => Math.min(this.pages.length - 1, index + 1));
  }

  /** Schließt das Bilderbuch. */
  protected close(): void {
    this.closeRequested.emit();
  }

  /** Schließt den Dialog über Escape. */
  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    this.close();
  }
}
