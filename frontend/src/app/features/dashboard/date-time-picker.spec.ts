import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateTimePicker } from './date-time-picker';

describe('DateTimePicker', () => {
  let fixture: ComponentFixture<DateTimePicker>;
  let component: DateTimePicker;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateTimePicker],
    }).compileComponents();

    fixture = TestBed.createComponent(DateTimePicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', '2026-10-19T09:30');
    fixture.componentRef.setInput('label', 'Start');
    fixture.detectChanges();
  });

  it('prefills both controls and lets date and time be changed independently', () => {
    const emittedValues: string[] = [];
    component.valueChange.subscribe((value) => emittedValues.push(value));

    expect(component.displayDate()).toContain('19');
    expect(component.displayTime()).toBe('09:30');

    (fixture.nativeElement.querySelector('.date-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.selectedDate().getDate()).toBe(19);
    expect(component.selectedHour()).toBe('09');
    expect(component.selectedMinute()).toBe('30');
    (fixture.nativeElement.querySelector('[data-date="2026-10-22"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.date-time-actions .btn-primary') as HTMLButtonElement
    ).click();
    expect(emittedValues).toEqual(['2026-10-22T09:30']);

    fixture.componentRef.setInput('value', emittedValues[0]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.time-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.selectedHour()).toBe('09');
    expect(component.selectedMinute()).toBe('30');
    const hour = fixture.nativeElement.querySelector('[aria-label="Hour"]') as HTMLSelectElement;
    const minute = fixture.nativeElement.querySelector(
      '[aria-label="Minute"]',
    ) as HTMLSelectElement;
    expect(hour.value).toBe('09');
    expect(minute.value).toBe('30');
    hour.value = '14';
    hour.dispatchEvent(new Event('change'));
    minute.value = '45';
    minute.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.date-time-actions .btn-primary') as HTMLButtonElement
    ).click();

    expect(emittedValues).toEqual(['2026-10-22T09:30', '2026-10-22T14:45']);
    expect(component.openPickerType()).toBe(null);
  });

  it('accepts text time formats and normalizes them to 24-hour values', () => {
    fixture.componentRef.setInput('manualTime', true);
    fixture.detectChanges();
    const emittedValues: string[] = [];
    component.valueChange.subscribe((value) => emittedValues.push(value));

    const time = fixture.nativeElement.querySelector('.manual-time-input') as HTMLInputElement;
    expect(time.value).toBe(component.displayManualTime());
    expect(fixture.nativeElement.querySelector('.time-trigger')).toBeNull();

    time.focus();
    fixture.detectChanges();
    expect(time.value).toBe('0930');
    time.value = '1745';
    time.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    time.blur();
    fixture.detectChanges();
    expect(emittedValues).toEqual(['2026-10-19T17:45']);
    expect(time.value).toBe(component.displayManualTime());

    for (const [input, expected] of [
      ['9am', '2026-10-19T09:00'],
      ['9.15am', '2026-10-19T09:15'],
      ['9:15', '2026-10-19T09:15'],
      ['0915', '2026-10-19T09:15'],
      ['9.15', '2026-10-19T09:15'],
    ]) {
      time.focus();
      time.value = input;
      time.dispatchEvent(new Event('input'));
      time.blur();
      fixture.detectChanges();
      expect(emittedValues.at(-1)).toBe(expected);
    }

    time.focus();
    fixture.detectChanges();
    time.value = '2460';
    time.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(time.getAttribute('aria-invalid')).toBe('true');
    expect(emittedValues).toHaveLength(6);
    time.blur();
    fixture.detectChanges();
    expect(time.value).toBe(component.displayManualTime());
  });

  it('clears an optional end date and time', () => {
    fixture.componentRef.setInput('clearable', true);
    fixture.detectChanges();
    const emittedValues: string[] = [];
    component.valueChange.subscribe((value) => emittedValues.push(value));

    (fixture.nativeElement.querySelector('.time-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.clear-time') as HTMLButtonElement).click();

    expect(emittedValues).toEqual(['']);
    expect(component.openPickerType()).toBe(null);
  });
});
