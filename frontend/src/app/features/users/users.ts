import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../core/services/auth';
import type { User as UserDto, UserRole } from '../../core/models/user.model';
import { User as UserService } from '../../core/services/user';

@Component({
  selector: 'app-users',
  imports: [FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  private readonly userService = inject(UserService);
  private readonly auth = inject(Auth);

  readonly users = signal<UserDto[]>([]);
  readonly isLoading = signal(true);
  readonly listError = signal<string | null>(null);

  readonly newName = signal('');
  readonly newEmail = signal('');
  readonly newPassword = signal('');
  readonly newRole = signal<UserRole>('user');
  readonly createError = signal<string | null>(null);
  readonly isCreating = signal(false);

  readonly editingUserId = signal<string | null>(null);
  readonly editingRole = signal<UserRole>('user');
  readonly editingPassword = signal('');
  readonly rowError = signal<{ id: string; message: string } | null>(null);
  readonly busyUserId = signal<string | null>(null);

  readonly currentUserId = this.auth.currentUser()?.id ?? null;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.listError.set(null);
    this.userService.list().subscribe({
      next: ({ users }) => {
        this.users.set(users);
        this.isLoading.set(false);
      },
      error: () => {
        this.listError.set('Could not load users. Try refreshing the page.');
        this.isLoading.set(false);
      },
    });
  }

  createUser(): void {
    const name = this.newName().trim();
    const email = this.newEmail().trim();
    const password = this.newPassword();
    const role = this.newRole();

    if (!name || !email || !password) {
      this.createError.set('Name, email and password are required.');
      return;
    }

    this.isCreating.set(true);
    this.createError.set(null);
    this.userService.create({ name, email, password, role }).subscribe({
      next: ({ user }) => {
        this.users.update((users) => [...users, user].sort((a, b) => a.name.localeCompare(b.name)));
        this.newName.set('');
        this.newEmail.set('');
        this.newPassword.set('');
        this.newRole.set('user');
        this.isCreating.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isCreating.set(false);
        this.createError.set(this.describeError(err, 'Could not create the user.'));
      },
    });
  }

  startEditing(user: UserDto): void {
    this.editingUserId.set(user.id);
    this.editingRole.set(user.role);
    this.editingPassword.set('');
    this.rowError.set(null);
  }

  cancelEditing(): void {
    this.editingUserId.set(null);
    this.editingPassword.set('');
    this.rowError.set(null);
  }

  saveEditing(user: UserDto): void {
    const role = this.editingRole();
    const password = this.editingPassword();
    const changes: { role?: UserRole; password?: string } = {};
    if (role !== user.role) {
      changes.role = role;
    }
    if (password) {
      changes.password = password;
    }
    if (Object.keys(changes).length === 0) {
      this.cancelEditing();
      return;
    }

    this.busyUserId.set(user.id);
    this.rowError.set(null);
    this.userService.update(user.id, changes).subscribe({
      next: ({ user: updated }) => {
        this.users.update((users) => users.map((u) => (u.id === updated.id ? updated : u)));
        this.busyUserId.set(null);
        this.cancelEditing();
      },
      error: (err: HttpErrorResponse) => {
        this.busyUserId.set(null);
        this.rowError.set({ id: user.id, message: this.describeError(err, 'Could not update the user.') });
      },
    });
  }

  deleteUser(user: UserDto): void {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) {
      return;
    }

    this.busyUserId.set(user.id);
    this.rowError.set(null);
    this.userService.remove(user.id).subscribe({
      next: () => {
        this.users.update((users) => users.filter((u) => u.id !== user.id));
        this.busyUserId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.busyUserId.set(null);
        this.rowError.set({ id: user.id, message: this.describeError(err, 'Could not delete the user.') });
      },
    });
  }

  private describeError(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 0) {
      return 'Cannot reach the server. Check that the backend is running.';
    }
    return err.error?.error ?? fallback;
  }
}
