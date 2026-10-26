import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(
    this.route.snapshot.queryParamMap.has('sessionExpired')
      ? 'Your session has expired. Please log in again.'
      : this.route.snapshot.queryParamMap.has('sessionCheck')
        ? 'Your saved session could not be verified. Check your connection and log in again.'
        : null,
  );

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const destination =
          returnUrl?.startsWith('/') && !returnUrl.startsWith('//')
            ? returnUrl
            : '/dashboard';
        void this.router.navigateByUrl(destination);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Invalid email or password.');
      },
    });
  }
}
