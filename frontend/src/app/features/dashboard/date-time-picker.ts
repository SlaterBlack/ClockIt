import { Component, EventEmitter, HostListener, Input, Output, computed, signal } from '@angular/core';

interface CalendarDay {
  date: Date;
  inDisplayedMonth: boolean;
}

type OpenPicker = 'date' | 'time' | null;

@Component({
  selector: 'app-date-time-picker',
  templateUrl: './date-time-picker.html',
  styleUrl: './date-time-picker.scss',
})
export class DateTimePicker {
  @Input() value = '';
  @Input() label = '';
  @Input() ariaLabel = 'Choose date and time';
  @Input() clearable = false;
  @Input() alignRight = false;
  @Input() timeOnly = false;
  @Output() readonly valueChange = new EventEmitter<string>();

  readonly openPickerType = signal<OpenPicker>(null);
  readonly displayedMonth = signal(this.firstOfMonth(new Date()));
  readonly selectedDate = signal(this.startOfDay(new Date()));
  readonly selectedHour = signal('09');
  readonly selectedMinute = signal('00');
  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly hours = Array.from({ length: 24 }, (_, hour) => this.pad(hour));
  readonly minutes = Array.from({ length: 60 }, (_, minute) => this.pad(minute));
  readonly calendarDays = computed(() => {
    const month = this.displayedMonth();
    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstDay = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1 - firstOfMonth.getDay());
    const monthLength = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const dayCount = Math.ceil((firstOfMonth.getDay() + monthLength) / 7) * 7;
    return Array.from({ length: dayCount }, (_, index): CalendarDay => {
      const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + index);
      return { date, inDisplayedMonth: date.getMonth() === month.getMonth() };
    });
  });
  readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(this.displayedMonth()),
  );

  openDatePicker(): void {
    const selected = this.parseValue(this.value) ?? new Date();
    this.selectedDate.set(this.startOfDay(selected));
    this.displayedMonth.set(this.firstOfMonth(selected));
    this.selectedHour.set(this.pad(selected.getHours()));
    this.selectedMinute.set(this.pad(selected.getMinutes()));
    this.openPickerType.set('date');
  }

  openTimePicker(): void {
    const selected = this.parseValue(this.value) ?? new Date();
    this.selectedHour.set(this.pad(selected.getHours()));
    this.selectedMinute.set(this.pad(selected.getMinutes()));
    this.openPickerType.set('time');
  }

  closePicker(): void {
    this.openPickerType.set(null);
  }

  moveMonth(offset: number): void {
    const month = this.displayedMonth();
    this.displayedMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  selectDate(date: Date): void {
    this.selectedDate.set(this.startOfDay(date));
  }

  isSelectedDate(date: Date): boolean {
    const selected = this.selectedDate();
    return (
      date.getFullYear() === selected.getFullYear() &&
      date.getMonth() === selected.getMonth() &&
      date.getDate() === selected.getDate()
    );
  }

  onHourChange(event: Event): void {
    this.selectedHour.set((event.currentTarget as HTMLSelectElement).value);
  }

  onMinuteChange(event: Event): void {
    this.selectedMinute.set((event.currentTarget as HTMLSelectElement).value);
  }

  applyDate(): void {
    this.emitDateTime(this.selectedDate());
  }

  applyTime(): void {
    const date = this.parseValue(this.value) ?? new Date();
    this.emitDateTime(date);
  }

  private emitDateTime(date: Date): void {
    const value = `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}T${this.selectedHour()}:${this.selectedMinute()}`;
    this.valueChange.emit(value);
    this.closePicker();
  }

  clearSelection(): void {
    this.valueChange.emit('');
    this.closePicker();
  }

  displayDate(): string {
    const date = this.parseValue(this.value);
    return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : 'Choose date';
  }

  displayTime(): string {
    const date = this.parseValue(this.value);
    return date ? `${this.pad(date.getHours())}:${this.pad(date.getMinutes())}` : 'Choose time';
  }

  formatDate(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || !event.target.closest('.date-time-picker')) {
      this.closePicker();
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closePicker();
  }

  private parseValue(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }
    const [, year, month, day, hour, minute] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private firstOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
