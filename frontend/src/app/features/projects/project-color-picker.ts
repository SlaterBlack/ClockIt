import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export const PROJECT_COLOR_OPTIONS = [
  { name: 'Terminal green', value: '#2D6A4F' },
  { name: 'Deep moss', value: '#1E3A2F' },
  { name: 'Sage', value: '#6F8F72' },
  { name: 'Ocean', value: '#3B82A0' },
  { name: 'Indigo', value: '#5965B3' },
  { name: 'Amethyst', value: '#8A5CA8' },
  { name: 'Rose', value: '#C45B75' },
  { name: 'Terracotta', value: '#C96F4A' },
  { name: 'Amber', value: '#B78325' },
  { name: 'Slate', value: '#687783' },
] as const;

@Component({
  selector: 'app-project-color-picker',
  imports: [FormsModule],
  templateUrl: './project-color-picker.html',
  styleUrl: './project-color-picker.scss',
})
export class ProjectColorPicker {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) color!: string;
  @Input() label = 'Project color';
  @Input() displayLabel = 'Project color';
  @Input() compact = false;
  @Output('pickedColor') colorPicked = new EventEmitter<string>();

  readonly isOpen = signal(false);
  readonly colorOptions = PROJECT_COLOR_OPTIONS;

  togglePicker(): void {
    this.isOpen.update((isOpen) => !isOpen);
  }

  selectColor(color: string): void {
    this.colorPicked.emit(color);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && !this.elementRef.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }
}
