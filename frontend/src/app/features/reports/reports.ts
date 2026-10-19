import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval } from 'rxjs';
import type { ReportUser } from '../../core/models/report.model';
import { Report as ReportService } from '../../core/services/report';
import type { TimeEntry as TimeEntryDto } from '../../core/models/time-entry.model';

type DatePreset = 'today' | 'this-week' | 'last-month' | 'year-to-date' | 'custom';
type BillableFilter = 'all' | 'billable' | 'non-billable';

interface ProjectSummary {
  id: string;
  name: string;
  durationSeconds: number;
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule, DatePipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly destroyRef = inject(DestroyRef);
  private reportRequestId = 0;

  readonly reportUsers = signal<ReportUser[]>([]);
  readonly currentUserId = signal('');
  readonly selectedUserId = signal('');
  readonly timeEntries = signal<TimeEntryDto[]>([]);
  readonly datePreset = signal<DatePreset>('this-week');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly projectFilter = signal('');
  readonly taskFilter = signal('');
  readonly billableFilter = signal<BillableFilter>('all');
  readonly clockNow = signal(Date.now());
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly projectOptions = computed(() => {
    const projects = new Map<string, string>();
    for (const entry of this.timeEntries()) {
      if (entry.projectId && entry.project?.name) {
        projects.set(entry.projectId, entry.project.name);
      }
    }
    return [...projects.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly taskOptions = computed(() => {
    const tasks = new Map<string, string>();
    for (const entry of this.timeEntries()) {
      if (
        entry.taskId &&
        entry.task?.name &&
        (!this.projectFilter() || entry.projectId === this.projectFilter())
      ) {
        tasks.set(entry.taskId, entry.task.name);
      }
    }
    return [...tasks.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredEntries = computed(() => {
    const startDate = this.startDate();
    const endDate = this.endDate();
    if (startDate && endDate && startDate > endDate) {
      return [];
    }

    return this.timeEntries()
      .filter((entry) => {
        const startTime = new Date(entry.startTime);
        if (Number.isNaN(startTime.getTime())) {
          return false;
        }
        const entryDate = this.localDateKey(startTime);
        return (
          (!startDate || entryDate >= startDate) &&
          (!endDate || entryDate <= endDate) &&
          (!this.projectFilter() || entry.projectId === this.projectFilter()) &&
          (!this.taskFilter() || entry.taskId === this.taskFilter()) &&
          (this.billableFilter() === 'all' ||
            (this.billableFilter() === 'billable' ? entry.isBillable : !entry.isBillable))
        );
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  });

  readonly totalDurationSeconds = computed(() =>
    this.filteredEntries().reduce((total, entry) => total + this.durationSeconds(entry), 0),
  );
  readonly billableDurationSeconds = computed(() =>
    this.filteredEntries()
      .filter((entry) => entry.isBillable)
      .reduce((total, entry) => total + this.durationSeconds(entry), 0),
  );
  readonly nonBillableDurationSeconds = computed(
    () => this.totalDurationSeconds() - this.billableDurationSeconds(),
  );
  readonly projectSummaries = computed(() => {
    const totals = new Map<string, ProjectSummary>();
    for (const entry of this.filteredEntries()) {
      const id = entry.projectId ?? 'no-project';
      const summary = totals.get(id) ?? {
        id,
        name: entry.project?.name ?? 'No project',
        durationSeconds: 0,
      };
      summary.durationSeconds += this.durationSeconds(entry);
      totals.set(id, summary);
    }
    return [...totals.values()].sort((a, b) => b.durationSeconds - a.durationSeconds);
  });

  ngOnInit(): void {
    this.setDatePreset('this-week');
    interval(1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clockNow.set(Date.now()));
    this.reportService.listUsers().subscribe({
      next: ({ users, currentUserId }) => {
        this.reportUsers.set(users);
        this.currentUserId.set(currentUserId);
        this.selectedUserId.set(currentUserId);
        this.loadTimeEntries(currentUserId);
      },
      error: () => {
        this.errorMessage.set('Could not load report users. Try refreshing the page.');
        this.isLoading.set(false);
      },
    });
  }

  onUserFilterChange(userId: string): void {
    this.selectedUserId.set(userId);
    this.loadTimeEntries(userId);
  }

  setDatePreset(preset: DatePreset): void {
    this.datePreset.set(preset);
    const now = new Date();
    let start: Date;
    let end: Date;
    switch (preset) {
      case 'today':
        start = this.startOfDay(now);
        end = this.startOfDay(now);
        break;
      case 'this-week': {
        const daysSinceMonday = (now.getDay() + 6) % 7;
        start = this.addDays(this.startOfDay(now), -daysSinceMonday);
        end = this.addDays(start, 6);
        break;
      }
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year-to-date':
        start = new Date(now.getFullYear(), 0, 1);
        end = this.startOfDay(now);
        break;
      case 'custom':
        return;
    }
    this.startDate.set(this.localDateKey(start));
    this.endDate.set(this.localDateKey(end));
  }

  onProjectFilterChange(projectId: string): void {
    this.projectFilter.set(projectId);
    this.taskFilter.set('');
  }

  onDateChange(): void {
    this.datePreset.set('custom');
  }

  formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  formatHours(totalSeconds: number): string {
    return `${(totalSeconds / 3600).toFixed(2)} h`;
  }

  projectBarWidth(durationSeconds: number): number {
    const maxDuration = this.projectSummaries()[0]?.durationSeconds ?? 0;
    return maxDuration > 0 ? (durationSeconds / maxDuration) * 100 : 0;
  }

  entryDuration(entry: TimeEntryDto): number {
    return this.durationSeconds(entry);
  }

  private loadTimeEntries(userId: string): void {
    const requestId = ++this.reportRequestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.reportService
      .listTimeEntries(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ timeEntries }) => {
          if (requestId !== this.reportRequestId) {
            return;
          }
          this.timeEntries.set(timeEntries);
          this.isLoading.set(false);
        },
        error: () => {
          if (requestId !== this.reportRequestId) {
            return;
          }
          this.errorMessage.set('Could not load report data. Try refreshing the page.');
          this.isLoading.set(false);
        },
      });
  }

  private durationSeconds(entry: TimeEntryDto): number {
    if (entry.endTime) {
      return Math.max(
        0,
        entry.durationSeconds ??
          Math.round(
            (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 1000,
          ),
      );
    }
    return Math.max(0, Math.round((this.clockNow() - new Date(entry.startTime).getTime()) / 1000));
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private localDateKey(date: Date): string {
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
