import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeEntry as TimeEntryService } from '../../core/services/time-entry';
import type { TimeEntry as TimeEntryDto } from '../../core/models/time-entry.model';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly timeEntryService = inject(TimeEntryService);

  readonly description = signal('');
  readonly timeEntries = signal<TimeEntryDto[]>([]);
  readonly runningEntry = signal<TimeEntryDto | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  startTimer(): void {
    this.timeEntryService.start({ description: this.description() }).subscribe(() => {
      this.description.set('');
      this.refresh();
    });
  }

  stopTimer(): void {
    const running = this.runningEntry();
    if (!running) {
      return;
    }
    this.timeEntryService.stop(running.id).subscribe(() => this.refresh());
  }

  private refresh(): void {
    this.timeEntryService.list().subscribe(({ timeEntries }) => {
      this.timeEntries.set(timeEntries);
      this.runningEntry.set(timeEntries.find((entry) => entry.endTime === null) ?? null);
    });
  }
}
