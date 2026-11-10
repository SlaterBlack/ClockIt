import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval } from 'rxjs';
import type { ReportUser } from '../../core/models/report.model';
import { Report as ReportService } from '../../core/services/report';
import type { TimeEntry as TimeEntryDto } from '../../core/models/time-entry.model';
import { ReportExportPanel } from './report-export-panel';
import { entryDurationSeconds, formatClockDuration, localDateKey } from './report-export';

type DatePreset = 'today' | 'this-week' | 'last-week' | 'last-month' | 'year-to-date' | 'custom';
type BillableFilter = 'all' | 'billable' | 'non-billable';

interface ProjectSummary {
  id: string;
  name: string;
  durationSeconds: number;
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule, DatePipe, ReportExportPanel],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly destroyRef = inject(DestroyRef);
  private reportRequestId = 0;

  readonly reportUsers = signal<ReportUser[]>([]);
  readonly currentUserId = signal('');
  readonly selectedUserIds = signal<string[]>([]);
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
  readonly pageSizeOptions = [25, 50, 100, 150] as const;
  readonly pageSize = signal<number>(25);
  readonly currentPage = signal(1);
  readonly isUserMenuOpen = signal(false);
  readonly allUsersSelected = computed(
    () =>
      this.reportUsers().length > 0 && this.selectedUserIds().length === this.reportUsers().length,
  );
  readonly userFilterLabel = computed(() => {
    const userIds = this.selectedUserIds();
    if (userIds.length === 0) {
      return 'No users selected';
    }
    if (this.allUsersSelected()) {
      return 'All users';
    }
    if (userIds.length === 1) {
      if (userIds[0] === this.currentUserId()) {
        return 'Only me';
      }
      return this.reportUsers().find((user) => user.id === userIds[0])?.name ?? '1 user selected';
    }
    return `${userIds.length} users selected`;
  });

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
    const selectedUserIds = new Set(this.selectedUserIds());
    if (startDate && endDate && startDate > endDate) {
      return [];
    }

    return this.timeEntries()
      .filter((entry) => {
        const startTime = new Date(entry.startTime);
        if (Number.isNaN(startTime.getTime())) {
          return false;
        }
        const entryDate = localDateKey(startTime);
        return (
          selectedUserIds.has(entry.userId) &&
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
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEntries().length / this.pageSize())),
  );
  readonly currentPageNumber = computed(() => Math.min(this.currentPage(), this.totalPages()));
  readonly paginatedEntries = computed(() => {
    const start = (this.currentPageNumber() - 1) * this.pageSize();
    return this.filteredEntries().slice(start, start + this.pageSize());
  });
  readonly pageRangeStart = computed(() =>
    this.filteredEntries().length ? (this.currentPageNumber() - 1) * this.pageSize() + 1 : 0,
  );
  readonly pageRangeEnd = computed(() =>
    Math.min(this.currentPageNumber() * this.pageSize(), this.filteredEntries().length),
  );

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
        this.setSelectedUsers([currentUserId]);
      },
      error: () => {
        this.errorMessage.set('Could not load report users. Try refreshing the page.');
        this.isLoading.set(false);
      },
    });
  }

  onUserFilterChange(userId: string, checked: boolean): void {
    const selectedUserIds = new Set(this.selectedUserIds());
    if (checked) {
      selectedUserIds.add(userId);
    } else {
      selectedUserIds.delete(userId);
    }
    this.setSelectedUsers([...selectedUserIds]);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((isOpen) => !isOpen);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  selectOnlyUser(userId: string): void {
    this.setSelectedUsers([userId]);
    this.closeUserMenu();
  }

  selectOnlyMe(): void {
    this.selectOnlyUser(this.currentUserId());
  }

  selectAllUsers(): void {
    this.setSelectedUsers(this.reportUsers().map((user) => user.id));
    this.closeUserMenu();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeUserMenu();
  }

  private setSelectedUsers(userIds: string[]): void {
    const selected = new Set(userIds);
    const orderedUserIds = this.reportUsers()
      .filter((user) => selected.has(user.id))
      .map((user) => user.id);
    this.currentPage.set(1);
    this.selectedUserIds.set(orderedUserIds);
    this.loadTimeEntries(orderedUserIds);
  }

  setDatePreset(preset: DatePreset): void {
    this.currentPage.set(1);
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
      case 'last-week': {
        const daysSinceMonday = (now.getDay() + 6) % 7;
        start = this.addDays(this.startOfDay(now), -daysSinceMonday - 7);
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
    this.startDate.set(localDateKey(start));
    this.endDate.set(localDateKey(end));
  }

  onProjectFilterChange(projectId: string): void {
    this.currentPage.set(1);
    this.projectFilter.set(projectId);
    this.taskFilter.set('');
  }

  onDateChange(): void {
    this.currentPage.set(1);
    this.datePreset.set('custom');
  }

  onTaskFilterChange(taskId: string): void {
    this.currentPage.set(1);
    this.taskFilter.set(taskId);
  }

  onBillableFilterChange(filter: BillableFilter): void {
    this.currentPage.set(1);
    this.billableFilter.set(filter);
  }

  setPageSize(value: string | number): void {
    const selectedSize = Number(value);
    if (!this.pageSizeOptions.some((size) => size === selectedSize)) {
      return;
    }
    this.pageSize.set(selectedSize);
    this.currentPage.set(1);
  }

  showPreviousPage(): void {
    this.currentPage.set(Math.max(1, this.currentPageNumber() - 1));
  }

  showNextPage(): void {
    this.currentPage.set(Math.min(this.totalPages(), this.currentPageNumber() + 1));
  }

  onImportCompleted(): void {
    this.currentPage.set(1);
    const userId = this.currentUserId();
    this.datePreset.set('custom');
    this.startDate.set('');
    this.endDate.set('');
    this.projectFilter.set('');
    this.taskFilter.set('');
    this.billableFilter.set('all');
    this.setSelectedUsers([userId]);
  }

  formatDuration(totalSeconds: number): string {
    return formatClockDuration(totalSeconds);
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

  private loadTimeEntries(userIds: string[]): void {
    const requestId = ++this.reportRequestId;
    this.errorMessage.set(null);
    if (userIds.length === 0) {
      this.timeEntries.set([]);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    const userId = userIds.length === 1 ? userIds[0] : 'all';
    this.reportService
      .listTimeEntries(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ timeEntries }) => {
          if (requestId !== this.reportRequestId) {
            return;
          }
          const selectedUserIds = new Set(userIds);
          this.timeEntries.set(timeEntries.filter((entry) => selectedUserIds.has(entry.userId)));
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
    return entryDurationSeconds(entry, this.clockNow());
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
