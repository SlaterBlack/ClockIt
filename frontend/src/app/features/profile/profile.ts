import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../core/services/auth';
import type { User } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly auth = inject(Auth);

  readonly currentUser = this.auth.currentUser;
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.setProfile(user);
      return;
    }

    this.auth.fetchCurrentUser().subscribe({
      next: ({ user: loadedUser }) => this.setProfile(loadedUser),
      error: () => {
        this.errorMessage.set('Could not load your account details. Try refreshing the page.');
        this.isLoading.set(false);
      },
    });
  }

  save(): void {
    const user = this.currentUser();
    if (!user) {
      this.errorMessage.set('Your account details are not available. Try refreshing the page.');
      return;
    }

    const name = this.name().trim();
    const email = this.email().trim();
    const password = this.password();
    if (!name || !email) {
      this.errorMessage.set('Name and email are required.');
      return;
    }
    if (password && password.length < 8) {
      this.errorMessage.set('Password must be at least 8 characters.');
      return;
    }

    const changes: { name?: string; email?: string; password?: string } = {};
    if (name !== user.name) {
      changes.name = name;
    }
    if (email !== user.email) {
      changes.email = email;
    }
    if (password) {
      changes.password = password;
    }
    if (Object.keys(changes).length === 0) {
      this.errorMessage.set('No account details have changed.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.auth.updateProfile(changes).subscribe({
      next: ({ user: updatedUser }) => {
        this.setProfile(updatedUser);
        this.password.set('');
        this.successMessage.set('Your account details have been updated.');
        this.isSaving.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.describeError(error));
        this.isSaving.set(false);
      },
    });
  }

  private setProfile(user: User): void {
    this.name.set(user.name);
    this.email.set(user.email);
    this.isLoading.set(false);
  }

  private describeError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Cannot reach the server. Check that the backend is running.';
    }
    return error.error?.error ?? 'Could not update your account details.';
  }
}
